import { customer } from "./customer";
import { catchAsync } from "#utils/index";

export const controller = {
	prepareCustomerAuthorizationCache: catchAsync(async (req, res) => {
		const response = await customer.prepareCustomerAuthorizationCache();
		res.jsend.success(response, "All customer businesses stored in Redis successfully.");
	}),
	updateCustomerAuthorizationCache: catchAsync(async (req, res) => {
		const response = await customer.updateCustomerAuthorizationCache(req.params.customerID);
		res.jsend.success(response, "Customer businesses stored in Redis successfully.");
	}),

	getCustomerInviteForApplicationEdit: catchAsync(async (req, res) => {
		const response = await customer.getCustomerInviteForApplicationEdit(req.params, req.query, res.locals.user);
		res.jsend.success(response, "Invite created successfully");
	}),

	getApplicationEditSessions: catchAsync(async (req, res) => {
		const response = await customer.getApplicationEditSessions(req.params);
		res.jsend.success(response, "Application edit sessions retrieved successfully");
	})
};
