import { catchAsync } from "#utils/index";
import { documents } from "./documents";

export const controller = {
	getDocuments: catchAsync(async (req, res) => {
		const response = await documents.getDocuments(req.params, req.query);
		res.jsend.success(response, "Success");
	}),
	downloadDocument: catchAsync(async (req, res) => {
		const response = await documents.downloadDocument(req.query);
		res.jsend.download(response.fileStream, response.fileName, 200);
	})
};
