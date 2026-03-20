import { createOpenAIWithLogging } from "#utils"
import type { ChatCompletionCreateParams, ChatCompletionUserMessageParam } from "openai/resources/chat";
import { fromBuffer } from "pdf2pic";
import { StatusCodes } from "http-status-codes";
import { randomUUID } from "crypto";
import { Readable } from "stream";

import { ExtractedDocumentDetailsResponse, SubmitDocumentsForExtractionPayload, messageRoleEnum, messageTypeImageUrl } from "./schema";
import { ExtractDocumentDetailsApiError } from "./error";
import { DIRECTORIES, ERROR_CODES } from "#constants";
import { uploadRawFileToS3, getUploadedFileFromS3, getCachedSignedUrlFromS3 } from "#common/common";
import { logger, sqlQuery } from "#helpers";
import { envConfig } from "#configs/index";
import { isEmptyString } from "@austinburns/type-guards";
import { OPENAI_MODEL_VERSION } from "#lib/aiEnrichment/constants";

const openai = createOpenAIWithLogging({
		apiKey: envConfig.OPEN_AI_KEY,
		maxRetries: 3,
		timeout: 120 * 1000 // 120s
	},
	logger
);

const UNSUPPORTED_DOC_MSG = "This appears to be an unsupported document";

const functions: ChatCompletionCreateParams.Function[] = [
	{
		name: "extract_document_details",
		description: "Extracts information from various supported documents by looking at uploaded images",
		parameters: {
			type: "object",
			properties: {
				extractedDetails: {
					type: "object",
					description: "JSON object containing all common details extracted from the document",
					properties: {
						legalName: { type: "string", nullable: true },
						addressStreet: { type: "string", nullable: true },
						addressStreetLineTwo: { type: "string", description: "Apt / Suite / P.O. Box", nullable: true },
						addressCity: { type: "string", nullable: true },
						addressState: { type: "string", nullable: true },
						addressZip: { type: "string", nullable: true },
						taxID: { type: "string", nullable: true },
						ssn: { type: "string", nullable: true },
						bankName: { type: "string", nullable: true },
						accountNumber: { type: "string", nullable: true },
						routingNumber: { type: "string", nullable: true },
						incorporationDate: { type: "string", nullable: true },
						ownerNames: {
							type: "array",
							items: { type: "string" },
							nullable: true
						},
						businessType: { type: "string", nullable: true },
						registrationState: { type: "string", nullable: true },
						documentNumber: { type: "string", nullable: true },
						driversLicenseNumber: { type: "string", nullable: true },
						issueDate: { type: "string", nullable: true },
						expiryDate: { type: "string", nullable: true },
						entityType: { type: "string", nullable: true }
					}
				},
				documentType: {
					type: "string",
					enum: [
						"SS-4 Confirmation Letter",
						"147C Confirmation Letter",
						"Articles of Incorporation",
						"Partnership Agreement",
						"Company Constitution/Articles of Association",
						"Certificate of Incorporation",
						"Certificate of Non-profit Registration",
						"Secretary of State Registration Filings",
						"Annual or Bi-annual State Information Reports",
						"Official Documents Listing the Registered Agent",
						"Lease or Rental Agreements",
						"Utility Bills",
						"Federal or State Tax Returns",
						"Other Government-issued Business Documents",
						"Lease Agreement or Mortgage Statement",
						"Property Tax Receipt",
						"State-issued Identification Card",
						"Voter Registration Card",
						"Insurance Card",
						"College Enrollment Papers",
						"Bank or Credit Card Statement",
						"Valid Driver's License",
						"Passport",
						"Social Security Card",
						"ITIN Card",
						"Official Bank Statements",
						"Voided Checks",
						"Official Letters from the Bank",
						"Profit & Loss (Income) Statement",
						"Balance Sheet",
						"Cash Flow Statement"
					],
					description: "Type of document uploaded for processing"
				},
				summaryOfExtractedDetails: {
					type: "string",
					description: "A brief summary or interpretation of the extracted details"
				}
			},
			required: ["extractedDetails", "documentType", "summaryOfExtractedDetails"]
		}
	}
];

