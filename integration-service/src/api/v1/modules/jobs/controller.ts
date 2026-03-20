import type { Egg, PaginatedResponse } from "#types/eggPattern";
import type { Response, Request } from "#types/index";
import { catchAsync, isUUID } from "#utils/index";
import type { UUID } from "crypto";
import { Job } from "./models/job";
import { JobRequest } from "./models/jobRequest";
import { IJobRequest as JobRequestType, IJob, State, JobTrigger, type IJobRequest, JobType } from "./types";
import { enumToValue, ERROR_CODES, ROLES } from "#constants";
import { JobApiError } from "./error";
import { JOB_TYPE_HANDLER } from ".";
import { StatusCodes } from "http-status-codes";

// TODO: Need to be added to postman collection.
export const controller = {
	createRequest: catchAsync(async (req, res: Response) => {
		const egg: Egg<JobRequestType> = {
			type: JobType.UNKNOWN,
			state: State.CREATED,
			trigger: JobTrigger.API,
			...(req.body as Partial<Egg<JobRequestType>>),
			created_by: res.locals?.user?.user_id as UUID
		};
		const response = await JobRequest.create(egg);

		res.jsend.success(response.toApiResponse(), "Request created");
	}),
	getRequestsByCustomer: catchAsync(async (req, res: Response, next) => {
		const { customer_id }: { customer_id?: UUID } = req.params;
		const { page, type } = req.query;
		let query: Partial<IJobRequest> = { customer_id };
		if (type) {
			query.type = enumToValue(JobType, type) ?? JobType.UNKNOWN;
		}
		const apiRequest = await enforceCustomerAccess<PaginatedResponse<JobRequest, JobRequestType>>(req, res, () =>
			JobRequest.findByField(query, page)
		);
		if (!apiRequest) {
			return res.jsend.error("Request not found", StatusCodes.NOT_FOUND);
		}
		const [data, pagination] = apiRequest;
		req.paginate = [JobRequest.unwrap(data), pagination];
		next();
	}),
	getAll: catchAsync(async (req, res: Response, next) => {
		const { page }: { page: number } = req.query;
		const [data, pagination] = await JobRequest.getAllPaginated({ page });
		req.paginate = [JobRequest.unwrap(data), pagination];
		next();
	}),
	getRequest: catchAsync(async (req: Request, res: Response) => {
		const { request_id } = req.params as { request_id?: string }; // Accept as string
		if (!request_id || !isUUID(request_id)) {
			return res.jsend.error("Invalid request id", StatusCodes.BAD_REQUEST);
		}

		const request = await enforceCustomerAccess<JobRequest>(req, res, () => JobRequest.getById(request_id));
		if (request) {
			return res.jsend.success(request.toApiResponse(), "Request fetched");
		}
		res.jsend.error("Request not found", StatusCodes.NOT_FOUND);
	}),
	getRequestEnriched: catchAsync(async (req: Request, res: Response) => {
		const { request_id, customer_id }: { request_id?: UUID; customer_id?: UUID } = req.params;
		if (!request_id || !isUUID(request_id)) {
			return res.jsend.error("Request not found", StatusCodes.NOT_FOUND);
		}
		const jobRequest = await JobRequest.getById(request_id);
		if (!jobRequest) {
			return res.jsend.error("Request not found", StatusCodes.NOT_FOUND);
		}
		handleCustomerScope(res, jobRequest);
		const enriched = await jobRequest.getEnriched();
		return res.jsend.success(enriched, "Request enriched");
	}),
	/** Jobs */
	// Leave Jobs encrypted over the API, metadata can contain PII. No need to pass PII over the network unencrypted.
	// Anything receiving the response ought to be able to decrypt if needed.
	createJob: catchAsync(async (req: Request, res: Response) => {
		const { request_id }: { request_id?: UUID } = req.params;
		const egg: Egg<IJob> = {
			request_id,
			state: State.CREATED,
			...(req.body as Partial<Egg<JobType>>)
		};
		const job = await Job.create(egg);
		const response = job.encrypt();

		res.jsend.success(response.toApiResponse(), "Job created");
	}),
	getJobsByRequest: catchAsync(async (req: Request, res: Response, next) => {
		const { request_id }: { request_id?: UUID } = req.params;
		const { page, decrypt } = req.query;
		if (!request_id || !isUUID(request_id)) {
			return res.jsend.error("Request not found", StatusCodes.NOT_FOUND);
		}
		const isUserAdmin = res.locals?.user?.role?.code === ROLES.ADMIN;
		const decryptFlag = isUserAdmin && typeof decrypt === "string" && decrypt === "true";
		const apiRequest = await enforceCustomerAccess<PaginatedResponse<Job, IJob>>(req, res, () =>
			Job.findByRequestId(request_id, { page }, decryptFlag)
		);
		if (!apiRequest) {
			return res.jsend.error("Request not found", StatusCodes.NOT_FOUND);
		}
		const [data, pagination] = apiRequest;
		req.paginate = [Job.unwrap<Job, IJob>(data), pagination];
		next();
	}),

	getJobEnriched: catchAsync(async (req, res) => {
		const { job_id } = req.params;
		const job = await Job.getById(job_id);
		if (job) {
			const enriched = await job.getEnriched();
			return res.jsend.success(enriched, "Job fetched");
		}
		return res.jsend.error("Job not found", StatusCodes.NOT_FOUND);
	}),
	getJob: catchAsync(async (req, res) => {
		const { job_id } = req.params;
		const job = await Job.getById(job_id);
		if (job) {
			return res.jsend.success(job.toApiResponse(), "Job fetched");
		}
		return res.jsend.error("Job not found", StatusCodes.NOT_FOUND);
	}),
	patchJob: catchAsync(async (req, res) => {
		const { job_id }: { job_id: UUID } = req.params;
		const { decrypt }: { decrypt?: boolean } = req.query;
		const isUserAdmin = res.locals?.user?.role?.code === ROLES.ADMIN;
		const decryptFlag = isUserAdmin && decrypt ? true : false;
		const job = await Job.getById(job_id);
		if (job) {
			const updatedJob: Job = await job.encrypt().updateMetadata(req.body.metadata ?? {});
			const record = decryptFlag ? updatedJob.decrypt().toApiResponse() : updatedJob.toApiResponse();
			return res.jsend.success(record, `Job ${job_id} updated`);
		}
		return res.jsend.error("Job not found", StatusCodes.NOT_FOUND);
	}),
	executeJob: catchAsync(async (req, res: Response) => {
		const { job_id }: { job_id: UUID } = req.params;
		const {
			execute,
			force,
			decrypt
		}: { execute: string | undefined; force: string | undefined; decrypt: string | undefined } = req.query;
		if (!execute) {
			return res.jsend.error("Execute parameter is required", StatusCodes.BAD_REQUEST);
		}

		const job = await Job.getById(job_id);
		if (!job?.getRecord()?.request_id) {
			return res.jsend.error("Job not found", StatusCodes.NOT_FOUND);
		}
		if (!force && job.getRecord().completed_at !== null) {
			return res.jsend.error("Job already completed", StatusCodes.BAD_REQUEST);
		}
		const jobRequest = await JobRequest.getById(job.getRecord().request_id);
		if (!jobRequest) {
			return res.jsend.error("Request not found", StatusCodes.NOT_FOUND);
		}
		const jobType = enumToValue(JobType, jobRequest.getRecord().type) ?? JobType.UNKNOWN;
		const jobTypeHandler = JOB_TYPE_HANDLER[jobType];
		if (!jobTypeHandler) {
			return res.jsend.error("Invalid job type", StatusCodes.BAD_REQUEST);
		}

		if (!jobTypeHandler[execute] || typeof jobTypeHandler[execute] !== "function") {
			const validExecutionModes = Object.keys(jobTypeHandler).join(", ");
			return res.jsend.error(
				`Invalid execution mode: ${execute}. Valid execution modes: ${validExecutionModes} for job type ${jobRequest.toApiResponse().type}`,
				StatusCodes.BAD_REQUEST
			);
		}
		const isUserAdmin = res.locals?.user?.role?.code === ROLES.ADMIN;
		const decryptFlag = isUserAdmin && decrypt ? true : false;
		await jobTypeHandler[execute](job);
		const updatedJob = await Job.getById(job_id);
		return res.jsend.success(
			updatedJob[decryptFlag ? "decrypt" : "encrypt"]().toApiResponse(),
			`Job ${job_id} executed in ${execute} mode`
		);
	})
};

