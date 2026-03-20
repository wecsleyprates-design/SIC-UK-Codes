import {
	sqlQuery,
	sqlTransaction,
	producer,
	logger,
	getBusinessDetailsForTaxConsent,
	taxApi,
	getCustomerBusinessConfigs,
	db
} from "#helpers/index";
import { buildInsertQuery, convertToObject } from "#utils/index";
import {
	TASK_STATUS,
	CONNECTION_STATUS,
	kafkaTopics,
	kafkaEvents,
	TAX_STATUS_ENDPOINTS,
	DIRECTORIES,
	INTEGRATION_ID,
	INTEGRATION_EXECUTION_OVERRIDE,
	INTEGRATION_SETTING_KEYS,
	INTEGRATION_ENABLE_STATUS
} from "#constants/index";
import { v4 as uuidv4 } from "uuid";
import { banking } from "#api/v1/modules/banking/banking";
import {
	fetchTaxFilings,
	getBusinessReviews,
	saveBusinessReviews,
	uploadRawIntegrationDataToS3,
	prepareIntegrationDataForScore
} from "#common/index";
import { getConnectionById, updateConnectionByConnectionId } from "#helpers/platformHelper";
import { Task } from "#api/v1/modules/tasks/task";
import { checkAndTriggerRiskAlert } from "./common-new";
import { BankingTaskAction } from "#api/v1/modules/banking/types";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";

const executeTaskManagerTask = async task => {
	try {
		const taskObject = await Task.fromId(task.id);
		const response = await taskObject.process();
		if (response.task_status === TASK_STATUS.FAILED) {
			return false;
		}
	} catch (err) {
		logger.error(task);
		logger.error(err);
		return false;
	}
	return true;
};

/**
 *
 * @param {Object} body: Payload body
 * @param {string} body.business_id: Business ID
 * @param {string} body.customer_id: Customer ID
 * @param {string} body.trigger_type: Trigger type [ONBOARDING_INVITE, MONITORING_REFRESH, SCORE_REFRESH, APPLICATION_EDIT]
 * @param {Number} body.version: Trigger version
 * @returns {Array<Object>} Business Integration Tasks
 */
