import { catchAsync } from "#utils/index";
import { applicantConfig } from "./applicant-config";

export const controller = {
	getCustomerApplicantConfig: catchAsync(async (req, res) => {
		const response = await applicantConfig.getCustomerApplicantConfig(req.params);
		res.jsend.success(response, "Customer applicant config retrieved successfully");
	}),

	updateCustomerApplicantConfig: catchAsync(async (req, res) => {
		const response = await applicantConfig.updateCustomerApplicantConfig(req.params, req.body);
		res.jsend.success(response, "Customer applicant config updated successfully");
	}),

	updateCustomerApplicantStatus: catchAsync(async (req, res) => {
		const response = await applicantConfig.updateCustomerApplicantStatus(req.params, req.body);
		res.jsend.success(response, "Customer applicant status updated successfully");
	}),

	getBusinessApplicantConfig: catchAsync(async (req, res) => {
		const response = await applicantConfig.getBusinessApplicantConfig(req.params);
		res.jsend.success(response, "Business applicant config retrieved successfully");
	}),

	updateBusinessApplicantConfig: catchAsync(async (req, res) => {
		const response = await applicantConfig.updateBusinessApplicantConfig(req.params, req.body);
		res.jsend.success(response, "Business applicant config updated successfully");
	}),

	updateBusinessApplicantStatus: catchAsync(async (req, res) => {
		const response = await applicantConfig.updateBusinessApplicantStatus(req.params, req.body);
		res.jsend.success(response, "Business applicant status updated successfully");
	})
};
