import { catchAsync } from "#utils/index";
import { esign } from "./esign";

export const controller = {
	createSession: catchAsync(async (req, res) => {
		const response = await esign.createSession(req.params, req.body);
		res.jsend.success(response, "Session created successfully");
	}),

	addTemplate: catchAsync(async (req, res) => {
		const response = await esign.associateTemplateToCustomer(req.params, req.body);
		res.jsend.success(response, "Template added successfully");
	}),

	addGlobalTemplates: catchAsync(async (req, res) => {
		const response = await esign.addGlobalTemplates(req.files, req.body, res.locals.user);
		res.jsend.success(response, "Templates added successfully");
	}),

	getGlobalTemplates: catchAsync(async (req, res) => {
		const response = await esign.getGlobalTemplates();
		res.jsend.success(response, "Templates fetched successfully");
	}),

	getTemplates: catchAsync(async (req, res) => {
		const response = await esign.getTemplates(req.params);
		res.jsend.success(response, "Templates fetched successfully");
	}),

	getSignedDocuments: catchAsync(async (req, res) => {
		const response = await esign.getSignedDocuments(req.params, req.query);
		res.jsend.success(response, "Signed documents fetched successfully");
	}),

	mockEsign: catchAsync(async (req, res) => {
		const response = await esign.mockEsignProcess(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Esign process mocked successfully");
	})
};