////// Utils for these routes -- may consider moving to a global-ish utils file and exporting them for other controllers to use

/**
 *  Pull the customer ID from the request context if the user is a customer role
 */
function getUserCustomerId(res: Response): UUID | undefined {
	if (res.locals?.user?.role?.code === ROLES.CUSTOMER) {
		return res.locals?.user?.customer_id;
	}
}

/**
 * Throw if this is a customer-scoped route and the customer ID in the response does not match the customer ID in the request
 * For multi-object responses, throw if any object does not have the customer ID in the request
 * @param res
 * @param apiObject
 * @param customerKey
 */
function handleCustomerScope<T extends any>(
	res: Response,
	apiObject: T | Array<T>,
	customerKey: string = "customer_id"
) {
	const extractedCustomerId = getUserCustomerId(res);

	const hasAccess = objectToTest => {
		if (extractedCustomerId && customerKey in objectToTest && objectToTest[customerKey] !== extractedCustomerId) {
			return false;
		}
		return true;
	};

	if (!Array.isArray(apiObject)) {
		apiObject = [apiObject];
	}

	if (Array.isArray(apiObject)) {
		const isOk = apiObject.every(item => hasAccess(item));
		if (!isOk) {
			throw new JobApiError(ERROR_CODES.UNAUTHORIZED, "Forbidden");
		}
	}
}
/**
 * Shortcut factory for enforcing customer access to an API object.
 * Needs to return the object(s) and then inspect the object(s) to ensure the customer has access
 * @param req
 * @param res
 * @param getApiObject
 * @returns
 */
async function enforceCustomerAccess<T extends any>(
	req: Request,
	res: Response,
	getApiObject: () => Promise<T>,
	customerKey: string = "customer_id"
): Promise<T | undefined> {
	try {
		const { customer_id } = req.params;
		const extractedCustomerId = getUserCustomerId(res);
		if (extractedCustomerId && extractedCustomerId !== customer_id) {
			throw new JobApiError(ERROR_CODES.UNAUTHORIZED, "Forbidden");
		}
		const apiObject = await getApiObject();
		if (apiObject !== undefined && apiObject !== null) {
			handleCustomerScope<T>(res, apiObject, customerKey);
		}
		return apiObject;
	} catch (error) {
		// If it throws for any reason, rethrow as a JobApiError
		throw new JobApiError(ERROR_CODES.UNAUTHORIZED, "Forbidden");
	}
}
