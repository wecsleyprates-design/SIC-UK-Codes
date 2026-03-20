import { catchAsync } from "#utils/catchAsync";
import { customerIntegrationSettings } from "./customer-integration-settings";

export const controller = {
	createOrUpdateCustomerIntegrationSettings: catchAsync(async (req, res) => {
		const { customerID, settings } = req.body;
		const response = await customerIntegrationSettings.createOrUpdate(customerID, settings, res.locals.user);
		const { message, ...data } = response;
		res.jsend.success(data, message);
	}),
	findById: catchAsync(async (req, res) => {
		const { customerID } = req.params;
		const response = await customerIntegrationSettings.findById(customerID);
		res.jsend.success(response, "Customer Integration Settings was successfully found");
	}),
	updateIntegrationStatusForCustomer: catchAsync(async (req, res) => {
		const { customerID } = req.params;
		const updates = req.body;
		const response = await customerIntegrationSettings.updateIntegrationStatusForCustomer(customerID, updates);
		res.jsend.success(response, "Integration status was updated successfully");
	}),
	getIntegrationStatusForCustomer: catchAsync(async (req, res) => {
		const { customerID } = req.params;
		const response = await customerIntegrationSettings.getIntegrationStatusForCustomer(customerID);
		res.jsend.success(response, "Integration status fetched successfully");
	}),
	syncAllFromCaseSettings: catchAsync(async (req, res) => {
		const result = await customerIntegrationSettings.syncAllCustomers(res.locals.user);
		res.jsend.success(result, "Sync completed");
	}),
	patchCustomerIntegrationSetting: catchAsync(async (req, res) => {
		const { customerID, integrationName } = req.params;
		const updates = req.body;
		const response = await customerIntegrationSettings.updateSingleIntegrationSetting(
			customerID,
			integrationName,
			updates,
			res.locals.user
		);
		const { message, ...data } = response;
		res.jsend.success(data, message);
	})
};