export const seedBusinessIntegrationTasks = async payload => {
	// Seed all connections and tasks based on master config
	// Query the master config
	const getAllPlatformsQuery = `SELECT * FROM integrations.core_integrations_platforms`;
	const getAllTasksQuery = `SELECT rel_tasks_integrations.id, core_tasks.id AS core_task_id, core_tasks.code AS task, core_integrations_platforms.id AS platform_id, core_integrations_platforms.code AS platfrom
			FROM integrations.rel_tasks_integrations
			LEFT JOIN integrations.core_tasks ON core_tasks.id = rel_tasks_integrations.task_category_id
			LEFT JOIN integrations.core_integrations_platforms ON core_integrations_platforms.id = rel_tasks_integrations.platform_id`;

	const [platforms, tasksConfig] = await sqlTransaction([getAllPlatformsQuery, getAllTasksQuery], [[], []]);

	if (!tasksConfig.rows.length) {
		throw new Error("No integration tasks found");
	}

	if (!platforms.rows.length) {
		throw new Error("No integrations platforms found");
	}

	const businessScoreTrigger = {
		id: uuidv4(),
		business_id: payload.business_id,
		customer_id: payload.customer_id,
		trigger_type: payload.trigger_type,
		version: payload.version
	};

	// If a business already has existing connections, then re-use them
	let { rows: existingConnections } = await sqlQuery({
		sql: `SELECT * FROM integrations.data_connections WHERE business_id = $1`,
		values: [payload.business_id]
	});

	existingConnections = convertToObject(existingConnections, "platform_id");

	let connections, connectionHistory;

	// If existing connections exists then use those connection else create new connections.
	// ?? I don't see why there would be a need to create new connections in case of refresh ?? We can remove the else block here
	if (Object.keys(existingConnections).length === platforms.rows.length) {
		connections = existingConnections;
	} else {
		// connections as object with platform_id as key
		// Each platform has one connection
		const now = new Date().toISOString();
		[connections, connectionHistory] = platforms.rows.reduce(
			(acc, platform) => {
				if (existingConnections[platform.id]) {
					// skip if connection already exists
					return acc;
				}

				const connection = {
					id: uuidv4(),
					business_id: payload.business_id,
					platform_id: platform.id,
					configuration: null,
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

				acc[0][platform.id] = connection;

				acc[1].push(connHistory);
				return acc;
			},
			[{}, []]
		);
	}

	// Tasks has to be created afresh for each score trigger irrespective of whether connections are new or existing
	const tasks = tasksConfig.rows.reduce((acc, task) => {
		let connection;
		if (existingConnections[task.platform_id]) {
			connection = existingConnections[task.platform_id];
		} else {
			connection = connections[task.platform_id];
		}

		if (!connection) {
			throw new Error(`No connection found for platform ${task.platform}: task ${task.task}`);
		}

		const now = new Date().toISOString();

		acc.push({
			id: uuidv4(),
			connection_id: connection.id,
			integration_task_id: task.id,
			business_score_trigger_id: businessScoreTrigger.id,
			trigger_type: businessScoreTrigger.trigger_type,
			task_status: TASK_STATUS.CREATED,
			created_at: now,
			updated_at: now
		});

		return acc;
	}, []);

	// Task events is same as task history
	const taskEvents = tasks.map(task => {
		return {
			id: uuidv4(),
			business_integration_task_id: task.id,
			task_status: task.task_status,
			event_data: null,
			created_at: new Date().toISOString()
		};
	});

	connections = Object.values(connections);

	// Operate on db to enter new tasks and triggers
	const insertBusinessScoreTriggersQuery = `INSERT INTO integrations.business_score_triggers
			(id, business_id, trigger_type, version, customer_id) VALUES ($1, $2, $3, $4, $5)`;
	const insertConnectionsQuery = `INSERT INTO integrations.data_connections SELECT * FROM json_populate_recordset(null::integrations.data_connections, $1) ON CONFLICT (business_id, platform_id) DO NOTHING`;
	const insertConnectionHistoryQuery = `INSERT INTO integrations.data_connections_history SELECT * FROM json_populate_recordset(null::integrations.data_connections_history, $1)`;
	const insertTasksQuery = `INSERT INTO integrations.data_business_integrations_tasks SELECT * FROM json_populate_recordset(null::integrations.data_business_integrations_tasks, $1)`;
	const insertTaskEventsQuery = `INSERT INTO integrations.business_integration_tasks_events SELECT * FROM json_populate_recordset(null::integrations.business_integration_tasks_events, $1)`;

	// if connectionHistory is empty, then no new connections were created
	if (connectionHistory && connectionHistory.length) {
		await sqlTransaction(
			[
				insertBusinessScoreTriggersQuery,
				insertConnectionsQuery,
				insertConnectionHistoryQuery,
				insertTasksQuery,
				insertTaskEventsQuery
			],
			[
				[
					businessScoreTrigger.id,
					businessScoreTrigger.business_id,
					businessScoreTrigger.trigger_type,
					businessScoreTrigger.version,
					businessScoreTrigger.customer_id
				],
				[JSON.stringify(connections)],
				[JSON.stringify(connectionHistory)],
				[JSON.stringify(tasks)],
				[JSON.stringify(taskEvents)]
			]
		);
	} else {
		await sqlTransaction(
			[insertBusinessScoreTriggersQuery, insertTasksQuery, insertTaskEventsQuery],
			[
				[
					businessScoreTrigger.id,
					businessScoreTrigger.business_id,
					businessScoreTrigger.trigger_type,
					businessScoreTrigger.version,
					businessScoreTrigger.customer_id
				],
				[JSON.stringify(tasks)],
				[JSON.stringify(taskEvents)]
			]
		);
	}
	return tasks;
};

const _updateTaskStatus = async (taskID, status, log) => {
	const now = new Date().toISOString();
	const updateTaskQuery = `UPDATE integrations.data_business_integrations_tasks SET task_status = $1, updated_at = $2 WHERE id = $3`;
	const insertEventQuery = `INSERT INTO integrations.business_integration_tasks_events (id, business_integration_task_id, task_status, log) VALUES ($1, $2, $3, $4::json)`;
	await sqlTransaction(
		[updateTaskQuery, insertEventQuery],
		[
			[status, now, taskID],
			[uuidv4(), taskID, status, JSON.stringify({ log })]
		]
	);
};

/**
 * Execute the integration task
 * @param {Object} task: Integration task
 * @param {string} task.id: Task ID
 * @param {string} task.connection_id: Connection ID
 * @param {string} task.integration_task_id: Integration Task ID
 * @param {string} task.business_score_trigger_id: Business Score Trigger ID
 * @param {string} task.task_status: Task Status
 */
export const executeIntegrationTask = async task => {
	// TODO: https://worth-ai.atlassian.net/browse/PAT-475
	// Make this a top-level import but for now its causing jest to fail for circular dependency
	const { EntityMatching } = await import("#lib/entityMatching/entityMatching");
	const getConnectionQuery = `
		SELECT 
			data_connections.*, 
			data_connections_history.connection_id, 
			data_connections_history.connection_status AS historic_connection_status, 
			core_integrations_platforms.label AS platform, 
			integrations.core_categories.label AS category_label,
			integrations.rel_platforms_status.notification_status AS notification_status
		FROM 
			integrations.data_connections 
		INNER JOIN 
			integrations.core_integrations_platforms 
			ON core_integrations_platforms.id = data_connections.platform_id
		INNER JOIN 
			integrations.core_categories 
			ON integrations.core_categories.id = integrations.core_integrations_platforms.category_id
		LEFT JOIN 
			integrations.rel_platforms_status
			ON integrations.rel_platforms_status.platform_id = core_integrations_platforms.id
		LEFT JOIN 
			integrations.data_connections_history 
			ON integrations.data_connections_history.connection_id = data_connections.id 
			AND data_connections_history.connection_status = $1
		WHERE 
			data_connections.id = $2;
		`;
	const {
		rows: [connection]
	} = await sqlQuery({ sql: getConnectionQuery, values: [CONNECTION_STATUS.SUCCESS, task.connection_id] });
	if (!connection) {
		await _updateTaskStatus(task.id, TASK_STATUS.FAILED, "No connection found for task");
		throw new Error(`No connection found for task ${task.id}`);
	}
	logger.info(`Score Refresh: connection ${task.connection_id} platform ${connection.platform}`);

	const taskResponse = { succeed: true, notification_status: connection.notification_status };
	// Check to see if we should run an associated task even if the connection is not successful
	const overrideRun =
		INTEGRATION_EXECUTION_OVERRIDE[connection.platform_id]?.includes(connection.connection_status) ?? false;
	if (!overrideRun && connection.connection_status !== CONNECTION_STATUS.SUCCESS) {
		const message = {
			business_id: task.business_id,
			platform_id: connection.platform_id,
			platform: connection.platform
		};

		const payload = {
			topic: kafkaTopics.BUSINESS,
			messages: [
				{
					key: task.business_id,
					value: {
						event: kafkaEvents.BUSINESS_CONNECTION_FAILED,
						...message
					}
				}
			]
		};
		// send kafka event
		await producer.send(payload);

		logger.debug(
			`executeIntegrationTask: businessId=${connection.business_id} connectionId=${connection.id} platform=${connection.platform} Connection status is ${connection.connection_status} :: task ${task.id} `
		);

		if (connection.historic_connection_status !== CONNECTION_STATUS.SUCCESS) {
			return taskResponse;
		}

		switch (connection.category_label) {
			case "Taxation":
				connection.category_label = "Taxes";
				break;

			case "Public Records":
				switch (connection.platform) {
					case "Verdata":
						connection.category_label = "Verdata";
						break;

					case "Google Business Reviews":
						connection.category_label = "Social";
						break;

					case "Google Places Reviews":
						connection.category_label = "";
						break;

					default:
						break;
				}
				break;

			default:
				break;
		}

		return { succeed: false, platform: connection.category_label, notification_status: connection.notification_status };
	}

	// execute the task
	const taskDetailsQuery = `SELECT core_tasks.code AS task, core_integrations_platforms.label AS platform, rel_tasks_integrations.task_category_id AS integration_task_id
		FROM integrations.rel_tasks_integrations
	INNER JOIN integrations.core_tasks ON core_tasks.id = rel_tasks_integrations.task_category_id
	INNER JOIN integrations.core_integrations_platforms ON core_integrations_platforms.id = rel_tasks_integrations.platform_id
	WHERE rel_tasks_integrations.id = $1`;
	const {
		rows: [taskDetails]
	} = await sqlQuery({ sql: taskDetailsQuery, values: [task.integration_task_id] });

	if (!taskDetails) {
		await _updateTaskStatus(task.id, TASK_STATUS.FAILED, "No task details found");
		throw new Error(`No task details found for task ${task.id}`);
	}

	let isTaskFailedAfterExecution = false;

	logger.info(`REFRESH SCORE: Task ${task.id} is of ${taskDetails.task} platform --- ${taskDetails.platform}`);
	switch (taskDetails.task) {
		case "fetch_public_records":
			// mark the connection as SUCCESS for Verdata if it is not already
			try {
				if (
					connection.platform_id === INTEGRATION_ID.VERDATA &&
					connection.connection_status !== CONNECTION_STATUS.SUCCESS
				) {
					await updateConnectionByConnectionId(connection.id, CONNECTION_STATUS.SUCCESS, {});
				}
			} catch (ex) {
				logger.error(
					`Error updating connection status for businessId: ${connection.business_id} connectionId=${connection.id}: ${ex.message}`
				);
			}

			if (connection.platform_id === INTEGRATION_ID.EQUIFAX) {
				// If entity matching is enabled for equifax then we don't directly execute the task
				const isEntityMatchingEnabled = await EntityMatching.isEnabled(connection.platform_id);
				if (isEntityMatchingEnabled) {
					break;
				}
			}
			await executeTaskManagerTask(task);
			break;
		case "fetch_assets_data": {
			// ! Commenting this bottom code, I am not sure if there will ever occur a scenario where CREATE_ASSET_REPORT will be sent during data refresh. Delete the commented code if everything works fine
			// let action = "CREATE_ASSET_REPORT";
			// if (connection.configuration.asset_report_token) {
			// 	action = "REFRESH_ASSET_REPORT";
			// }

			try {
				await banking.fetchAssetReport(task.id, BankingTaskAction.REFRESH_ASSET_REPORT);
			} catch (err) {
				logger.error({ error: err }, "Error in fetching asset report");
				await _updateTaskStatus(task.id, TASK_STATUS.FAILED, `Error in fetching asset report: ${err.message}`);
			}
			await prepareIntegrationDataForScore(task.id, task.trigger_type);
			break;
		}

		// TODO: add other integration data pull calls @matt @victor

		case "fetch_tax_filings": {
			try {
				const { data } = await getBusinessDetailsForTaxConsent(connection.business_id);

				if (!data || !data?.tin) {
					await _updateTaskStatus(task.id, TASK_STATUS.FAILED, "TIN not found for business");
					logger.error(`TIN not found for businessID: ${connection.business_id}`);
					break;
				}

				let endpoint, taxApiPayload;

				// if the owner is Sole Proprietor, then we have to use the individual endpoint of TaxStatus otherwise business endpoint
				if (data.title === "Sole Proprietor") {
					endpoint = TAX_STATUS_ENDPOINTS.INDIVIDUAL;
					taxApiPayload = { ssn: data.tin };
				} else {
					endpoint = TAX_STATUS_ENDPOINTS.BUSINESS;
					taxApiPayload = { ein: data.tin };
				}

				const taxFilings = await taxApi.send(taxApiPayload, endpoint);

				const { rows } = await fetchTaxFilings(taxFilings, connection.business_id, data, task.id);

				const table = "integration_data.tax_filings";
				const columns = [
					"business_integration_task_id",
					"business_type",
					"period",
					"form",
					"form_type",
					"filing_status",
					"adjusted_gross_income",
					"total_income",
					"total_sales",
					"total_compensation",
					"total_wages",
					"irs_balance",
					"lien_balance",
					"naics",
					"naics_title",
					"interest",
					"interest_date",
					"penalty",
					"penalty_date",
					"filed_date",
					"balance",
					"tax_period_ending_date",
					"amount_filed",
					"cost_of_goods_sold",
					"version"
				];

				/**
				 * if we have data to store in the database then we are storing the data in the database
				 * and also updating the connection status and integration task status
				 */
				if (rows.length) {
					const insertTaxFilingQuery = buildInsertQuery(table, columns, rows);
					await sqlQuery({ sql: insertTaxFilingQuery, values: rows.flat() });
				}
				await _updateTaskStatus(task.id, TASK_STATUS.SUCCESS, "Task executed successfully");
				/**
				 * Storing the webhook data in S3 bucket
				 */
				await uploadRawIntegrationDataToS3(
					taxFilings,
					connection.business_id,
					"tax_filings",
					DIRECTORIES.TAXATION,
					"TAX_STATUS"
				);
			} catch (ex) {
				logger.error({ error: ex }, "Error in fetch_tax_filings");
				await _updateTaskStatus(task.id, TASK_STATUS.FAILED, "Task failed to execute");
			}
			await prepareIntegrationDataForScore(task.id, task.trigger_type);
			break;
		}

		case "fetch_balance_sheet":
		case "fetch_profit_and_loss_statement":
		case "fetch_cash_flow":
		case "fetch_accounting_records":
		case "fetch_accounting_business_info": {
			try {
				// Don't run for platform_id === 2 (Quickbooks [the non rutter version of it])
				if (connection.platform_id !== 2) {
					const success = await executeTaskManagerTask(task);
					if (!success) {
						isTaskFailedAfterExecution = true;
					}
				}
			} catch (err) {
				logger.error(taskDetails);
				logger.error(err);
			}
			break;
		}
		case "fetch_google_reviews": {
			logger.info(`REFRESH SCORE: Task ${task.id} is of Google Reviews platform --- ${taskDetails.platform}`);
			try {
				if (connection.platform === "Google Places Reviews") {
					const placeID = connection.configuration.place_id;
					if (!placeID) {
						logger.info(`GOOGLE REVIEWS: Place ID not found for connection ${connection.id}`);
						break;
					}
					await executeTaskManagerTask(task);
				} else {
					try {
						// Fetch google reviews from business api
						let connectionStatus = "SUCCESS";
						let taskStatus = "SUCCESS";
						let response = {};
						let error, log;

						try {
							const { configuration } = connection;

							if (!configuration?.tokens) {
								throw new Error(
									`No configuration found for connection ${connection.id} for fetching Google Business Reviews of Business: ${connection.business_id}`
								);
							}

							const businessAndTaskDetails = {
								business_id: connection.business_id,
								connection_id: connection.id,
								business_integration_task_id: task.id
							};

							response = await getBusinessReviews(configuration?.tokens, businessAndTaskDetails, true);
						} catch (err) {
							logger.info(
								`REFRESH SCORE: GOOGLE BUSINESS REVIEWS Error in fetching google reviews for business ${connection.business_id} and connection ${connection.id}`
							);
							error = err;
							logger.error(JSON.stringify(error));
							connectionStatus = CONNECTION_STATUS.FAILED;
							taskStatus = TASK_STATUS.FAILED;
							log = "Google business reviews fetching failed";
							isTaskFailedAfterExecution = true;
						}

						const taskData = {
							business_id: connection.business_id,
							connection_status: connectionStatus,
							task_status: taskStatus,
							connection_id: connection.id,
							log,
							task_id: task.id,
							error
						};

						const insertGoogleRatingsQuery = `INSERT INTO integration_data.business_ratings (business_integration_task_id, average_rating, total_reviews) VALUES ($1, $2, $3)`;
						const insertGoogleRatingsValues = [task.id, response.average_rating ?? 0, response.total_review_count];
						await sqlQuery({ sql: insertGoogleRatingsQuery, values: insertGoogleRatingsValues });

						await saveBusinessReviews(response.all_reviews, taskData);
						await prepareIntegrationDataForScore(task.id, task.trigger_type);
					} catch (error) {
						logger.error(error);
					}
				}
			} catch (ex) {
				logger.error({ error: ex }, "Error in fetch_google_reviews");
				await _updateTaskStatus(task.id, TASK_STATUS.FAILED, "Task failed");
				await prepareIntegrationDataForScore(task.id, task.trigger_type);
			}
			break;
		}
		case "fetch_bureau_score_owners":
			try {
				const getCustomerIdQuery = `SELECT integrations.business_score_triggers.customer_id
				FROM integrations.business_score_triggers WHERE integrations.business_score_triggers.id = $1;`;
				const getCustomerIdQueryDetails = await sqlQuery({
					sql: getCustomerIdQuery,
					values: [task.business_score_trigger_id]
				});
				const customerID = getCustomerIdQueryDetails.rows[0].customer_id;
				if (customerID) {
					const customerSettings = await db("public.data_customer_integration_settings")
						.select("settings")
						.where("customer_id", customerID)
						.first();
					if (!customerSettings || !customerSettings.settings) {
						logger.info(customerID, "Customer settings not found for customer ID: ");
						break;
					}
					const setting = customerSettings.settings[INTEGRATION_SETTING_KEYS.EQUIFAX];
					if (setting.status !== INTEGRATION_ENABLE_STATUS.ACTIVE) {
						logger.info(`REFRESH SCORE: Equifax Customer Setting Disabled for customer ${customerID}`);
						break;
					}
				} else {
					// TODO: Make this flag value dynamic based on the global config of standalone case
					// This is a temporary flag to disable fetching credit report for standalone tasks
					const fetchCreditReportForStandaloneTasks = false;
					if (!fetchCreditReportForStandaloneTasks) {
						logger.info(`REFRESH SCORE: Credit Check for standalone tasks is disabled`);
						break;
					}
				}
				logger.info(
					`REFRESH SCORE: Equifax Bureau Score Owners for business ${connection.business_id} and connection ${connection.id} and task ${task.id}`
				);
				const dbConnection = await getConnectionById(task.connection_id);
				const equifax = await strategyPlatformFactory({ dbConnection: dbConnection });
				// Check if skip credit check is enabled for a business or not
				if (customerID) {
					const customerBusinessConfigs = await getCustomerBusinessConfigs(customerID, dbConnection.business_id);
					const businessEquifaxSetting = customerBusinessConfigs?.[0]?.config.skip_credit_check;
					if (customerID && businessEquifaxSetting) {
						logger.info(
							`REFRESH SCORE: Equifax Setting disabled for customer ${customerID} and business ${dbConnection.business_id}`
						);
						break;
					}
				}
				if (dbConnection && dbConnection.configuration?.skip_credit_check) {
					logger.info(`REFRESH SCORE: Skip Credit Check enabled for business ${dbConnection.business_id}`);
					break;
				}
				logger.info(
					`REFRESH SCORE: Fetching Equifax Bureau Score Owners for business ${connection.business_id} and connection ${connection.id} and score_trigger_id ${task.business_score_trigger_id} started`
				);
				// This is an extra check to make sure that the task has business_score_trigger_id
				if (!task.business_score_trigger_id) {
					logger.info(`REFRESH SCORE: Task ${task.id} does not have business_score_trigger_id`);
					break;
				}
				const equifaxTasks = await equifax.createFetchBureauScoreOwnersTasks(
					{ forceCreation: true },
					task.business_score_trigger_id
				);
				logger.info(
					`REFRESH SCORE: Equifax Bureau Score Owners for business ${connection.business_id} new tasks created: ${JSON.stringify(equifaxTasks)}`
				);
				await Promise.allSettled(
					equifaxTasks.map(async equifaxTask => {
						const response = await equifax.processTask({ taskId: equifaxTask });
						if (response?.task_status === TASK_STATUS.FAILED) {
							isTaskFailedAfterExecution = true;
						}
						logger.info(
							`REFRESH SCORE: Equifax Bureau Score Owners for business ${connection.business_id} and connection ${connection.id} and task ${equifaxTask} completed`
						);
						await checkAndTriggerRiskAlert("equifax", connection.business_id, equifaxTask);
					})
				);
			} catch (error) {
				await _updateTaskStatus(task.id, TASK_STATUS.FAILED, "Task failed");
				await prepareIntegrationDataForScore(task.id, task.trigger_type);
				logger.error(error);
			}
			break;

		case "fetch_business_entity_website_details": {
			try {
				logger.info("fetch_business_entity_website_details...");
				if (connection.platform_id === INTEGRATION_ID.SERP_SCRAPE) {
					const success = await executeTaskManagerTask(task);
					if (!success) {
						isTaskFailedAfterExecution = true;
					}
				}
			} catch (ex) {
				logger.error({ error: ex }, "Error in fetch_business_entity_website_details");
				await _updateTaskStatus(task.id, TASK_STATUS.FAILED, "Task failed");
				await prepareIntegrationDataForScore(task.id, task.trigger_type);
			}
			break;
		}

		case "fetch_google_profile": {
			try {
				logger.info("fetch_google_profile...");
				if (connection.platform_id === INTEGRATION_ID.SERP_GOOGLE_PROFILE) {
					const success = await executeTaskManagerTask(task);
					if (!success) {
						isTaskFailedAfterExecution = true;
					}
				}
			} catch (ex) {
				logger.error({ error: ex }, "Error in fetch_google_profile");
				await _updateTaskStatus(task.id, TASK_STATUS.FAILED, "Task failed");
				await prepareIntegrationDataForScore(task.id, task.trigger_type);
			}
			break;
		}

		case "fetch_business_entity_verification": {
			// Only handle OpenCorporates & ZoomInfo for now
			try {
				if (
					[
						INTEGRATION_ID.OPENCORPORATES,
						INTEGRATION_ID.ZOOMINFO,
						INTEGRATION_ID.CANADA_OPEN,
						INTEGRATION_ID.ENTITY_MATCHING
					].includes(connection.platform_id)
				) {
					const isEntityMatchingEnabled = await EntityMatching.isEnabled(connection.platform_id);
					if (isEntityMatchingEnabled) {
						// If entity matching is enabled for the platform, then we don't directly execute the task
						break;
					}
					const success = await executeTaskManagerTask(task);
					if (!success) {
						isTaskFailedAfterExecution = true;
					}
				}
				// we require metadata for score generation so here for middesk we are sending old success task again
				if (connection.platform_id === INTEGRATION_ID.MIDDESK) {
					const getSuccessTask = await TaskManager.getLatestTaskForBusiness(
						connection.business_id,
						INTEGRATION_ID.MIDDESK,
						"fetch_business_entity_verification",
						true
					);
					if (getSuccessTask) {
						await prepareIntegrationDataForScore(
							getSuccessTask.id,
							task.trigger_type,
							null,
							task.business_score_trigger_id
						);
					}
				}
				// same for Baselayer (same behaviour as Middesk)
				if (connection.platform_id === INTEGRATION_ID.BASELAYER) {
					const getSuccessTask = await TaskManager.getLatestTaskForBusiness(
						connection.business_id,
						INTEGRATION_ID.BASELAYER,
						"fetch_business_entity_verification",
						true
					);
					if (getSuccessTask) {
						await prepareIntegrationDataForScore(
							getSuccessTask.id,
							task.trigger_type,
							null,
							task.business_score_trigger_id
						);
					}
				}
			} catch (err) {
				logger.error(taskDetails);
				logger.error(err);
			}
			break;
		}

		case "manual_tax_filing":
			try {
				// get the last successful task for the business
				const lastTask = await TaskManager.getLatestTaskForBusiness(
					connection.business_id,
					INTEGRATION_ID.MANUAL,
					"manual_tax_filing",
					true
				);
				logger.info(`manual_tax_filing: lastTask: ${JSON.stringify(lastTask)}`);
				if (lastTask.task_status === TASK_STATUS.SUCCESS) {
					// replicate the same data for the new task
					const replicateTaskFilingQuery = `INSERT INTO integration_data.tax_filings (business_integration_task_id, business_type, period, form, form_type, filing_status, adjusted_gross_income, total_income, total_sales, total_compensation, total_wages, irs_balance, lien_balance, naics, naics_title, interest, interest_date, penalty, penalty_date, filed_date, balance, tax_period_ending_date, amount_filed, cost_of_goods_sold, version) 
								SELECT $1, business_type, period, form, form_type, filing_status, adjusted_gross_income, total_income, total_sales, total_compensation, total_wages, irs_balance, lien_balance, naics, naics_title, interest, interest_date, penalty, penalty_date, filed_date, balance, tax_period_ending_date, amount_filed, cost_of_goods_sold, 1 FROM integration_data.tax_filings WHERE business_integration_task_id = $2`;
					const updateTaskQuery = `UPDATE integrations.data_business_integrations_tasks SET task_status = $1, metadata = $2::json WHERE id = $3`;

					await sqlTransaction(
						[replicateTaskFilingQuery, updateTaskQuery],
						[
							[task.id, lastTask.id],
							[TASK_STATUS.SUCCESS, lastTask.metadata, task.id]
						]
					);
				}
			} catch (error) {
				logger.error({ error }, "manual_tax_filing failed");
			}
			break;

		case "process_business_enrichment": {
			try {
				logger.info("process_business_enrichment...");
				const success = await executeTaskManagerTask(task);
				if (!success) {
					isTaskFailedAfterExecution = true;
				}
			} catch (ex) {
				logger.error({ error: ex }, "Error in process_business_enrichment");
				await _updateTaskStatus(task.id, TASK_STATUS.FAILED, "Task failed");
				await prepareIntegrationDataForScore(task.id, task.trigger_type);
			}
			break;
		}

		default:
			logger.warn(`Task not found for task ${taskDetails.task}, taskID : ${task.id}`);
			await _updateTaskStatus(
				task.id,
				TASK_STATUS.FAILED,
				`Task not found for task ${taskDetails.task} , taskID : ${task.id}`
			);
			await prepareIntegrationDataForScore(task.id, task.trigger_type);
		// throw new Error(`Task not found for task ${task.id}`);
	}

	if (isTaskFailedAfterExecution) {
		taskResponse.succeed = false;
		taskResponse.platform = connection.category_label;
	}
	return taskResponse;
};
