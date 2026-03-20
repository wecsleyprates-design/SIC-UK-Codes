import { catchAsync } from "#utils/catchAsync";
import Bull, { type JobStatusClean } from "bull";
import queueManager from "./queueManager";
import BullQueue from "#helpers/bull-queue";

export const controller = {
	getAllQueues: catchAsync(async (req, res) => {
		const response = await queueManager.getAllQueues();
		res.jsend.success(response, response.message);
	}),
	getJobByID: catchAsync(async (req, res) => {
		const response = await queueManager.getJobByID(req.params.jobID);
		res.jsend.success(response, "Job fetched successfully");
	}),
	getJobsByRequestID: catchAsync(async (req, res) => {
		const response = await queueManager.getJobsByRequest(req.params.requestID);
		res.jsend.success(response, "Jobs for request fetched successfully");
	}),
	removeJobByID: catchAsync(async (req, res) => {
		const { jobID, queueName } = req.params;
		const queue = new Bull(queueName);
		const job = await queue.getJob(jobID);
		await job?.remove();
		res.jsend.success("Job removed successfully");
	}),
	removeAllJobsByQueueName: catchAsync(async (req, res) => {
		const validStates = ["wait", "active", "failed", "completed", "delayed", "all"];
		const { queueName } = req.params;
		const { state } = req.query;
		let stateToClean: JobStatusClean | "all" = "completed";
		if (state) {
			if (typeof state !== "string") {
				return res.jsend.error(`Invalid state ${state}`, 400);
			}
			stateToClean = state.toLowerCase() as JobStatusClean | "all";
			if (!validStates.includes(stateToClean)) {
				return res.jsend.error(`Invalid state ${state}`, 400);
			}
		}
		const bullQueue = new BullQueue(queueName);
		const startingJobs = await bullQueue.queue.getJobCounts();
		if (stateToClean === "all") {
			await bullQueue.queue.obliterate({ force: true });
		} else {
			// The clean method only accepts JobStatusClean, not "all"
			await bullQueue.queue.clean(0, stateToClean as JobStatusClean);
		}
		const currentJobs = await bullQueue.queue.getJobCounts();
		res.jsend.success(`${state} jobs removed successfully`, {
			queueName: bullQueue.queue.name,
			startingJobs,
			currentJobs
		});
	}),
	getStalledCounts: catchAsync(async (req, res) => {
		const response = await queueManager.getStalledCounts(req.params.queueName);
		res.jsend.success(response, "Stalled counts fetched successfully");
	}),
	getJobStalledStats: catchAsync(async (req, res) => {
		const response = await queueManager.getJobStalledStats(req.params.queueName, req.params.jobID);
		res.jsend.success(response, "Job stalled stats fetched successfully");
	}),
	resetStats: catchAsync(async (req, res) => {
		const { queueName } = req.params;
		await queueManager.resetStats(queueName);
		res.jsend.success("Stats reset successfully for queue " + queueName);
	})
};
