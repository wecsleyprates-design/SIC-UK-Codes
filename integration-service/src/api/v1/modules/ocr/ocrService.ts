import { createOpenAIWithLogging } from "#utils";
import { StatusCodes } from "http-status-codes";
import { randomUUID, type UUID } from "crypto";
import { createWorker } from "tesseract.js";
import dedent from "dedent";

import { OcrApiError } from "./error";
import { db, logger, producer } from "#helpers";
import { getUploadedFileFromS3, uploadRawFileToS3 } from "#common/common";
import { DIRECTORIES, ERROR_CODES, EVENTS, kafkaEvents, kafkaTopics } from "#constants";
import { sqlQuery } from "#helpers";
import { envConfig } from "#configs/index";
import { fromBuffer } from "pdf2pic";
import { isNonEmptyString } from "@austinburns/type-guards";
import {
	AggregatedData,
	OcrMission,
	ParsedDocumentResult,
	ParsedStatement,
	ValidatedDocumentType,
	parsedTaxReturnSchema,
	validatedDocumentTypeSchema
} from "./schema";
import { DOCUMENT_TYPES, getSystemPrompt, DocumentType } from "./constants";
import { enhancedParsedStatementSchema } from "./schema";
import { taskQueue } from "#workers/taskHandler";
import { getResponseFormat } from "./constants";
import { Readable } from "stream";
import { taxation } from "../taxation/taxation";
import { performance } from "perf_hooks";
import { UserInfo } from "#types";
import { OPENAI_MODEL_VERSION } from "#lib/aiEnrichment/constants";

const openai = createOpenAIWithLogging(
	{
		apiKey: envConfig.OPEN_AI_KEY,
		maxRetries: 3,
		timeout: 120 * 1000 // 120s
	},
	logger
);

