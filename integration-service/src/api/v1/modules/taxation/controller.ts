import { catchAsync } from "#utils/index";
import { taxation } from "./taxation";

// ⚠️⚠️ TODO : taxation module should be merged with accounting module. As of today accounting module has been convereted to have typescript code,
// to minimize efforts this module has been separated from accounting as the implementation was done in javascript but taxation needs to be merged in future ⚠️⚠️

export const controller = {
	getTaxFilings: catchAsync(async (req, res) => {
		const response = await taxation.getTaxFilings(req.params, req.query);
		res.jsend.success(response.data, response.message);
	}),

	taxStatusWebHookHandler: catchAsync(async (req, res) => {
		const response = await taxation.taxStatusWebHookHandler(req.body, req.params);
		res.jsend.success(response, "success");
	}),

	getTaxStats: catchAsync(async (req, res) => {
		const response = await taxation.getTaxStats(req.params, req.query);
		res.jsend.success(response.data, response.message);
	}),

	taxFilingDataFetch: catchAsync(async (req, res) => {
		const response = await taxation.taxFilingDataFetch(req.params, req.query);
		res.jsend.success(response, "Success");
	}),

	fetchAllCasesData: catchAsync(async (req, res) => {
		const response = await taxation.fetchAllCasesData(req.query);
		res.jsend.success(response, "Success");
	}),

	addTaxFiling: catchAsync(async (req, res) => {
		const response = await taxation.addTaxFiling(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Success");
	})
};
