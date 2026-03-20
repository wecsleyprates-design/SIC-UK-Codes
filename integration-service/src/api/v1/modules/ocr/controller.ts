import { Request } from "express";
import { catchAsync } from "#utils/index";
import { Response } from "#types";
import { randomUUID, UUID } from "crypto";
import { ocrService } from "./ocrService";
import { DOCUMENT_TYPES, DocumentType } from "./constants";
import { taskQueue } from "#workers/taskHandler";
import { OcrApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { logger } from "#helpers";

export const controller = {
	validateDocumentType: catchAsync(async (req: Request, res: Response) => {
		const typedBusinessID = req.params.businessID as UUID;
		const documentType = req.params.documentType as DocumentType;
		const skipOcr = req.body.skip_ocr ? req.body.skip_ocr === "true" : false;
		const caseID = (req.body.case_id ?? req.query.case_id) as UUID;
		const userInfo = res.locals.user;
		const ocrDocumentID = randomUUID();
		const extractionDocumentID = randomUUID();
		if (!req.file) {
			throw new OcrApiError("File is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		if (skipOcr) {
			if (
				(documentType === DOCUMENT_TYPES.PROCESSING_STATEMENT || documentType === DOCUMENT_TYPES.BANK_STATEMENT) &&
				req.file.mimetype !== "application/pdf" &&
				!req.file.mimetype.startsWith("image/")
			) {
				throw new OcrApiError("Unsupported file type", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
			if (documentType === DOCUMENT_TYPES.ACCOUNTING_STATEMENT && !["application/pdf", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(req.file.mimetype)) {
				throw new OcrApiError("Unsupported file type", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
			const response = await ocrService.uploadDocumentSkipOCR({
				fileBuffer: req.file.buffer ?? null,
				businessID: typedBusinessID,
				caseID,
				documentType,
				fileName: req.file.originalname,
				mimeType: req.file.mimetype,
				additionalContext: req.body?.additionalContext ?? "",
				maxPages: req.body?.maxPages ? Number(req.body.maxPages) : 2,
				ocrDocumentID,
				extractionDocumentID
			});

			res.jsend.success({ ...response, ocr_document_id: ocrDocumentID, extraction_document_id: extractionDocumentID }, `${documentType} validation has been queued.`);
		} else {
			const response = await ocrService.validateDocumentType({
				file: req.file ?? null,
				businessID: typedBusinessID,
				caseID,
				documentType,
				additionalContext: req.body?.additionalContext ?? "",
				maxPages: req.body?.maxPages ? Number(req.body.maxPages) : 2,
				ocrDocumentID,
				extractionDocumentID,
				userInfo
			});

			res.jsend.success({ ...response, ocr_document_id: ocrDocumentID, extraction_document_id: extractionDocumentID }, `${documentType} validation has been queued.`);
		}
	}),

	parseDocument: catchAsync(async (req: Request, res: Response) => {
		const typedBusinessID = req.params.businessID as UUID;
		const documentType = req.params.documentType as DocumentType;
		const caseID = (req.body.case_id ?? req.query.case_id) as UUID;

		const response = await ocrService.parseDocument({
			file: req.file ?? null,
			businessID: typedBusinessID,
			documentType,
			additionalContext: req.body?.additionalContext ?? "",
			caseID
		});

		res.jsend.success(response, `${documentType} processing has been queued.`);
	}),

	parseBulkDocuments: catchAsync(async (req: Request, res: Response) => {
		const typedBusinessID = req.params.businessID as UUID;
		const documentType = req.params.documentType as DocumentType;
		const files = req.files as Express.Multer.File[];

		const response = await ocrService.parseBulkDocuments({
			files,
			businessID: typedBusinessID,
			documentType,
			additionalContext: req.body?.additionalContext ?? ""
		});

		res.jsend.success(response, `Bulk ${documentType} processing has been queued.`);
	}),

	validateBulkDocumentTypes: catchAsync(async (req: Request, res: Response) => {
		const typedBusinessID = req.params.businessID as UUID;
		const caseID = req.body.case_id as UUID;
		const documentType = req.params.documentType as DocumentType;
		const files = req.files as Express.Multer.File[];

		const response = await ocrService.validateBulkDocumentTypes({
			files,
			businessID: typedBusinessID,
			caseID,
			documentType,
			additionalContext: req.body?.additionalContext ?? "",
			maxPages: req.body?.maxPages ?? 2
		});

		res.jsend.success(response, `Bulk ${documentType} validation has been queued.`);
	}),

	getJobStatus: catchAsync(async (req: Request, res: Response) => {
		const jobId = req.params.jobId;
		const job = await taskQueue.getJobByID(jobId);

		if (!job) {
			throw new OcrApiError("Job not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		const state = await job.getState();
		const error = job.failedReason; // Contains error message if job failed

		let documentData = null;
		if (state === "completed") {
			documentData = await ocrService.getOcrDocumentByJobId(jobId);
		}

		res.jsend.success({
			jobId,
			state,
			error: error ?? null,
			documentData: documentData ?? null
		});
	}),

	getBusinessDocumentValidations: catchAsync(async (req: Request, res: Response) => {
		const typedBusinessID = req.params.businessID as UUID;

		const response = await ocrService.getBusinessDocumentValidations(typedBusinessID);

		res.jsend.success(response);
	}),

	getBusinessDocumentExtractions: catchAsync(async (req: Request, res: Response) => {
		const typedBusinessID = req.params.businessID as UUID;

		const response = await ocrService.getBusinessDocumentExtractions(typedBusinessID);

		res.jsend.success(response);
	}),

	getDocumentUpload: catchAsync(async (req: Request, res: Response) => {
		const typedBusinessID = req.params.businessID as UUID;
		const jobType = req.params.jobType as "extraction" | "validation";
		const filePath = req.query.filePath as string;

		res.setHeader("Content-Disposition", `attachment; filename="document_upload"`);
		const response = await ocrService.getDocumentUpload(typedBusinessID, filePath, jobType);
		res.jsend.download(response.fileStream, response.fileName, 200);
	})
};
