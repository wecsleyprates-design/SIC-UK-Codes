import { catchAsync } from "#utils/index";
import { core } from "./core";

export const controller = {
	updateDataRefreshConfig: catchAsync(async (req, res) => {
		const response = await core.updateDataRefreshConfig(req.body);
		res.jsend.success(response, "Configs updated successfully");
	}),

	getBusinessIndustries: catchAsync(async (req, res) => {
		const response = await core.getBusinessIndustries();
		res.jsend.success(response, "Business industries fetched successfully");
	}),

	tempRefreshSubscriptionScores: catchAsync(async (req, res) => {
		const response = await core.tempRefreshSubscriptionScores();
		res.jsend.success(response, "Refreshed jobs successfully");
	}),

	getCronConfig: catchAsync(async (req, res) => {
		const response = await core.getCronConfig();
		res.jsend.success(response, "Cron config fetched successfully");
	}),

	addCronConfig: catchAsync(async (req, res) => {
		const response = await core.addCronConfig(req.body);
		res.jsend.success(response, "Cron config created successfully");
	}),

	updateCronConfig: catchAsync(async (req, res) => {
		const response = await core.updateCronConfig(req.body);
		res.jsend.success(response, "Cron config updated successfully");
	}),

	getOnboardingStages: catchAsync(async (req, res) => {
		const response = await core.getOnboardingStages();
		res.jsend.success(response, "Onboarding Stages Fetched successfully");
	}),

	updateOnboardingStage: catchAsync(async (req, res) => {
		const response = await core.updateOnboardingStage(req.body, req.params);
		res.jsend.success(response, "Onboarding Stage Updated successfully");
	}),

	resetBusinessDetails: catchAsync(async (req, res) => {
		const response = await core.resetBusinessDetails();
		res.jsend.success(response, "Business with incositent status are updated successfully");
	}),

	resetBusinessDetailsByBusinessID: catchAsync(async (req, res) => {
		const response = await core.resetBusinessDetailsByBusinessID(req.params, res.locals.user);
		res.jsend.success(response, "Business updated successfully");
	}),

	updateOnboardingStagesOrder: catchAsync(async (req, res) => {
		const response = await core.updateOnboardingStagesOrder(req.body);
		res.jsend.success(response, "Onboarding Stages Order Updated successfully");
	}),
	getNaicsCodes: catchAsync(async (req, res) => {
		const { code } = req.query;
		const response = await core.getNaicsCodes({ naicsCode: code });
		res.jsend.success(response, "NAICS codes fetched successfully");
	}),
	getMccCodes: catchAsync(async (req, res) => {
		const { code } = req.query;
		const response = await core.getMccCodes({ mccCode: code });
		res.jsend.success(response, "MCC codes fetched successfully");
	}),
	getIndustriesBySector: catchAsync(async (req, res) => {
		const { sector } = req.query;
		const response = await core.getIndustriesBySector({ sector });
		res.jsend.success(response, "Industries fetched successfully");
	}),
	prefillCustomerInitiatedCases: catchAsync(async (req, res) => {
		const response = await core.prefillCustomerInitiatedCases();
		res.jsend.success(response, "Customer initiated cases prefilling completed successfully");
	})
};
