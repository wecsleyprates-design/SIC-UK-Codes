import { KYX } from "#lib/kyx/kyx";
import { genericBusinessEnqueue } from "#helpers/bull-queue";
import { catchAsync } from "#utils/index";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { VerificationApiError } from "../verification/error";
import { taskQueue } from "#workers/taskHandler";
import { UUID } from "crypto";

export const controller = {
	kyxMatch: catchAsync(async (req, res) => {
		const impl = KYX.enqueueKyxRequest;
		await genericBusinessEnqueue(impl, req, res);
	}),
	getKYXMatch: catchAsync(async (req, res) => {
		const response = await KYX.getKYXResult(req.params);
		if (Object.keys(response).length === 0) {			
			res.jsend.success({}, "There is no KYX data for this business.");
		}
		res.jsend.success(response, "Business KYX result fetched successfully.");
	}),
	getJobStatus: catchAsync(async (req, res) => {
		const jobId = req.params.jobId;
		const job = await taskQueue.getJobByID(jobId);

		if (!job) {
			throw new VerificationApiError(`Job not found: ${jobId}`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		const state = await job.getState();
		const error = job.failedReason; // Contains error message if job failed

		let data = null;
		if (state === "completed") {
			const businessId: UUID = job.data.request.business_id;
			data = await KYX.getKYXResult({ businessId });
		}

		res.jsend.success({
			jobId,
			state,
			error: error ?? null,
			data: data ?? null
		});
	}),
};
