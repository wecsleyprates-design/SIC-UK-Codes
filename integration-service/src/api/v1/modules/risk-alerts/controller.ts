import { catchAsync } from "#utils/index";
import { riskAlerts } from "./risk-alerts";

export const controller = {
	addUpdateRiskAlertConfig: catchAsync(async (req, res) => {
		const response = await riskAlerts.addUpdateRiskAlertConfig(req.body, res.locals.user);
		res.jsend.success(response?.data, response?.message);
	}),
	getRiskAlertConfig: catchAsync(async (req, res) => {
		const response = await riskAlerts.getRiskAlertConfig(req.params.customerID);
		res.jsend.success(response, "Risk alert config fetched successfully");
	}),

	getRiskAlertReasonsStat: catchAsync(async (req, res) => {
		const response = await riskAlerts.getRiskAlertReasonsStat(req.params, req.query);
		res.jsend.success(response, "Risk alert reasons stat fetched successfully");
	}),

	getRiskAlerts: catchAsync(async (req, res) => {
		const response = await riskAlerts.getRiskAlerts(Object.keys(req.body).length ? req.body : req.query);
		res.jsend.success(response, "Risk alerts fetched successfully");
	}),

	getRiskScoreTriggerIDs: catchAsync(async (req, res) => {
		const response = await riskAlerts.getRiskScoreTriggerIDs();
		res.jsend.success(response, "Risk score trigger IDs fetched successfully");
	}),

	updateRiskAlertFailurePlatforms: catchAsync(async (req, res) => {
		const response = await riskAlerts.updateRiskAlertFailurePlatforms();
		res.jsend.success(response, "Risk Alert Failure Platforms Updated successfully");
	}),
	createRiskCases: catchAsync(async (req, res) => {
		const response = await riskAlerts.createRiskCases();
		res.jsend.success(response, "Risk cases created successfully");
	}),
	deleteDuplicateRiskCases: catchAsync(async (req, res) => {
		const response = await riskAlerts.deleteDuplicateRiskCases();

		res.jsend.success(response, "Risk cases deletade successfully");
	})
};
