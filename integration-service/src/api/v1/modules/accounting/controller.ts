import { CONNECTION_STATUS, INTEGRATION_ID, kafkaEvents, kafkaTopics, WEBHOOK_EVENTS } from "#constants";
import { logger } from "#helpers/logger";
import { getConnectionForBusinessAndPlatform, platformFactory } from "#helpers/platformHelper";
import { Rutter } from "#lib/rutter/index";
import type { IDBConnection, Response } from "#types/index";
import { catchAsync } from "#utils/index";
import type { UUID } from "crypto";
import type { NextFunction, Request } from "express";
import { StatusCodes } from "http-status-codes";
import { AccountingRest } from "./accountingRest";
import { AccountingApiError } from "./error";
import type { ObjectTable, ReportTable } from "./types";
import { executeOtherTasksOnApplicationEdit, sendKafkaEventForSection, sendWebhookEvent, triggerSectionCompletedKafkaEventWithRedis } from "#common/index";
import { db } from "#helpers/knex";
import { producer } from "#helpers/kafka";
import { redis } from "#helpers";

export const controller = {
	/* Generic */
	// Retrieve all accounting integrations
	getIntegrations: catchAsync(async (req: Request, res: Response) => {
		const { business_id } = req.params;
		const businessID = business_id as UUID;

		const integrations = await AccountingRest.getAllAccountingIntegrations({ businessID });
		res.jsend.success(integrations);
	}),
	getReport: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const { page } = req.query;
		const { case_id, business_id, task_id } = req.params as Record<string, any>;
		const report = await AccountingRest.getReport({ business_id, case_id, task_id, report: req.params.report as ReportTable, page: Number(page) || 1, params: req.query });
		res.jsend.success(report);
	}),
	getReportById: catchAsync(async (req: Request, res: Response) => {
		const id = req.params.id as UUID;
		const result = await AccountingRest.getReport({ business_id: req.params.business_id as UUID, report: req.params.report as ReportTable, params: { id } });
		if (result) {
			res.jsend.success(result);
		} else {
			res.jsend.error({ message: `no object with id ${id} found`, code: StatusCodes.NOT_FOUND });
		}
	}),
	getBalanceSheet: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const caseID = req.query?.caseID as UUID;
		const result = await AccountingRest.getBalanceSheet({ businessID: req.params.business_id, caseID });
		res.jsend.success(result);
	}),
	getIncomeStatement: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const caseID = req.query?.caseID as UUID;
		const result = await AccountingRest.getIncomeStatement({ businessID: req.params.business_id, caseID });
		res.jsend.success(result);
	}),
	getObject: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const { page } = req.query;
		const result = await AccountingRest.getObject({ business_id: req.params.business_id as UUID, object: req.params.object as ObjectTable, page: Number(page) || 1, params: req.query });
		res.jsend.success(result);
	}),
	getObjectById: catchAsync(async (req: Request, res: Response) => {
		const id = req.params.id as UUID;
		const result = await AccountingRest.getObject({ business_id: req.params.business_id as UUID, object: req.params.object as ObjectTable, params: { id } });
		if (result) {
			res.jsend.success(result);
		} else {
			res.jsend.error({ message: `no object with id ${id} found`, code: StatusCodes.NOT_FOUND });
		}
	}),

	/* Rutter-specific */
	createRutterConnection: catchAsync(async (req: Request, res: Response) => {
		const { business_id, public_token } = req.params;
		const rutter = new Rutter();
		const connection: IDBConnection = await rutter.exchangeTokenForConnectionEgg(business_id as UUID, public_token).then(async egg => await rutter.initializeConnection(egg));
		logger.info({ connection }, "Connection Object");
		// Attempt to run tasks for the connection -- swallow & log exception if it happens as this is just a non-critical side effect of running the task immediately
		try {
			//Re-fetch the hopefully now complete connection
			const refetchedConnection: IDBConnection = await getConnectionForBusinessAndPlatform(business_id as UUID, connection.platform_id);
			const platform: Rutter = platformFactory({ dbConnection: refetchedConnection });
			const taskCompletion = await platform.processPendingTasks();
			const _platform = (Object.keys(INTEGRATION_ID) as Array<keyof typeof INTEGRATION_ID>).find(key => INTEGRATION_ID[key] === connection.platform_id);
			let rutterPlatform: string | undefined;

			if (_platform?.startsWith("RUTTER_")) {
				rutterPlatform = _platform.replace("RUTTER_", "").toLowerCase();
				// Capitalize the first letter of each word
				rutterPlatform = rutterPlatform
					.split("_")
					.map(word => word.charAt(0).toUpperCase() + word.slice(1))
					.join("");
			}

			if (taskCompletion && taskCompletion.totalProcessed > 0) {
				await platform.updateConnectionStatus(CONNECTION_STATUS.SUCCESS);
			}
			if (taskCompletion && (taskCompletion.totalFailed > 0 || taskCompletion.totalErrored > 0)) {
				logger.info({ connection }, "Connection Object");
				if (connection) {
					const caseRows = await db("public.data_cases")
						.select("public.data_cases.id", "public.data_cases.business_id")
						.leftJoin("integrations.data_business_integrations_tasks", "integrations.data_business_integrations_tasks.business_score_trigger_id", "public.data_cases.score_trigger_id")
						.where("integrations.data_business_integrations_tasks.connection_id", connection.id);
					logger.info({ case_rows: caseRows }, "Case Rows");
					const auditMessage = { business_id: caseRows[0].business_id, case_id: caseRows[0].id, integration_category: "Accounting", integration_platform: rutterPlatform };

					const customerDetailsRow = await db("integrations.business_score_triggers")
						.select("integrations.business_score_triggers.customer_id")
						.join("public.data_cases", "integrations.business_score_triggers.id", "public.data_cases.score_trigger_id")
						.where("public.data_cases.id", auditMessage.case_id)
						.first();

					logger.info({ customer_details_row: customerDetailsRow }, "Customer Row");
					await sendWebhookEvent(customerDetailsRow.customer_id, WEBHOOK_EVENTS.INTEGRATION_FAILED, auditMessage);
				// Create an audit log
				await producer.send({ 
					topic: kafkaTopics.NOTIFICATIONS, 
					messages: [{ 
						key: auditMessage.business_id, 
						value: { 
							event: kafkaEvents.INTEGRATION_DATA_FETCH_FAILED_AUDIT,
							...auditMessage 
						}
					}] 
				});
				}
			}
		} catch (ex) {
			logger.warn(ex, "Could not process tasks for connection");
		}
		if (connection) {
			const platform = (Object.keys(INTEGRATION_ID) as Array<keyof typeof INTEGRATION_ID>).find(key => INTEGRATION_ID[key] === connection.platform_id);
			let rutterPlatform: string | undefined;

			if (platform?.startsWith("RUTTER_")) {
				rutterPlatform = platform.replace("RUTTER_", "").toLowerCase();
				// Capitalize the first letter of each word
				rutterPlatform = rutterPlatform
					.split("_")
					.map(word => word.charAt(0).toUpperCase() + word.slice(1))
					.join("");
			}

			if (connection.connection_status === "SUCCESS" && Object.hasOwn(req.body, "connection_phase") && req.body.connection_phase === "POST_ONBOARDING") {
				await executeOtherTasksOnApplicationEdit(connection.platform_id, business_id, req.headers.authorization, {
					action: "connected",
					integration_category: "Accounting",
					integration_platform: rutterPlatform
				});
				return res.jsend.success(connection);
			} else if (
				(connection.connection_status === "SUCCESS" && Object.hasOwn(req.body, "connection_phase") && req.body.connection_phase !== "POST_ONBOARDING") ||
				(connection.connection_status === "SUCCESS" && !Object.hasOwn(req.body, "connection_phase"))
			) {
				const caseRows = await db("public.data_cases")
					.select("public.data_cases.id", "public.data_cases.business_id")
					.leftJoin("integrations.data_business_integrations_tasks", "integrations.data_business_integrations_tasks.business_score_trigger_id", "public.data_cases.score_trigger_id")
					.where("integrations.data_business_integrations_tasks.connection_id", connection.id);
				logger.info({ case_rows: caseRows }, "Case Rows");
				const auditMessage = { business_id: business_id, case_id: caseRows[0].id, integration_category: "Accounting", integration_platform: rutterPlatform, applicant_id: res.locals?.user?.user_id };

				const customerDetailsRow = await db("integrations.business_score_triggers")
					.select("integrations.business_score_triggers.customer_id")
					.join("public.data_cases", "integrations.business_score_triggers.id", "public.data_cases.score_trigger_id")
					.where("public.data_cases.id", auditMessage.case_id)
					.first();
				logger.info({ customer_details_row: customerDetailsRow }, "Customer Row");
				await sendWebhookEvent(customerDetailsRow.customer_id, WEBHOOK_EVENTS.INTEGRATION_CONNECTED, auditMessage);

			// Create an audit log
			await producer.send({ 
				topic: kafkaTopics.NOTIFICATIONS, 
				messages: [{ 
					key: auditMessage.business_id, 
					value: { 
						event: kafkaEvents.INTEGRATION_CONNECTED_AUDIT,
						...auditMessage 
					}
				}] 
			});

				if (!res.locals.user?.is_guest_owner) {
					await triggerSectionCompletedKafkaEventWithRedis({
						businessId: business_id as UUID,
						section: "Accounting",
						userId: res.locals?.user?.user_id as UUID,
						customerId: customerDetailsRow.customer_id as UUID
					});
				}

				return res.jsend.success(connection);
			}
			throw new AccountingApiError("could not create connection");
		}
	}),
	syncRutterConnection: catchAsync(async (req: Request, res: Response) => {
		const { access_token, business_id } = req.params;

		const rutter = await Rutter.fromAccessTokenAndBusiness({ business_id: business_id as UUID, access_token });
		if (rutter) {
			res.jsend.success(rutter.hasConnection());
		}
	}),
	getRutterToken: catchAsync(async (_, res: Response) => {
		res.jsend.success(Rutter.getPublicKey());
	}),
	taxStatusConsentInit: catchAsync(async (req: Request, res: Response) => {
		const result = await AccountingRest.taxStatusConsentInit(
			{ case_id: req.body?.case_id || ("" as String), redirect_endpoint: req.body.redirect_endpoint as string, connection_phase: req.body?.connection_phase || "ONBOARDING" },
			{ business_id: req.params.business_id as UUID },
			req.headers,
			{ user_id: res.locals?.user?.user_id as UUID }
		);
		res.jsend.success(result.data, result.message);
	}),

	revokeTaxStatus: catchAsync(async (req, res) => {
		const result = await AccountingRest.revokeTaxStatus(req.params, req.query, req.headers, res.locals.user);
		res.jsend.success(result, "Connection revoked successfully.");
	}),

	revokeAccounting: catchAsync(async (req, res) => {
		const result = await AccountingRest.revokeAccounting(req.params, req.headers, res.locals.user, req.body);
		res.jsend.success(result, "Connection revoked successfully.");
	}),

	addBalanceSheet: catchAsync(async (req, res) => {
		const response = await AccountingRest.addBalanceSheet(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Statements added successfully");
	}),

	getAccountingStatements: catchAsync(async (req, res) => {
		const response = await AccountingRest.getAccountingStatements(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Success");
	}),

	getUploadedAccountingStatements: catchAsync(async (req, res) => {
		const response = await AccountingRest.getUploadedAccountingStatements(req.params, req.body);
		res.jsend.success(response, "Uploaded statements retrieved successfully!");
	}),

	deleteBalanceSheet: catchAsync(async (req, res) => {
		const response = await AccountingRest.deleteBalanceSheet(req.params, res.locals.user);
		res.jsend.success(response, "Statement removed successfully.");
	})
};
