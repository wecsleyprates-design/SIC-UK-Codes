import { catchAsync } from "#utils/index";
import { riskAlert } from "./risk-alerts";

export const controller = {
	updateBusinessesCustomerMonitoring: catchAsync(async (req, res) => {
		const response = await riskAlert.updateBusinessesCustomerMonitoring(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Risk monitoring status updated successfully");
	}),
	getRiskAlertsByBusiness: catchAsync(async (req, res) => {
		const response = await riskAlert.getRiskAlertsByBusiness(req.params, req.query);
		res.jsend.success(response, "Business risk alerts fetched successfully");
	}),

	// TODO: remove after executing on PROD
	triggerDataFill: catchAsync(async (req, res) => {
		const response = await riskAlert.triggerDataFill();
		res.jsend.success(response, "Risk alerts data filled successfully");
	}),

	getScoreTriggerID: catchAsync(async (req, res) => {
		const response = await riskAlert.getScoreTriggerID(req.body);
		res.jsend.success(response, "Score trigger id fetched successfully");
	}),

	getRiskAlertCases: catchAsync(async (req, res) => {
		const response = await riskAlert.getRiskAlertCases();
		res.jsend.success(response, "Risk alert cases fetched successfully");
	}),

	deleteDuplicateRiskCases: catchAsync(async (req, res) => {
		const response = await riskAlert.deleteDuplicateRiskCases(req.body.riskIds);
		res.jsend.success(response, "Risk alert deleted successfully");
	})
};
