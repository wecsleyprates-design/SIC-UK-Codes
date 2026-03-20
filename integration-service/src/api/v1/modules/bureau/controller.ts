import {
	DIRECTORIES,
	FEATURE_FLAGS,
	INTEGRATION_ENABLE_STATUS,
	INTEGRATION_ID,
	ROLES,
	INTEGRATION_SETTING_KEYS
} from "#constants";
import { getConnectionForBusinessAndPlatform, getOrCreateConnection } from "#helpers/platformHelper";
import { Equifax } from "#lib/equifax";
import type { Response } from "#types/index";
import { catchAsync, getCachedSignedUrl, streamFile } from "#utils/index";
import { UUID } from "crypto";
import type { Request } from "express";
import { TaskManager } from "../tasks/taskManager";
import { bureau } from "./bureau";
import { EquifaxUtil } from "#lib/equifax/equifaxUtil";
import { genericBusinessEnqueue } from "#helpers/bull-queue";
import { getCustomerBusinessConfigs, getOwners, internalGetCaseByID } from "#helpers/api";
import { checkPermission, db, getFlagValue, logger } from "#helpers/index";
import { getJSONFromS3 } from "#common/index";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { updateConnectionByConnectionId } from "#helpers/platformHelper";
import { CONNECTION_STATUS } from "#constants";

interface OwnerReport {
	fileName: any;
	signedRequest: string;
	url: string;
}

const fetchAndStreamReportPdf = async (
	business_id: UUID,
	owner_id: UUID,
	user: any,
	res: Response,
	return_path = false,
	case_id?: UUID
) => {
	let customerID;
	if (user?.role?.code === ROLES.ADMIN && case_id) {
		const caseDetail = await internalGetCaseByID(case_id);
		customerID = caseDetail?.customer_id;
	}
	if (user?.role?.code === ROLES.CUSTOMER) {
		customerID = user?.customer_id;
	}
	if (customerID) {
		const customerSettings = await db("public.data_customer_integration_settings")
			.select("settings")
			.where("customer_id", customerID)
			.first();
		if (!customerSettings || !customerSettings.settings) {
			throw new Error("Customer settings not found");
		}
		const setting = customerSettings.settings[INTEGRATION_SETTING_KEYS.EQUIFAX];
		if (setting.status !== INTEGRATION_ENABLE_STATUS.ACTIVE) {
			throw new Error("Equifax Score Customer Setting Disabled");
		}
		const customerBusinessConfigs = await getCustomerBusinessConfigs(customerID, business_id);
		const businessEquifaxSetting = customerBusinessConfigs?.[0]?.config.skip_credit_check;
		if (businessEquifaxSetting) {
			throw new Error("Equifax Score Customer Setting Disabled");
		}
	} else {
		// TODO: Make this flag value dynamic based on the global config of standalone case
		// This is a temporary flag to disable fetching credit report for standalone tasks
		const fetchCreditReportForStandaloneTasks = false;
		if (!fetchCreditReportForStandaloneTasks) {
			throw new Error("Credit Check for standalone tasks is disabled");
		}
	}
	const equifax = await strategyPlatformFactory<Equifax>({
		businessID: business_id as UUID,
		platformID: INTEGRATION_ID.EQUIFAX,
		customerID
	});
	const flag = await getFlagValue(FEATURE_FLAGS.PAT_763_CREDIT_BUREAU_REPORT_BUG);
	if (flag) {
		const links = await equifax.getPdfLinks(owner_id as UUID);
		const directory = DIRECTORIES.EQUIFAX.replace(":businessID", business_id).replace(
			":integrationPlatform",
			"equifax"
		);
		for (const link of links) {
			const path = `${directory}/${link}.pdf`;
			try {
				const filejson = await getJSONFromS3(path, false);
				if (return_path) {
					if (typeof filejson === "string") {
						return getCachedSignedUrl(`${link}.pdf`, directory);
					}
				} else {
					streamFile(res, `${link}.pdf`, path, { logError: false });
				}
			} catch (ex) {
				logger.error(ex, "Error fetching or streaming PDF from S3");
			}
		}
	} else {
		const link = await equifax.getPdfLink(owner_id as UUID);
		const directory = DIRECTORIES.EQUIFAX.replace(":businessID", business_id).replace(
			":integrationPlatform",
			"equifax"
		);
		const path = `${directory}/${link}.pdf`;
		const filejson = await getJSONFromS3(path);
		if (return_path) {
			if (typeof filejson === "string") {
				return getCachedSignedUrl(`${link}.pdf`, directory);
			}
			return {} as OwnerReport;
		}
		streamFile(res, `${link}.pdf`, path, { logError: false });
	}
};

