import { catchAsync } from "#utils/index";
import { caseManagementService as caseMgmt } from "./case-management";

export const controller = {
	createCase: catchAsync(async (req, res) => {
		const response = await caseMgmt.createCase(req.body, req.params, res.locals.user, req.headers);
		res.jsend.success(response, "Case Created Successfully");
	}),

	getCases: catchAsync(async (req, res) => {
		const params = req.body && Object.keys(req.body).length ? req.body : req.query;
		const response = await caseMgmt.getCases(req.params, params, req.headers);
		res.jsend.success(response, "Success");
	}),

	getCaseByID: catchAsync(async (req, res) => {
		const response = await caseMgmt.getCaseByID(req.params, req.headers, res.locals.user);
		res.jsend.success(response, "Success");
	}),

	internalGetCaseByID: catchAsync(async (req, res) => {
		const response = await caseMgmt.internalGetCaseByID(req.params, req.query);
		res.jsend.success(response, "Success");
	}),

	getStatuses: catchAsync(async (req, res) => {
		const response = await caseMgmt.getStatuses();
		res.jsend.success(response, "Success");
	}),

	getTitles: catchAsync(async (req, res) => {
		const response = await caseMgmt.getTitles(req.query);
		res.jsend.success(response, "Success");
	}),

	getCaseTypes: catchAsync(async (req, res) => {
		const response = await caseMgmt.getCaseTypes(req.query);
		res.jsend.success(response, "Case types fetched successfully");
	}),

	updateCaseStatus: catchAsync(async (req, res) => {
		const response = await caseMgmt.updateCaseStatus(req.params, req.body, res.locals.user, req.headers);
		res.jsend.success(response, "Case status updated successfully");
	}),

	createCaseOnApplicationEdit: catchAsync(async (req, res) => {
		const response = await caseMgmt.createCaseOnApplicationEdit(req.params, req.body, res.locals.user);
		res.jsend.success(response, "standalone case created successfully");
	}),

	getCaseStatusReportGeneration: catchAsync(async (req, res) => {
		const response = await caseMgmt.getCaseStatusReportGeneration(req.body);
		res.jsend.success(response, "Status fetched successfully");
	}),

	requestAdditionalInfo: catchAsync(async (req, res) => {
		const response = await caseMgmt.requestAdditionalInfo(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Info request sent successfully");
	}),

	informationUpdate: catchAsync(async (req, res) => {
		const response = await caseMgmt.informationUpdate(req.params, res.locals.user);
		res.jsend.success(response, "Information updated successfully");
	}),

	getInformationRequest: catchAsync(async (req, res) => {
		const response = await caseMgmt.getInformationRequest(req.params);
		res.jsend.success(response, "Information request details fetched successfully");
	}),

	uploadAdditionalDocuments: catchAsync(async (req, res) => {
		const response = await caseMgmt.uploadAdditionalDocuments(req.params, req.files, res.locals.user);
		res.jsend.success(response, "Additional documents uploaded successfully.");
	}),

	getDocuments: catchAsync(async (req, res) => {
		const response = await caseMgmt.getDocuments(req.params, req.query);
		res.jsend.success(response, "Documents fetched successfully.");
	}),

	reassignCase: catchAsync(async (req, res) => {
		const response = await caseMgmt.reassignCase(req.params, req.body, res.locals.user, req.headers);
		res.jsend.success(response, response?.message || "Case reassigned successfully");
	}),

	getCaseDetailsExport: catchAsync(async (req, res) => {
		const response = await caseMgmt.getCaseDetailsExport(req.params);
		res.jsend.success(response, "Case details fetched successfully.");
	}),
	decryptSSN: catchAsync(async (req, res) => {
		const response = await caseMgmt.decryptSSN(req.params, req.query, res.locals.user);
		res.jsend.success(response, "SSN decrypted successfully.");
	})
};
