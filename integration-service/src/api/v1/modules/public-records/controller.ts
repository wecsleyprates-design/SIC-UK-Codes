import { catchAsync } from "#utils/index";
import { publicRecords } from "./public-records";
import { VerdataUtil } from "#lib/verdata/verdataUtil";
import { genericBusinessEnqueue } from "#helpers/bull-queue";
import { getConnectionByTaskId, platformFactory } from "#helpers/platformHelper";
import { Verdata } from "#lib/verdata/verdata";

export const controller = {
	getPublicRecords: catchAsync(async (req, res) => {
		const response = await publicRecords.getPublicRecords(req.params, req.query);
		res.jsend.success(response.data, response.message);
	}),

	getGoogleReviews: catchAsync(async (req, res) => {
		const response = await publicRecords.getGoogleReviews(req.params, req.query);
		res.jsend.success(response.data, response.message);
	}),

	getBusinessRatings: catchAsync(async (req, res) => {
		const response = await publicRecords.getBusinessRatings(req.params, req.query);
		res.jsend.success(response, "Ratings fetched successfully");
	}),

	businessAPIConsentInit: catchAsync(async (req, res) => {
		const response = await publicRecords.businessAPIConsentInit(req.body, req.params);
		res.jsend.success(response, "Successfully created oauth consent URL");
	}),

	fetchGoogleBusinessReviews: catchAsync(async (req, res) => {
		const response = await publicRecords.fetchGoogleBusinessReviews(req.body, req.params);
		res.jsend.success(response, response.message);
	}),
	enrich: catchAsync(async (req, res) => {
		const impl = VerdataUtil.enqueueEnrichRequest;
		await genericBusinessEnqueue(impl, req, res);
	}),
	updatePublicRecordsPercentage: catchAsync(async (req, res) => {
		const response = await publicRecords.updatePublicRecordsPercentage();
		res.jsend.success(response, "Successfully update Percentage");
	}),
	getBusinessesData: catchAsync(async (req, res) => {
		const response = await publicRecords.getBusinessesData(req.params, res.locals.user, req.headers.authorization);
		res.header("Content-Type", "text/csv");
		res.attachment(`${req.params.customerID}.csv`);
		res.send(response);
	}),
	handleVerdataWebhook: catchAsync(async (req, res) => {
		const response = await VerdataUtil.handleVerdataWebhook(req.body, req.query);
		res.jsend.success(response, "Successfully handle Verdata Webhook");
	}),
	forceVerdataTaskRun: catchAsync(async (req, res) => {
		const dbConnection = await getConnectionByTaskId(req.params.taskId);
		if (!dbConnection) {
			return res.jsend.error("No connection to database");
		}
		const verdata = new Verdata(dbConnection);
		const response = await verdata.processFetchPublicRecordsTask(req.params.taskId);
		res.jsend.success(response, "Successfully force Verdata Task Run");
	})
};
