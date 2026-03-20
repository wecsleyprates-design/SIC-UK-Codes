import { catchAsync } from "#utils/index";
import { applicationEdit } from "./application-edit";

export const controller = {
	applicationEdit: catchAsync(async (req, res) => {
		const response = await applicationEdit.editApplication(req.params, req.body);
		res.jsend.success(response, "Application Edit data inserted successfully");
	}),
	getApplicationEdit: catchAsync(async (req, res) => {
		const response = await applicationEdit.getApplicationEdit(req.params, req.body);
		res.jsend.success(response, "Application Edit data fetched successfully");
	}),
	applicationEditStatus: catchAsync(async (req, res) => {
		const response = await applicationEdit.getEditApplicationStatus(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Application Edit status fetched successfully");
	}),
	clearApplicationEditLock: catchAsync(async (req, res) => {
		const response = await applicationEdit.clearApplicationEditLock(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Application Edit lock cleared successfully");
	}),
	applicationEditSubmit: catchAsync(async (req, res) => {
		const response = await applicationEdit.submitEditApplication(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Customer Application Edits submitted successfully");
	})
};