class ExtractDocumentDetailsService {
	async getVerificationDetails(businessID: string) {
		const query = `SELECT * FROM integration_data.business_entity_verification_uploads WHERE business_id = $1`;
		const result = await sqlQuery({ sql: query, values: [businessID] });
		logger.info(`getVerificationDetails result for businessID: ${businessID} is: ${JSON.stringify(result.rows)}`);
		return result.rows;
	}

	async getVerificationUpload(businessID: string, verificationUploadID: string) {
		const verificationUploads = await this.getVerificationDetails(businessID);
		const verificationUpload = verificationUploads.find(upload => upload.id === verificationUploadID);
		if (!verificationUpload) {
			throw new ExtractDocumentDetailsApiError("Verification upload not found", StatusCodes.NOT_FOUND, ERROR_CODES.INVALID);
		}

		const file = await getUploadedFileFromS3(`${verificationUpload.file_path}/${verificationUpload.file_name}`);
		if (!file) {
			throw new ExtractDocumentDetailsApiError("File not found", StatusCodes.NOT_FOUND, ERROR_CODES.INVALID);
		}
		logger.info(`businessID: ${businessID} downloading file: ${verificationUpload.file_name}`);
		const arrayBuffer = await file.transformToByteArray();
		const fileStream = Readable.from(Buffer.from(arrayBuffer));
		return { fileStream, fileName: verificationUpload.file_name };
	}

