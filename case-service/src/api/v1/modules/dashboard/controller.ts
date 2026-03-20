import { catchAsync } from "#utils/index";
import { dashboard } from "./dashboard";

export const controller = {
	getDecisionStats: catchAsync(async (req, res) => {
		const response = await dashboard.getDecisionStats(req.params, req.query);
		res.jsend.success(response, "Decision Stats fetched successfully");
	}),

	averageScoreStats: catchAsync(async (req, res) => {
		const response = await dashboard.averageScoreStats(req.params);
		res.jsend.success(response, "Average score data fetched successfully.");
	}),

	getBusinessScoreRangeStats: catchAsync(async (req, res) => {
		const response = await dashboard.getBusinessScoreRangeStats(req.params);
		res.jsend.success(response, "Business Score Stats fetched successfully");
	}),

	getCustomerPortfolio: catchAsync(async (req, res) => {
		const response = await dashboard.getCustomerPortfolio(req.params, req.query);
		res.jsend.success(response, "Customer portfolio fetched successfully");
	}),

	industryExposure: catchAsync(async (req, res) => {
		const response = await dashboard.industryExposure(req.params);
		res.jsend.success(response, "Industry exposure details fetched successfully");
	}),
	totalApplications: catchAsync(async (req, res) => {
		const response = await dashboard.getTotalApplications(req.params, req.query);
		res.jsend.success(response, "Total applications fetched successfully");
	}),

	applicationReceivedApprovedStats: catchAsync(async (req, res) => {
		const response = await dashboard.applicationReceivedApprovedStats(req.params, req.query);
		res.jsend.success(response, "Application received and approved stats fetched successfully");
	}),

	teamPerformanceStats: catchAsync(async (req, res) => {
		const response = await dashboard.teamPerformanceStats(req.params, req.query);
		res.jsend.success(response, "Team performance stats fetched successfully");
	}),

	timeToApproval: catchAsync(async (req, res) => {
		const response = await dashboard.timeToApproval(req.params, req.query);
		res.jsend.success(response, "Time to approval stats fetched successfully");
	}),

	pipelineStats: catchAsync(async (req, res) => {
		const response = await dashboard.pipelineStats(req.params, req.query);
		res.jsend.success(response, "Pipeline stats fetched successfully");
	})
};
