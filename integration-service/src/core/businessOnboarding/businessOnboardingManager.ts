import { prepareIntegrationDataForScore } from "#common/index";
import {
	CONNECTION_STATUS,
	INTEGRATION_ID,
	SCORE_TRIGGER,
	TASK_STATUS
} from "#constants/index";
import { logger, sqlQuery, sqlTransaction } from "#helpers/index";
import { convertToObject } from "#utils/index";
import { v4 as uuidv4 } from "uuid";
import { type UUID } from "crypto";
import { getIntegrationStrategiesForCustomer } from "#helpers/strategyPlatformFactory";
import { IntegrationsCompletionTracker } from "#helpers/integrationsCompletionTracker";
import type { BusinessInviteAcceptedPayload } from "./types";

export class BusinessOnboardingManager {
	// TODO: Refactor this method to properly use a repository class pattern
	async seedBusinessIntegrations(body: BusinessInviteAcceptedPayload): Promise<any[] | void> {
		const now = new Date().toISOString();
		// Seed all connections and tasks based on master config
		// Query the master config
		const getAllPlatformsQuery = `SELECT * FROM integrations.core_integrations_platforms`;
		const getBusinessScoreVersion = `SELECT version FROM integrations.business_score_triggers WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1`;
		const getAllTasksQuery = `SELECT rel_tasks_integrations.id, core_tasks.id AS core_task_id, core_tasks.code AS task, core_integrations_platforms.id AS platform_id, core_integrations_platforms.code AS platfrom
			FROM integrations.rel_tasks_integrations
			LEFT JOIN integrations.core_tasks ON core_tasks.id = rel_tasks_integrations.task_category_id
			LEFT JOIN integrations.core_integrations_platforms ON core_integrations_platforms.id = rel_tasks_integrations.platform_id`;

		const [platforms, tasksConfig, scoreVersion] = (await sqlTransaction(
			[getAllPlatformsQuery, getAllTasksQuery, getBusinessScoreVersion],
			[[], [], [body.business_id]]
		)) as any;

		if (!tasksConfig.rows.length) {
			throw new Error("No integration tasks found");
		}

		if (!platforms.rows.length) {
			throw new Error("No integrations platforms found");
		}

		const businessScoreTrigger = {
			id: uuidv4(),
			business_id: body.business_id,
			applicant_id: body.applicant_id,
			customer_id: body.customer_id,
			trigger_type: SCORE_TRIGGER.ONBOARDING_INVITE,
			version: 1
		};
		if (body.case_id) {
			const { rows: existingCases } = await sqlQuery({
				sql: `SELECT 1 FROM public.data_cases WHERE id = $1`,
				values: [body.case_id]
			});
			if (existingCases.length) {
				logger.info(`Case with id ${body.case_id} already exists. Skipping case creation and task creation.`);
				return;
			}
		}
		let caseData = {
			id: body.case_id,
			business_id: body.business_id,
			applicant_id: body.applicant_id,
			customer_id: body.customer_id,
			score_trigger_id: businessScoreTrigger.id,
			created_at: now
		};

		if (scoreVersion.rows.length && scoreVersion.rows[0].version) {
			businessScoreTrigger.version = scoreVersion.rows[0].version + 1;
		}

		// If a business already has existing connections, then re-use them
		let { rows: existingConnections } = await sqlQuery({
			sql: `SELECT * FROM integrations.data_connections WHERE business_id = $1`,
			values: [body.business_id]
		});

		existingConnections = convertToObject(existingConnections, "platform_id");

		const integrationStrategyMap = await getIntegrationStrategiesForCustomer(body.customer_id as UUID);

		let connections: Record<string, any>,
			connectionHistory: any[] = [];
		if (Object.keys(existingConnections).length === platforms.rows.length) {
			// All connections already exist, use them but don't try to insert them
			connections = existingConnections;
		} else {
			// connections as object with platform_id as key
			// Each platfoem has one connection
			// Start with existing connections, then add new ones
			connections = { ...existingConnections };
			connectionHistory = [];
			for (const platform of platforms.rows) {
				if (existingConnections[platform.id]) {
					// skip if connection already exists
					continue;
				}

				const strategy = integrationStrategyMap[platform.id];

				let configuration;

				// if strategy exists for the platform, add the customer_id to the configuration
				// this allows us to pass the customer_id in the logs for debugging purposes
				if (strategy) {
					configuration = { customer_id: body.customer_id };
				}

				const connection = {
					id: uuidv4(),
					business_id: body.business_id,
					platform_id: platform.id,
					strategy: strategy || null,
					configuration: configuration || null,
					connection_status: CONNECTION_STATUS.CREATED,
					created_at: now,
					updated_at: now
				};

				const connHistory = {
					id: uuidv4(),
					connection_id: connection.id,
					connection_status: connection.connection_status,
					created_at: now
				};

				connections[platform.id] = connection;
				connectionHistory.push(connHistory);
			}
		}

		// Tasks has to be created afresh for each score trigger irrespective of whether connections are new or existing
		const updateExistingTaskQueries: string[] = [];
		const updateExistingTaskValues: any[] = [];
		const updateExistingTaskQuery = `UPDATE integrations.data_business_integrations_tasks
			SET business_score_trigger_id = $1
			WHERE id = $2`;

		// Tasks has to be created afresh for each score trigger irrespective of whether connections are new or existing
		const tasks: any[] = [];

		for (const task of tasksConfig.rows) {
			let connection;
			if (existingConnections[task.platform_id]) {
				connection = existingConnections[task.platform_id];

				// Check for existing task with null score
				const existingTask = await sqlQuery({
					sql: `SELECT * FROM integrations.data_business_integrations_tasks WHERE connection_id = $1 AND integration_task_id = $2 order by created_at desc limit 1`,
					values: [connection.id, task.id]
				});

				if (existingTask.rows.length && existingTask.rows[0].business_score_trigger_id === null) {
					// If task already exists, then we update the business_score_trigger_id
					updateExistingTaskQueries.push(updateExistingTaskQuery);
					updateExistingTaskValues.push([businessScoreTrigger.id, existingTask.rows[0].id]);
					continue; // Skip to next task
				}
			} else {
				connection = connections[task.platform_id];
			}
			if (!connection) {
				// For Trulioo, if connection doesn't exist and canIRun returned false, skip silently
				if (task.platform_id === INTEGRATION_ID.TRULIOO) {
					logger.info(
						`Skipping Trulioo task creation for business ${body.business_id} - no connection found (likely skipped due to canIRun)`
					);
					continue;
				}
				throw new Error(`No connection found for platform ${task.platform}: task ${task.task}`);
			}

			tasks.push({
				id: uuidv4(),
				connection_id: connection.id,
				integration_task_id: task.id,
				business_score_trigger_id: businessScoreTrigger.id,
				task_status: TASK_STATUS.CREATED,
				created_at: now,
				updated_at: now
			});
		}

		const taskEvents = tasks.map(task => {
			return {
				id: uuidv4(),
				business_integration_task_id: task.id,
				task_status: task.task_status,
				event_data: null,
				created_at: now
			};
		});

		// Only get NEW connections for insertion (those that have history entries)
		// Existing connections are already in the DB, so we don't need to insert them
		// Create a set of connection IDs from connectionHistory for fast lookup
		const newConnectionIds = new Set(connectionHistory.map(history => history.connection_id));
		const newConnections = Object.values(connections).filter((conn: any) => newConnectionIds.has(conn.id));

		// update db data
		const insertBusinessScoreTriggersQuery = `INSERT INTO integrations.business_score_triggers
			(id, business_id, applicant_id, customer_id, trigger_type, version) VALUES ($1, $2, $3, $4, $5, $6)`;

		const insertCaseQuery = `INSERT INTO data_cases
			(id, business_id, score_trigger_id, created_at) VALUES ($1, $2, $3, $4) on conflict(id) do nothing`;

		const insertConnectionsQuery = `INSERT INTO integrations.data_connections 
			SELECT * FROM json_populate_recordset(null::integrations.data_connections, $1) 
			ON CONFLICT (business_id, platform_id) DO NOTHING`;

		// Use a subquery to only insert history for connections that actually exist
		// This prevents foreign key constraint violations
		const insertConnectionHistoryQuery = `INSERT INTO integrations.data_connections_history 
			SELECT h.* FROM json_populate_recordset(null::integrations.data_connections_history, $1) AS h
			WHERE EXISTS (
				SELECT 1 FROM integrations.data_connections c 
				WHERE c.id = h.connection_id
			)`;

		// Use a subquery to only insert tasks for connections that actually exist
		// This prevents foreign key constraint violations
		const insertTasksQuery = `INSERT INTO integrations.data_business_integrations_tasks 
			SELECT t.* FROM json_populate_recordset(null::integrations.data_business_integrations_tasks, $1) AS t
			WHERE EXISTS (
				SELECT 1 FROM integrations.data_connections c 
				WHERE c.id = t.connection_id
			)`;

		// Task events reference tasks, so we need to ensure the task exists
		const insertTaskEventsQuery = `INSERT INTO integrations.business_integration_tasks_events 
			SELECT e.* FROM json_populate_recordset(null::integrations.business_integration_tasks_events, $1) AS e
			WHERE EXISTS (
				SELECT 1 FROM integrations.data_business_integrations_tasks t 
				WHERE t.id = e.business_integration_task_id
			)`;

		// if connectionHistory is empty, then no new connections were created
		if (connectionHistory.length) {
			await sqlTransaction(
				[
					insertBusinessScoreTriggersQuery,
					insertCaseQuery,
					insertConnectionsQuery,
					insertConnectionHistoryQuery,
					insertTasksQuery,
					insertTaskEventsQuery,
					...updateExistingTaskQueries
				],
				[
					[
						businessScoreTrigger.id,
						businessScoreTrigger.business_id,
						businessScoreTrigger.applicant_id,
						businessScoreTrigger.customer_id,
						businessScoreTrigger.trigger_type,
						businessScoreTrigger.version
					],
					[caseData.id, caseData.business_id, caseData.score_trigger_id, caseData.created_at],
					[JSON.stringify(newConnections)],
					[JSON.stringify(connectionHistory)],
					[JSON.stringify(tasks)],
					[JSON.stringify(taskEvents)],
					...updateExistingTaskValues.map(values => [values[0], values[1]])
				]
			);
		} else {
			await sqlTransaction(
				[
					insertBusinessScoreTriggersQuery,
					insertCaseQuery,
					insertTasksQuery,
					insertTaskEventsQuery,
					...updateExistingTaskQueries
				],
				[
					[
						businessScoreTrigger.id,
						businessScoreTrigger.business_id,
						businessScoreTrigger.applicant_id,
						businessScoreTrigger.customer_id,
						businessScoreTrigger.trigger_type,
						businessScoreTrigger.version
					],
					[caseData.id, caseData.business_id, caseData.score_trigger_id, caseData.created_at],
					[JSON.stringify(tasks)],
					[JSON.stringify(taskEvents)],
					...updateExistingTaskValues.map(values => [values[0], values[1]])
				]
			);
		}

		// Initialize integrations completion tracker for the business
		try {
			const requiredTaskTypes = await IntegrationsCompletionTracker.getAllRequiredTasks(
				body.business_id,
				body.customer_id ?? null
			);
			await IntegrationsCompletionTracker.initializeTracking(
				{
					business_id: body.business_id,
					customer_id: body.customer_id ?? undefined,
					case_id: body.case_id,
					business_score_trigger_id: businessScoreTrigger.id as UUID
				},
				requiredTaskTypes
			);
		} catch (error: unknown) {
			if (error instanceof Error && error.name === "IntegrationsCompletionTrackerError") {
				logger.error({
					error,
					business_id: body.business_id,
					customer_id: body.customer_id,
					case_id: body.case_id,
					business_score_trigger_id: businessScoreTrigger.id as UUID,
					message: "Failed to initialize integrations completion tracker for business. Continuing with task creation."
				});
			} else {
				logger.error(
					{
						error,
						business_id: body.business_id,
						customer_id: body.customer_id,
						case_id: body.case_id,
						business_score_trigger_id: businessScoreTrigger.id as UUID
					},
					"Exception occurred while initializing integrations completion tracker for business. Throwing error."
				);
				throw error;
			}
		}

		await Promise.all(
			updateExistingTaskValues.map(async values => {
				await prepareIntegrationDataForScore(values[1]);
			})
		);
		return tasks;
	}

}
