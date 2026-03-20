import { Request } from "express";
import { catchAsync } from "#utils/index";
import { Response } from "#types";
import { extractDocumentDetailsService } from "./extractDocumentDetailsService";

export const controller = {
	submitDocumentsForExtraction: catchAsync(async (req: Request, res: Response) => {
		const response = await extractDocumentDetailsService.submitDocumentsForExtraction(req.body);
		res.jsend.success(response, "Invoked extract document details successfully.");
	}),

	submitFileForDetailsExtraction: catchAsync(async (req: Request, res: Response) => {
		const response = await extractDocumentDetailsService.submitFileForDetailsExtraction({
			file: req?.file ?? null,
			businessID: req.params.businessID,
			additionalContext: req.body?.additionalContext ?? ""
		});
		res.jsend.success(response, "Extracted document details successfully.");
	}),

	getVerificationDetails: catchAsync(async (req: Request, res: Response) => {
		const response = await extractDocumentDetailsService.getVerificationDetails(req.params.businessID);
		res.jsend.success(response, "Retrieved verification details successfully.");
	}),

	getVerificationUpload: catchAsync(async (req: Request, res: Response) => {
		res.setHeader("Content-Disposition", 'attachment; filename="verification_upload"');
		const response = await extractDocumentDetailsService.getVerificationUpload(req.params.businessID, req.params.verificationUploadID);
		res.jsend.download(response.fileStream, response.fileName, 200);
	}),

	getVerificationUploadsForBusiness: catchAsync(async (req: Request, res: Response) => {
		const response = await extractDocumentDetailsService.getVerificationUploadsForBusiness(req.params.businessID);
		res.jsend.success(response, "Retrieved data successfully.");
	})
};