export const controller = {
	enroll: catchAsync(async (req: Request, res: Response) => {
		const { business_id } = req.params;

		const connection = await getOrCreateConnection(business_id as UUID, INTEGRATION_ID.EQUIFAX);
		await updateConnectionByConnectionId(connection.id, CONNECTION_STATUS.SUCCESS, connection.configuration);
		const equifax = await strategyPlatformFactory<Equifax>({ dbConnection: connection });

		await equifax.ensureTasksExist();
		const tasks = await equifax.processPendingTasks();

		const out = {
			connection: equifax.getDbConnectionId(),
			tasks
		};

		res.jsend.success(out);
	}),
	getBusinessOwnerScores: catchAsync(async (req: Request, res: Response) => {
		const { business_id } = req.params;
		const { case_id, business_score_trigger_id } = req.query;
		const equifax = await strategyPlatformFactory<Equifax>({
			businessID: business_id as UUID,
			platformID: INTEGRATION_ID.EQUIFAX
		});
		const out = await equifax.getOwnerScores({
			case_id: case_id as string,
			score_trigger_id: business_score_trigger_id as string
		});
		res.jsend.success(out);
	}),

	getCustomerBusinessOwnerScores: catchAsync(async (req: Request, res: Response) => {
		const { business_id, customer_id } = req.params;
		const { case_id, business_score_trigger_id } = req.query;
		// if customer role, then check for case:read:credit_score permission
		const hasPermission = await checkPermission({ ...res.locals.user, customer_id: customer_id as UUID }, "case:read:credit_score");

		const response = await bureau.getCustomerBusinessOwnerScores({
			business_id: business_id as UUID,
			customer_id: customer_id as UUID,
			case_id: case_id as string,
			score_trigger_id: business_score_trigger_id as string,
			hasPermission: hasPermission
		});
		res.jsend.success(response, "Owner scores fetched successfully");
	}),

	getBusinessOwnerScoresLatest: catchAsync(async (req: Request, res: Response) => {
		const { business_id } = req.params;
		const equifax = await strategyPlatformFactory<Equifax>({
			businessID: business_id as UUID,
			platformID: INTEGRATION_ID.EQUIFAX
		});
		const out = await equifax.getOwnerScores({ latest: true });
		res.jsend.success(out);
	}),
	getUserCreditScore: catchAsync(async (req: Request, res: Response) => {
		const { business_id } = req.params;
		const equifax = await strategyPlatformFactory<Equifax>({
			businessID: business_id as UUID,
			platformID: INTEGRATION_ID.EQUIFAX
		});

		if (!res.locals?.user?.email) {
			throw new Error(`User email is required to fetch credit score`);
		}
		const userEmail = res.locals.user.email;
		const out = await equifax.getUserCreditScore(userEmail);
		res.jsend.success(out);
	}),
	getReport: catchAsync(async (req: Request, res: Response) => {
		const { business_id } = req.params;
		const { case_id, business_score_trigger_id } = req.query;
		try {
			const business_owners = await getOwners(business_id as UUID);

			if (!business_owners || business_owners.length === 0) {
				return res.jsend.success({ message: "No owners found for the business." });
			}

			const response: Record<string, OwnerReport | undefined> = {};

			await Promise.all(
				business_owners.map(async owner => {
					try {
						const reportFilePath = await fetchAndStreamReportPdf(
							business_id as UUID,
							owner.id,
							res.locals.user,
							res,
							true,
							case_id as UUID
						);
						response[owner.id] = reportFilePath;
					} catch (err) {
						if (err instanceof Error) {
							// TODO: Fix this --- it is a brittle comparison. https://worth-ai.atlassian.net/browse/PAT-1079
							if (err.message === "Equifax Score Customer Setting Disabled") {
								logger.warn(`Equifax setting disabled for customer: ${res.locals.user?.customer_id}`);
							} else {
								logger.warn(`Error fetching report for owner_id: ${owner.id}, ${err.message}`);
							}
							response[owner.id] = { url: `${err.message}` } as OwnerReport;
						} else {
							logger.error(
								{ err, owner },
								`Unknown error fetching report for owner_id: ${owner.id}, ${JSON.stringify(err)}`
							);
							response[owner.id] = { url: "An unknown error occurred" } as OwnerReport;
						}
					}
				})
			);
			res.jsend.success(response, "Report Signed URLs fetched successfully");
		} catch (error) {
			throw error;
		}
	}),
	getReportPdf: catchAsync(async (req: Request, res: Response) => {
		const { business_id, owner_id } = req.params;
		//we need extra validation that owner_id == requesting user
		const user = res.locals.user;
		if (user?.role?.code !== "admin" && user?.user_id !== owner_id) {
			throw new Error("You are not authorized to access this resource");
		}
		await fetchAndStreamReportPdf(business_id as UUID, owner_id as UUID, user, res);
	}),
	matchBusinessToEquifax: catchAsync(async (req: Request, res: Response) => {
		const { business_id: businessID, customer_id: customerID } = req.params;
		const { date } = req.query;
		const reportDate = new Date(Date.parse(date as string) || Date.now());
		const dbConnection = await getConnectionForBusinessAndPlatform(businessID as UUID, INTEGRATION_ID.EQUIFAX);
		if (dbConnection) {
			const equifax = await strategyPlatformFactory<Equifax>({ dbConnection });
			const taskId = await equifax.getOrCreateTaskForCode({
				taskCode: "fetch_public_records",
				reference_id: businessID,
				metadata: { reportDate, customerID }
			});
			await equifax.processTask({ taskId });
			const task = await TaskManager.getEnrichedTask(taskId);
			const out = task.metadata?.result;
			if (out?.report) {
				res.jsend.success(out, "Bureau Report Found");
			} else if (out?.matches) {
				res.jsend.fail(out, "Bureau Report not found, but business match found");
			} else {
				res.jsend.fail(out, "Business could not be matched");
			}
		}
	}),
	equifaxMatchBulk: catchAsync(async (req, res) => {
		const impl = EquifaxUtil.enqueueMatchRequest;
		await genericBusinessEnqueue(impl, req, res);
	})
};