	async convertPdfToBase64(fileBuffer: Buffer): Promise<string | null> {
		const options = {
			density: 100,
			format: "png",
			width: 500,
			height: 700
		};

		const convert = fromBuffer(fileBuffer, options);
		const pageToConvertAsImage = 1;

		try {
			const conversionResult = await convert(pageToConvertAsImage, { responseType: "base64" });
			if (isEmptyString(conversionResult.base64)) {
				logger.error(`Conversion result is empty: ${JSON.stringify(conversionResult)}`);
				return null;
			}
			return conversionResult.base64 ? conversionResult.base64 : null;
		} catch (error) {
			logger.error({ error }, 'Error converting PDF to base64');
			throw new ExtractDocumentDetailsApiError("Failed to convert PDF to base64", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async submitFileForDetailsExtraction({ file, businessID, additionalContext = "" }: { file: Express.Multer.File | null; businessID: string; additionalContext?: string }) {
		if (!file) {
			throw new ExtractDocumentDetailsApiError("File is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		logger.info(`File type submitted for details extraction: ${JSON.stringify(file.mimetype)} for businessID: ${businessID}`);
		logger.info(`Original file name submitted for details extraction: ${JSON.stringify(file.originalname)}`);
		let base64Image: string | null = null;
		const fileBuffer = file.buffer;
		if (file.mimetype === "application/pdf") {
			base64Image = await this.convertPdfToBase64(fileBuffer);
		} else if (file.mimetype.startsWith("image/")) {
			base64Image = fileBuffer.toString("base64");
		} else {
			throw new ExtractDocumentDetailsApiError("Unsupported file type", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		if (!base64Image) {
			throw new ExtractDocumentDetailsApiError("Failed to convert file to base64", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}

		const message = {
			role: messageRoleEnum.enum.user,
			content: [{ type: messageTypeImageUrl.value, image_url: { url: `data:image/png;base64,${base64Image}` } }]
		};

		const response = await this.submitDocumentsForExtraction({ messages: [message], additionalContext });

		if (response === UNSUPPORTED_DOC_MSG) {
			throw new ExtractDocumentDetailsApiError("This appears to be an unsupported document", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		// save file to s3
		const { path } = await uploadRawFileToS3(fileBuffer, businessID, file.originalname, DIRECTORIES.BUSINESS_VERIFICATION_UPLOADS, "WORTH_AI_VERIFICATION_UPLOADS");

		const insertVerificationUploadQuery = `
			INSERT INTO integration_data.business_entity_verification_uploads (business_id, file_name, file_path, extracted_data)
			VALUES ($1, $2, $3, $4)
			RETURNING *;

		`;

		const isTestBusinessId = businessID === "worth-admin-test-business";
		const businessIdToUse = isTestBusinessId ? randomUUID() : businessID;
		const result = await sqlQuery({ sql: insertVerificationUploadQuery, values: [businessIdToUse, file.originalname, path, response] });
		logger.info(`insertVerificationUploadQuery result: ${JSON.stringify(result.rows[0])}`);

		return response;
	}

	async submitDocumentsForExtraction({ messages, additionalContext = "" }: SubmitDocumentsForExtractionPayload) {
		try {
			const typedMessages = messages.map(message => message as ChatCompletionUserMessageParam);
			const response = await openai.chat.completions.create({
				model: OPENAI_MODEL_VERSION,
				stream: false,
				functions,
				messages: [
					{
						role: "system",
						content: `You are an expert as classifying incoming documents and extracting important details provided uploaded images.

            ### Mission
            - classify the incoming document
            - extract relevant details
            - summarize what was extracted

            ### Rules
            - if the incoming document isn't a supported document, skip extraction and summarize "This appears to be an unsupported document"
            - only extract details for **supported documents**
              - supported documents:
                - IRS-issued Documents:
                  - SS-4 Confirmation Letter
                  - 147C Confirmation Letter
                - Business Verification:
                  - Articles of Incorporation
                  - Partnership agreement
                  - Company constitution/articles of association
                  - Certificate of incorporation
                  - Certificate of non-profit registration
                - State Filing Verification:
                  - Secretary of State registration filings
                  - Annual or bi-annual state information reports
                  - Official documents listing the registered agent
                - Address Verification:
                  - Business Address:
                    - Lease or rental agreements
                    - Utility bills (water, electricity, gas, internet)
                    - Federal or state tax returns
                    - Other government-issued business documents
                  - Home Address:
                    - Lease Agreement or Mortgage Statement
                    - Utility bills (water, electricity, gas, internet)
                    - Property Tax Receipt
                    - State-issued identification card
                    - Voter Registration Card
                    - Insurance Card
                    - College Enrollment Papers
                    - Bank or credit card statement
                - Identity and Ownership Verification:
                  - Valid Driver's License
                  - Passport
                  - Social Security Card
                  - ITIN Card (if applicable)
                - Financial Verification:
                  - Official bank statements
                  - Voided checks
                  - Official letters from the bank
                  - Profit & Loss (Income) Statement
                  - Balance Sheet
                  - Cash Flow Statement

            ${additionalContext}

						When parsing an address, make sure that addressStreetLineTwo is only for:
						- Apt / Suite / P.O. Box

						REMINDER:
						If the document is not supported, return "This appears to be an unsupported document"
						DO NOT try to extract details from unsupported documents.

            Use any uploaded images to accomplish your mission.
            Do not invent anything that is not drawn directly from the context of parsing uploaded images.
          `
					},
					...typedMessages
				]
			});
			const parsedResponse = response?.choices[0]?.message?.function_call?.arguments ? JSON.parse(response?.choices[0]?.message?.function_call?.arguments) : UNSUPPORTED_DOC_MSG;

			logger.info(`extract document details response: ${JSON.stringify(parsedResponse)}`);
			return parsedResponse as ExtractedDocumentDetailsResponse | string;
		} catch (error: any) {
			throw new ExtractDocumentDetailsApiError(error?.message ?? "Failure to extract document details", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async getVerificationUploadsForBusiness(businessID: string) {
		const verificationUploads = await this.getVerificationDetails(businessID);
		if (!verificationUploads.length) {
			logger.info(`Verification uploads not found for business ${businessID}`);
			return [];
		}
		const uploads = await Promise.all(
			verificationUploads.map(async upload => {
				const file = await getCachedSignedUrlFromS3(upload.file_name, upload.file_path);
				if (!file) {
					return;
				}
				logger.info(`businessID: ${businessID} downloading file: ${upload.file_name}`);
				return {
					file_name: file.fileName,
					url: file.signedRequest
				};
			})
		);
		return uploads;
	}
}

export const extractDocumentDetailsService = new ExtractDocumentDetailsService();