class OcrService {
	// Converts a PDF file buffer to a base64-encoded image string
	async convertPdfToBase64(fileBuffer: Buffer, maxPages?: number): Promise<string[]> {
		const options = {
			density: 300,
			format: "png",
			width: 2550,
			height: 3300
		};

		const convert = fromBuffer(fileBuffer, options);

		try {
			// Get the total number of pages
			const pageCount = (await convert.bulk(-1)).length;
			const pagesToProcess = maxPages ? Math.min(pageCount, maxPages) : pageCount;
			logger.info(`Processing PDF with ${pageCount} pages, will process ${pagesToProcess} pages`);

			const base64Pages: string[] = [];

			// Convert each page up to maxPages if specified
			for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
				const conversionResult = await convert(pageNum, { responseType: "base64" });
				const base64Value = conversionResult.base64;
				if (typeof base64Value === "string" && base64Value.length > 0) {
					base64Pages.push(base64Value);
				} else {
					logger.warn(`Page ${pageNum} conversion resulted in empty base64`);
				}
			}

			if (base64Pages.length === 0) {
				throw new Error("No pages were successfully converted");
			}

			return base64Pages;
		} catch (error) {
			logger.error({ error }, 'Error converting PDF to base64');
			throw new OcrApiError("Failed to convert PDF to base64", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	// Extracts text from an image buffer using OCR
	private async parseTextFromImage(imageBuffers: Buffer[]): Promise<{ text: string }> {
		const worker = await createWorker("eng", 1, {
			logger: m => logger.debug(m)
		});

		try {
			const textParts: string[] = [];

			for (let i = 0; i < imageBuffers.length; i++) {
				const { data } = await worker.recognize(imageBuffers[i]);
				textParts.push(data.text);
				logger.debug(`Processed page ${i + 1} with ${data.text.length} characters`);
			}

			return { text: textParts.join("\n\n=== PAGE BREAK ===\n\n") };
		} finally {
			await worker.terminate();
		}
	}

	// Calculates aggregated data from the parsed statement
	private calculateAggregatedData(planSummaryData: ParsedStatement["planSummaryData"] | null): AggregatedData {
		if (!planSummaryData) {
			return {
				combinedMonthlyVolume: 0,
				combinedAverageTicketSize: 0,
				combinedHighestTicket: 0,
				combinedDesiredLimit: 0,
				visaMastercardDiscover: {
					monthlyVolume: 0,
					averageTicketSize: 0,
					highTicketSize: 0,
					desiredLimit: 0
				}
			};
		}

		const roundToTwo = (num: number): number => Math.round(num * 100) / 100;

		// Calculate desired limits for each card type (110% of monthly volume)
		planSummaryData.visa.desiredLimit = roundToTwo(planSummaryData.visa.monthlyVolume * 1.1);
		planSummaryData.mastercard.desiredLimit = roundToTwo(planSummaryData.mastercard.monthlyVolume * 1.1);
		planSummaryData.discover.desiredLimit = roundToTwo(planSummaryData.discover.monthlyVolume * 1.1);
		planSummaryData.americanExpress.desiredLimit = roundToTwo(planSummaryData.americanExpress.monthlyVolume * 1.1);

		// Calculate VMD (Visa/Mastercard/Discover) combined data
		const vmdMonthlyVolume = roundToTwo(
			planSummaryData.visa.monthlyVolume +
				planSummaryData.mastercard.monthlyVolume +
				planSummaryData.discover.monthlyVolume
		);

		const vmdTransactions =
			planSummaryData.visa.numberOfTransactions +
			planSummaryData.mastercard.numberOfTransactions +
			planSummaryData.discover.numberOfTransactions;

		const vmdAverageTicketSize = vmdTransactions === 0 ? 0 : roundToTwo(vmdMonthlyVolume / vmdTransactions);

		const vmdHighestTicket = Math.max(
			planSummaryData.visa.highTicketSize,
			planSummaryData.mastercard.highTicketSize,
			planSummaryData.discover.highTicketSize
		);

		// Calculate overall combined data (including Amex)
		const combinedMonthlyVolume = roundToTwo(vmdMonthlyVolume + planSummaryData.americanExpress.monthlyVolume);

		const totalTransactions = vmdTransactions + planSummaryData.americanExpress.numberOfTransactions;

		const combinedAverageTicketSize =
			totalTransactions === 0 ? 0 : roundToTwo(combinedMonthlyVolume / totalTransactions);

		const combinedHighestTicket = Math.max(vmdHighestTicket, planSummaryData.americanExpress.highTicketSize);

		return {
			combinedMonthlyVolume,
			combinedAverageTicketSize,
			combinedHighestTicket,
			combinedDesiredLimit: roundToTwo(combinedMonthlyVolume * 1.1),
			visaMastercardDiscover: {
				monthlyVolume: vmdMonthlyVolume,
				averageTicketSize: vmdAverageTicketSize,
				highTicketSize: vmdHighestTicket,
				desiredLimit: roundToTwo(vmdMonthlyVolume * 1.1)
			}
		};
	}

	// Saves the parsed statement data to the database
	private async saveDocumentToDatabase(
		businessID: UUID,
		fileName: string,
		filePath: string,
		data: ParsedDocumentResult | ValidatedDocumentType | {},
		jobId: string,
		jobType: OcrMission,
		caseID: UUID | null = null,
		userInfo?: UserInfo,
		documentCategory: number | null = null
	): Promise<void> {
		try {
			const documentID = jobId.split("::")[2] || randomUUID();
			logger.info(`saveDocumentToDatabase: ${documentID} ${JSON.stringify(data)} ${jobId} ${jobType}`);
			const insertParsedStatementQuery = `
					INSERT INTO integration_data.uploaded_ocr_documents (id, business_id, file_name, file_path, extracted_data, job_id, job_type, category_id, case_id)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
					RETURNING *;
			`;

			const sqlResult = await sqlQuery({
				sql: insertParsedStatementQuery,
				values: [documentID, businessID, fileName, filePath, data, jobId, jobType, documentCategory, caseID]
			});
			logger.info(`insertParsedStatementQuery result: ${JSON.stringify(sqlResult.rows[0])}`);

			if (jobId.split("::")[1] === DOCUMENT_TYPES.TAX_RETURN) {
				if (jobType === "extraction") {
					await taxation.processTaxFilingExtraction({
						businessID,
						ocrDocumentID: documentID as UUID,
						userInfo,
						caseID
					});
				} else if ("isValidDocumentType" in data) {
					caseID &&
						(await taxation._updateTaxFilingIntegrationTaskMetadata(
							documentID as UUID,
							caseID,
							data.isValidDocumentType
						));
				}
			}
		} catch (error) {
			logger.error({ error }, 'saveDocumentToDatabase failed');
		}
	}

	// Handle queued processing to extract data from a document
	async processQueuedDocument(data: {
		fileBuffer: Buffer | { type: string; data: number[] };
		businessID: UUID;
		caseID: UUID;
		documentType: DocumentType;
		fileName: string;
		mimeType: string;
		additionalContext?: string;
		jobId: string;
		maxPages?: number;
		userInfo?: UserInfo;
	}) {
		// Convert fileBuffer back to Buffer if it's a serialized object
		const fileBuffer = Buffer.isBuffer(data.fileBuffer) ? data.fileBuffer : Buffer.from(data.fileBuffer.data);

		let imageBuffers: Buffer[];
		const { mimeType, businessID, documentType, fileName, jobId, caseID, userInfo } = data;

		// Convert PDF to image buffers or use image buffer directly
		if (mimeType === "application/pdf") {
			// for now, we're not limiting the number of pages because it makes for more accurate results during extraction
			const imageConversionStartTime = performance.now();
			const pdfBase64Pages = await this.convertPdfToBase64(fileBuffer);
			imageBuffers = pdfBase64Pages.map(base64 => Buffer.from(base64, "base64"));
			logger.info(`EXTRACTION PERFORMANCE: PDF conversion took ${performance.now() - imageConversionStartTime}ms`);
		} else if (mimeType.startsWith("image/")) {
			imageBuffers = [fileBuffer];
		} else {
			throw new OcrApiError("Unsupported file type", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		// Extract text from images using OCR
		const parseTextFromImageStartTime = performance.now();
		const parsedData = await this.parseTextFromImage(imageBuffers);
		logger.info(`EXTRACTION PERFORMANCE: Text extraction took ${performance.now() - parseTextFromImageStartTime}ms`);
		logger.info(`Extracted data from statement: ${JSON.stringify(parsedData)}`);

		// Use OpenAI to parse the extracted text
		const extractDocumentDetailsStartTime = performance.now();
		const completion = await openai.chat.completions.parse({
			model: OPENAI_MODEL_VERSION,
			stream: false,
			messages: [
				{
					role: "system",
					content: getSystemPrompt(documentType, "extraction")
				},
				{
					role: "user",
					content: dedent`Parse the following statement:
							"""
							${parsedData.text}
							"""
							`
				}
			],
			response_format: getResponseFormat(documentType, "extraction")
		});
		logger.info(
			`EXTRACTION PERFORMANCE: OpenAI completion took ${performance.now() - extractDocumentDetailsStartTime}ms`
		);

		const result = completion.choices[0].message.parsed;

		logger.info(`result from openai: ${JSON.stringify(result, null, 2)}`);

		const isParsedStatement = (doc: any): doc is ParsedStatement => {
			return "planSummaryData" in doc;
		};

		// Only calculate and combine aggregated data for processing statements
		const enhancedResult =
			documentType === DOCUMENT_TYPES.PROCESSING_STATEMENT
				? {
						...result,
						aggregatedData: this.calculateAggregatedData(isParsedStatement(result) ? result.planSummaryData : null)
					}
				: result;

		// Validate the enhanced result using the appropriate schema
		const validatedResult =
			documentType === DOCUMENT_TYPES.PROCESSING_STATEMENT
				? enhancedParsedStatementSchema.parse(enhancedResult)
				: parsedTaxReturnSchema.parse(enhancedResult);

		logger.info(`Parsed statement with aggregated data: ${JSON.stringify(validatedResult)}`);

		const s3Directory = {
			[DOCUMENT_TYPES.PROCESSING_STATEMENT]: DIRECTORIES.BUSINESS_STATEMENT_UPLOADS,
			[DOCUMENT_TYPES.TAX_RETURN]: DIRECTORIES.BUSINESS_TAX_RETURN_UPLOADS
		};

		const s3UploadKey = {
			[DOCUMENT_TYPES.PROCESSING_STATEMENT]: "WORTH_AI_STATEMENT_UPLOADS",
			[DOCUMENT_TYPES.TAX_RETURN]: "WORTH_AI_TAX_RETURN_UPLOADS"
		};

		// Save file to S3 and store parsed data in database
		const { path } = await uploadRawFileToS3(
			fileBuffer,
			businessID,
			fileName,
			s3Directory[documentType],
			s3UploadKey[documentType]
		);
		logger.info(
			`saveDocumentToDatabase: extraction process ${path} ${JSON.stringify(validatedResult)} ${jobId} ${caseID}`
		);
		await this.saveDocumentToDatabase(
			businessID,
			fileName,
			path,
			validatedResult,
			jobId,
			"extraction",
			caseID,
			userInfo
		);




		return validatedResult;
	}


	// Main method to parse a single statement
	async parseDocument({
		file,
		businessID,
		caseID,
		documentType,
		additionalContext = "",
		maxPages
	}: {
		file: Express.Multer.File | null;
		businessID: UUID;
		caseID?: UUID;
		documentType: DocumentType;
		additionalContext?: string;
		maxPages?: number;
	}): Promise<{ jobId: string }> {
		if (!file) {
			throw new OcrApiError("File is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const jobId = `${businessID}::${documentType}::${randomUUID()}`;

		// Add job to queue
		await taskQueue.addJob(
			EVENTS.OCR_PARSE_DOCUMENT,
			{
				fileBuffer: file.buffer,
				businessID,
				documentType,
				fileName: file.originalname,
				mimeType: file.mimetype,
				additionalContext,
				jobId, // adding jobId here allows us to store it within the DB record for easier retrieval later
				maxPages,
				caseID
			},
			{
				jobId // adding jobId here allows us to overwrite the random UUID that would be otherwise generated for this task
			}
		);

		return { jobId };
	}

	// Main method to validate a single document type
	async validateDocumentType({
		file,
		businessID,
		caseID,
		documentType,
		additionalContext = "",
		maxPages,
		ocrDocumentID,
		extractionDocumentID,
		userInfo
	}: {
		file: Express.Multer.File | null;
		businessID: UUID;
		caseID: UUID;
		documentType: DocumentType;
		additionalContext?: string;
		maxPages?: number;
		ocrDocumentID?: UUID;
		extractionDocumentID?: UUID;
		userInfo?: UserInfo;
	}): Promise<{ jobId: string }> {
		if (!file) {
			throw new OcrApiError("File is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		if (file.mimetype !== "application/pdf" || file.mimetype.startsWith("image/")) {
			throw new OcrApiError("Unsupported file type", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const jobId = `${businessID}::${documentType}::${extractionDocumentID ?? randomUUID()}`;

		// Add job to queue
		await taskQueue.addJob(
			EVENTS.OCR_VALIDATE_DOCUMENT_TYPE,
			{
				fileBuffer: file.buffer,
				businessID,
				caseID,
				documentType,
				fileName: file.originalname,
				mimeType: file.mimetype,
				additionalContext,
				jobId, // adding jobId here allows us to store it within the DB record for easier retrieval later
				maxPages,
				ocrDocumentID,
				userInfo
			},
			{
				jobId // adding jobId here allows us to overwrite the random UUID that would be otherwise generated for this task
			}
		);

		return { jobId };
	}

	// Handle queued validation
	async validateQueuedDocumentType(data: {
		fileBuffer: Buffer | { type: string; data: number[] };
		businessID: UUID;
		caseID: UUID;
		documentType: DocumentType;
		fileName: string;
		mimeType: string;
		additionalContext?: string;
		jobId: string;
		maxPages?: number;
		ocrDocumentID?: UUID;
		userInfo?: UserInfo;
	}) {
		// Convert fileBuffer back to Buffer if it's a serialized object
		const fileBuffer = Buffer.isBuffer(data.fileBuffer) ? data.fileBuffer : Buffer.from(data.fileBuffer.data);

		let imageBuffers: Buffer[];
		const { mimeType, businessID, documentType, fileName, jobId, caseID, userInfo } = data;

		// Convert PDF to image buffers or use image buffer directly
		if (mimeType === "application/pdf") {
			const imageConversionStartTime = performance.now();
			const pdfBase64Pages = await this.convertPdfToBase64(fileBuffer, data.maxPages);
			imageBuffers = pdfBase64Pages.map(base64 => Buffer.from(base64, "base64"));
			logger.info(`VALIDATION PERFORMANCE: PDF conversion took ${performance.now() - imageConversionStartTime}ms`);
		} else if (mimeType.startsWith("image/")) {
			imageBuffers = [fileBuffer];
		} else {
			throw new OcrApiError("Unsupported file type", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		// Extract text from images using OCR
		const parseTextFromImageStartTime = performance.now();
		const parsedData = await this.parseTextFromImage(imageBuffers);
		logger.info(`VALIDATION PERFORMANCE: Text extraction took ${performance.now() - parseTextFromImageStartTime}ms`);
		logger.info(`Extracted data from statement: ${JSON.stringify(parsedData)}`);

		// Use OpenAI to parse the extracted text
		const validateDocumentTypeStartTime = performance.now();
		const completion = await openai.chat.completions.parse({
			model: OPENAI_MODEL_VERSION,
			stream: false,
			messages: [
				{
					role: "system",
					content: getSystemPrompt(documentType, "validation")
				},
				{
					role: "user",
					content: dedent`Parse the following statement:
							"""
							${parsedData.text}
							"""
							`
				}
			],
			response_format: getResponseFormat(documentType, "validation")
		});
		logger.info(
			`VALIDATION PERFORMANCE: OpenAI completion took ${performance.now() - validateDocumentTypeStartTime}ms`
		);

		const result = completion.choices[0].message.parsed;

		logger.info(`result from openai: ${JSON.stringify(result, null, 2)}`);

		// Validate the enhanced result using the appropriate schema
		const validatedResult = validatedDocumentTypeSchema.parse(result);

		logger.info(`Validated document type: ${JSON.stringify(validatedResult)}`);

		const s3Directory = {
			[DOCUMENT_TYPES.PROCESSING_STATEMENT]: DIRECTORIES.BUSINESS_STATEMENT_UPLOADS,
			[DOCUMENT_TYPES.TAX_RETURN]: DIRECTORIES.BUSINESS_TAX_RETURN_UPLOADS
		};

		const s3UploadKey = {
			[DOCUMENT_TYPES.PROCESSING_STATEMENT]: "WORTH_AI_STATEMENT_UPLOADS",
			[DOCUMENT_TYPES.TAX_RETURN]: "WORTH_AI_TAX_RETURN_UPLOADS"
		};

		// we'll optimistically shove newJobId into validatedResult
		// so that the frontend can immediately see the extractionJobId incase the validation passed
		// and it needs to start polling for the extraction job
		const newJobId = `${businessID}::${documentType}::${data.ocrDocumentID ?? randomUUID()}`;

		// Save file to S3 and store parsed data in database
		const { path } = await uploadRawFileToS3(
			fileBuffer,
			businessID,
			fileName,
			s3Directory[documentType],
			s3UploadKey[documentType]
		);
		await this.saveDocumentToDatabase(
			businessID,
			fileName,
			path,
			{ ...validatedResult, extractionJobId: newJobId },
			jobId,
			"validation",
			caseID,
			userInfo
		);

		// if validation is successful, we need to queue up the extraction process
		if (validatedResult.isValidDocumentType) {
			// Add job to queue
			await taskQueue.addJob(
				EVENTS.OCR_PARSE_DOCUMENT,
				{
					fileBuffer,
					businessID,
					caseID,
					documentType,
					fileName,
					mimeType,
					additionalContext: "",
					jobId: newJobId, // adding jobId here allows us to store it within the DB record for easier retrieval later
					maxPages: data.maxPages,
					userInfo: userInfo
				},
				{
					jobId: newJobId // adding jobId here allows us to overwrite the random UUID that would be otherwise generated for this task
				}
			);
		}

		return validatedResult;
	}

	// Method to parse multiple statements in bulk
	async parseBulkDocuments({
		files,
		businessID,
		documentType,
		additionalContext = "",
		maxPages
	}: {
		files: Express.Multer.File[];
		businessID: UUID;
		documentType: DocumentType;
		additionalContext?: string;
		maxPages?: number;
	}): Promise<{ jobIds: string[] }> {
		if (!files || files.length === 0) {
			throw new OcrApiError("At least one file is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const jobIds: string[] = [];

		for (const file of files) {
			try {
				const { jobId } = await this.parseDocument({ file, businessID, documentType, additionalContext, maxPages });
				jobIds.push(jobId);
			} catch (error) {
				logger.error(`Error processing file ${file.originalname}: ${error}`);
				throw error;
			}
		}

		return { jobIds };
	}

	// Method to validate multiple document types in bulk
	async validateBulkDocumentTypes({
		files,
		businessID,
		caseID,
		documentType,
		additionalContext = "",
		maxPages
	}: {
		files: Express.Multer.File[];
		businessID: UUID;
		caseID: UUID;
		documentType: DocumentType;
		additionalContext?: string;
		maxPages?: number;
	}): Promise<{ jobIds: string[] }> {
		if (!files || files.length === 0) {
			throw new OcrApiError("At least one file is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const jobIds: string[] = [];

		for (const file of files) {
			try {
				const { jobId } = await this.validateDocumentType({
					file,
					businessID,
					documentType,
					additionalContext,
					maxPages,
					caseID
				});
				jobIds.push(jobId);
			} catch (error) {
				logger.error(`Error validating file ${file.originalname}: ${error}`);
				throw error;
			}
		}

		return { jobIds };
	}

	async getOcrDocumentByJobId(jobId: string) {
		const query = `
			SELECT * FROM integration_data.uploaded_ocr_documents
			WHERE job_id = $1
			LIMIT 1;
		`;

		const result = await sqlQuery({ sql: query, values: [jobId] });
		return result.rows[0] || null;
	}

	async getBusinessDocumentValidations(businessID: UUID, caseID?: UUID) {
		let query = `
			SELECT * FROM integration_data.uploaded_ocr_documents
			WHERE business_id = $1 AND job_type = 'validation'
		`;
		const values = [businessID];

		if (caseID) {
			query += ` AND case_id = $2 `;
			values.push(caseID);
		}

		const result = await sqlQuery({ sql: query, values });
		return result.rows;
	}

	async getBusinessDocumentExtractions(businessID: UUID, caseID?: UUID) {
		let query = `
			SELECT * FROM integration_data.uploaded_ocr_documents
			WHERE business_id = $1 AND job_type = 'extraction'
		`;
		const values = [businessID];

		if (caseID) {
			query += ` AND case_id = $2 `;
			values.push(caseID);
		}

		const result = await sqlQuery({ sql: query, values });
		return result.rows;
	}

	async getDocumentUpload(businessID: UUID, filePath: string, jobType: "extraction" | "validation") {
		let documentUploads;
		if (jobType === "extraction") {
			documentUploads = await this.getBusinessDocumentExtractions(businessID);
		} else {
			documentUploads = await this.getBusinessDocumentValidations(businessID);
		}
		const documentUpload = documentUploads.find(upload => upload.file_path === filePath);
		if (!documentUpload) {
			throw new OcrApiError("Document upload not found", StatusCodes.NOT_FOUND, ERROR_CODES.INVALID);
		}

		const file = await getUploadedFileFromS3(`${documentUpload.file_path}/${documentUpload.file_name}`);
		if (!file) {
			throw new OcrApiError("File not found", StatusCodes.NOT_FOUND, ERROR_CODES.INVALID);
		}
		logger.info(`businessID: ${businessID} downloading file: ${documentUpload.file_name}`);
		const arrayBuffer = await file.transformToByteArray();
		const fileStream = Readable.from(Buffer.from(arrayBuffer));
		return { fileStream, fileName: documentUpload.file_name };
	}

	// Main method to validate a single document type
	async uploadDocumentSkipOCR(data: {
		fileBuffer: Buffer | { type: string; data: number[] };
		businessID: UUID;
		caseID: UUID;
		documentType: DocumentType;
		fileName: string;
		mimeType: string;
		additionalContext?: string;
		maxPages?: number;
		ocrDocumentID?: UUID;
		extractionDocumentID?: UUID;
	}): Promise<{ jobId: string }> {
		const jobId = `${data.businessID}::${data.documentType}::${data.ocrDocumentID ?? randomUUID()}`;

		// Convert fileBuffer back to Buffer if it's a serialized object
		const fileBuffer = Buffer.isBuffer(data.fileBuffer) ? data.fileBuffer : Buffer.from(data.fileBuffer.data);

		const s3Directory = {
			[DOCUMENT_TYPES.PROCESSING_STATEMENT]: DIRECTORIES.BUSINESS_STATEMENT_UPLOADS,
			[DOCUMENT_TYPES.TAX_RETURN]: DIRECTORIES.BUSINESS_TAX_RETURN_UPLOADS,
			[DOCUMENT_TYPES.BANK_STATEMENT]: DIRECTORIES.BUSINESS_BANK_STATEMENT_UPLOADS,
			[DOCUMENT_TYPES.ACCOUNTING_STATEMENT]: DIRECTORIES.BUSINESS_ACCOUNTING_STATEMENT_UPLOADS
		};

		const s3UploadKey = {
			[DOCUMENT_TYPES.PROCESSING_STATEMENT]: "WORTH_AI_STATEMENT_UPLOADS",
			[DOCUMENT_TYPES.TAX_RETURN]: "WORTH_AI_TAX_RETURN_UPLOADS",
			[DOCUMENT_TYPES.BANK_STATEMENT]: "WORTH_AI_BANK_STATEMENT_UPLOADS",
			[DOCUMENT_TYPES.ACCOUNTING_STATEMENT]: "WORTH_AI_ACCOUNTING_STATEMENT_UPLOADS"
		};

		const documentCategories = {
			[DOCUMENT_TYPES.PROCESSING_STATEMENT]: null,
			[DOCUMENT_TYPES.TAX_RETURN]: 4,
			[DOCUMENT_TYPES.BANK_STATEMENT]: 3,
			[DOCUMENT_TYPES.ACCOUNTING_STATEMENT]: 1
		};

		const newJobId = `${data.businessID}::${data.documentType}::${data.extractionDocumentID ?? randomUUID()}`;

		// Save file to S3 and store parsed data in database
		const { path } = await uploadRawFileToS3(
			fileBuffer,
			data.businessID,
			data.fileName,
			s3Directory[data.documentType],
			s3UploadKey[data.documentType]
		);
		await this.saveDocumentToDatabase(
			data.businessID,
			data.fileName,
			path,
			{
				isValidDocumentType: true,
				confidenceScore: 0,
				documentType: `Valid ${data.documentType}`,
				identifiedFeatures: [],
				extractionJobId: newJobId
			},
			jobId,
			"validation",
			data.caseID,
			undefined,
			documentCategories[data.documentType]
		);
		await this.saveDocumentToDatabase(
			data.businessID,
			data.fileName,
			path,
			{},
			newJobId,
			"extraction",
			data.caseID,
			undefined,
			documentCategories[data.documentType]
		);

		return { jobId };
	}
}

export const ocrService = new OcrService();
