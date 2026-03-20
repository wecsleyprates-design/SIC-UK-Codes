import { Job } from "#api/v1/modules/jobs/models";
import { State } from "#api/v1/modules/jobs/types";
import { EVENTS, QUEUES } from "#constants";
import { internalProcessCustomerBusiness } from "#helpers/api";
import BullQueue, { runJob } from "#helpers/bull-queue";
import { logger } from "#helpers/logger";
import type { FileUploadEvent } from "#lib/fileHandler";
import { encryptData } from "#utils/encryption";
import { isAxiosError } from "axios";
import type { Job as BullJob } from "bull";
import type { UUID } from "crypto";

export type ProcessBusinessJobMetadata<T = any> = {
	customer_id: UUID;
	process_request_id: UUID;
	index: number;
	data: string; // csv string
	headers: string; // csv string
	_encrypted: boolean; // Essentially private flag to indicate data is encrypted
	event: FileUploadEvent;
	file_id?: UUID;
	response?: T;
};

export const initBusinessImportJobWorker = async () => {
	const bullQueue = new BullQueue(QUEUES.JOB);

	bullQueue.queue.process(EVENTS.BUSINESS_IMPORT, async (job: BullJob, done) => {
		try {
			await runJob(job, done, runProcess);
		} catch (error: unknown) {
			if (error instanceof Error) {
				logger.error(
					{ error, job: job },
					`[businessImportJobWorker] Error processing business import job ${job.id} : ${error.toString()}`
				);
			}
		}
	});
};

export const runSynchronously = async (job: Job): Promise<void> => {
	await runProcess({ id: job.getRecord().id } as Pick<BullJob, "id">);
};

const runProcess = async (bullJob: Pick<BullJob, "id">): Promise<void> => {
	let job: Job | null = null;
	try {
		// Decrypt job when fetching from DB
		job = (await Job.getById(bullJob.id as UUID)).decrypt();
	} catch (error: unknown) {
		logger.error(
			{ error, bullJob, job: job?.toApiResponse() },
			`[businessImportJobWorker] Business import job ${bullJob.id} not found in database`
		);
	}
	if (!job?.getRecord()?.id) {
		return;
	}
	await job.setState(State.STARTED, true);
	const { customer_id, metadata } = job.getRecord();
	if (!customer_id || !metadata || !metadata.data || !metadata.headers) {
		await job.setState(State.ERROR, true);
		return;
	}
	const { data, headers } = metadata as ProcessBusinessJobMetadata;
	const processRequest = [headers, data];

	try {
		const response = await internalProcessCustomerBusiness(customer_id as UUID, processRequest);
		// Since updateMetadata is an inherited method, we need to re-encrypt the job before updating metadata
		// we also need to encrypt the response data as it can contain sensitive information about owners including: SSN
		await job.encrypt().updateMetadata({ response: encryptData(response) });
		if (response?.result?.[0]?.data_businesses?.id) {
			await job.setState(State.SUCCESS, true, {
				business: response?.result?.[0]?.data_businesses,
				case: response?.result?.[0]?.data_cases
			});
			await job.setBusinessId(response.result[0].data_businesses.id);
		} else {
			await job.setState(State.ERROR, true);
		}
	} catch (error: unknown) {
		logger.error({ error, job: job.toApiResponse() }, "[businessImportJobWorker] Error in runProcess");
		if (isAxiosError(error)) {
			// Out of caution we encrypt the response data as it can contain sensitive information about owners including: SSN
			await Promise.all([
				job.encrypt().updateMetadata({ response: encryptData(error.response?.data) }),
				job.setState(State.ERROR, true, { error: encryptData(error.response?.data), _encrypted: true })
			]);
		} else {
			await job.setState(State.ERROR, true, { error: error });
		}
	}
};
