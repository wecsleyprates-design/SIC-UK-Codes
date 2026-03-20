import { taxation } from "#api/v1/modules/taxation/taxation";
import {
	CONNECTION_STATUS,
	DIRECTORIES,
	ERROR_CODES,
	EVENTS,
	INTEGRATION_CATEGORIES,
	INTEGRATION_ID,
	QUEUES,
	SCORE_TRIGGER,
	TASK_STATUS,
	TAX_STATUS_ENDPOINTS,
	kafkaEvents,
	kafkaTopics
} from "#constants/index";
import BullQueue from "#helpers/bull-queue";
import {
	createCaseOnApplicationEdit,
	getBusinessDetails,
	logger,
	oauthClient,
	producer,
	sqlQuery,
	sqlTransaction,
	taxApi
} from "#helpers/index";
import { getGoogleBusinessReviews } from "#lib/google/reviews";
import { convertToObject } from "#utils/convertToNested";
import { getGoogleRatingMapping } from "#utils/googleRatings";
import { buildInsertQuery } from "#utils/queryBuilder";
import { getFile, putEconomicFile, putFile, getCachedSignedUrl } from "#utils/s3";
import currency from "currency.js";
import { mybusinessaccountmanagement } from "googleapis/build/src/apis/mybusinessaccountmanagement";
import { mybusinessbusinessinformation } from "googleapis/build/src/apis/mybusinessbusinessinformation";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";
import { checkAndTriggerRiskAlert } from "./common-new";
import { executeIntegrationTask } from "./score-refresh";

const requiredIntegrationCategories = [
	INTEGRATION_CATEGORIES.BANKING,
	INTEGRATION_CATEGORIES.ACCOUNTING,
	INTEGRATION_CATEGORIES.VERIFICATION
];

export const noneFoundToZero = value => {
	if (!value) {
		return "0";
	}
	return value === "None Found" ? "0" : value;
};

export const generateIntegrationFilePath = (businessID, integrationDirectory, platformName) => {
	return integrationDirectory.replace(":businessID", businessID).replace(":integrationPlatform", platformName);
};

export const getUploadedFileFromS3 = async fullPath => {
	try {
		const file = await getFile({ fileName: fullPath }); // Get the file from S3
		return file;
	} catch (ex) {
		logger.error(`Exception getting file from S3 for ${fullPath} : ${ex.message}`);
		throw new Error(`Failed to retrieve file from S3: ${ex.message}`);
	}
};

export const getCachedSignedUrlFromS3 = async (fileName, directory) => {
	try {
		const file = await getCachedSignedUrl(fileName, directory); // Get the file from S3
		return file;
	} catch (ex) {
		logger.error(`Exception getting file from S3 for ${directory}/${fileName}} : ${ex.message}`);
		throw new Error(`Failed to retrieve file from S3: ${ex.message}`);
	}
};

export const uploadRawFileToS3 = async (data, businessID, fileName, integrationDirectory, platformName) => {
	const path = generateIntegrationFilePath(businessID, integrationDirectory, platformName);
	await putFile({ buffer: data, fileName }, path);
	return { path };
};

export const hasAllIntegrationConnections = async businessID => {
	const query = `SELECT core_categories.id as category_id, core_categories.label as category_label,
    core_integrations_platforms.id as platform_id, core_integrations_platforms.label as platform_label,
    data_connections.connection_status FROM integrations.core_categories
    LEFT JOIN integrations.core_integrations_platforms
    ON integrations.core_categories.id = integrations.core_integrations_platforms.category_id
    LEFT JOIN integrations.data_connections
    ON integrations.core_integrations_platforms.id = integrations.data_connections.platform_id
    WHERE integrations.data_connections.business_id = $1;`;

	const result = await sqlQuery({ sql: query, values: [businessID] });

	if (!result.rowCount) {
		return false;
	}

	const categoriesWithConnections = new Set(result.rows.map(row => row.category_id));
	const hasConnectionInEachCategory = requiredIntegrationCategories.every(categoryId =>
		categoriesWithConnections.has(categoryId)
	);

	return hasConnectionInEachCategory;
};

export const hasIntegrationCategoryConnection = async (businessID, integrationCategoryID, integrationPlatformID) => {
	const query = `SELECT integrations.data_connections.id, integrations.data_connections.platform_id FROM integrations.data_connections
    LEFT JOIN integrations.core_integrations_platforms
    ON integrations.data_connections.platform_id = integrations.core_integrations_platforms.id
    LEFT JOIN integrations.core_categories
    ON integrations.core_integrations_platforms.category_id = integrations.core_categories.id
    WHERE integrations.data_connections.business_id = $1 AND integrations.core_categories.id = $2;`;

	const result = await sqlQuery({ sql: query, values: [businessID, integrationCategoryID] });

	if (!result.rowCount) {
		return false;
	}

	if (result.rows[0].platform_id === integrationPlatformID) {
		// What to do in the scenario of same connection being re connected
		// return false ?
	}
	return true;
};

export const uploadRawIntegrationDataToS3 = async (data, businessID, fileName, integrationDirectory, platformName) => {
	// const fileType = "application/json;charset=UTF-8"; // MIME type for JSON files
	// const fileExtension = "json"; // File extension for JSON files
	const jsonBuffer = Buffer.from(JSON.stringify(data), "utf-8"); // Convert JSON object to buffer
	fileName = `${fileName}.json`; // Construct a unique filename
	const path = generateIntegrationFilePath(businessID, integrationDirectory, platformName);
	await putFile({ buffer: jsonBuffer, fileName }, path); // Upload the file to S3
};

export const shimIntegrationData = async businessID => {
	// Locate possible equifax row
	const getEquifaxRowSql =
		"select response->'corpamount' as corpamount from integration_data.request_response where platform_id = $1 and business_id = $2 and request_type = 'fetch_public_records' order by requested_at desc limit 1";
	const getEquifaxRowValues = [INTEGRATION_ID.EQUIFAX, businessID];

	// Locate possible manual integrations
	const getManualRows =
		"select distinct on (org_id) org_id as customer_id, response->'is_revenue' as is_revenue from integration_data.request_response where platform_id = $1 and business_id = $2 order by customer_id, requested_at desc";
	const getManualValues = [INTEGRATION_ID.MANUAL, businessID];

	// Locate possible accounting income statement row
	const getAccountingRow =
		"select total_revenue from integration_data.accounting_incomestatement where business_id = $1 order by end_date desc,created_at desc limit 1";
	const getAccountingValues = [businessID];

	const [equifaxRow, manualRows, accountingRow] = await sqlTransaction(
		[getEquifaxRowSql, getManualRows, getAccountingRow],
		[getEquifaxRowValues, getManualValues, getAccountingValues]
	);
	const entries = [];
	if (equifaxRow?.rows?.[0]?.corpamount > 0) {
		// Equifax entry is in thousands, convert to normalized value
		entries.push(equifaxRow.rows[0].corpamount * 1000);
	}
	if (manualRows?.rows?.length > 0) {
		manualRows.rows.forEach(row => {
			const rev = parseFloat(row?.is_revenue ?? 0);
			if (!isNaN(rev) && rev > 0) {
				entries.push(rev);
			}
		});
	}
	if (accountingRow?.rowCount > 0 && accountingRow?.rows?.[0]?.total_revenue > 0) {
		entries.push(accountingRow.rows[0].total_revenue);
	}
	if (entries.length > 0) {
		const totalRevenue = entries.reduce((total, entry) => {
			return total.add(entry);
		}, currency(0)).value;
		const averageRevenue = totalRevenue / entries.length;
		await uploadRawIntegrationDataToS3(
			{ averaged_revenue: averageRevenue },
			businessID,
			"averagedRevenue",
			DIRECTORIES.MANUAL,
			"MANUAL"
		);
	}
};

export const getJSONFromS3 = async (fileName, logError = true) => {
	try {
		const raw = await getFile({ fileName }); // Get the file from s3
		const buff = await raw.transformToString();
		try {
			return JSON.parse(buff);
		} catch (ex) {
			if (logError) {
				logger.error({ error: ex, file_name: fileName }, "Could not parse JSON from S3");
			}
			return buff;
		}
	} catch (ex) {
		if (logError) {
			logger.warn({ error: ex, file_name: fileName }, "Exception getting JSON from S3");
		}
		return {};
	}
};
export const getRawIntegrationDataFromS3 = (
	businessID,
	fileName,
	integrationDirectory,
	platformName,
	logError = true
) => {
	const path = generateIntegrationFilePath(businessID, integrationDirectory, platformName);
	fileName = `${path}/${fileName}.json`;
	return getJSONFromS3(fileName, logError);
};

export const uploadEconomicsDataToS3 = async (data, fileName, integrationDirectory) => {
	await putEconomicFile(
		{ buffer: Buffer.from(JSON.stringify(data), "utf-8"), fileName: `${fileName}.json` },
		integrationDirectory
	);
};

/**
 * @description This is an internal function to get the locations of the account
 * @param {string} accountName : account name which will be like accounts/{accountID}
 * @returns {Array} : Array of locations linked with the account
 */
export const _getLocations = async accountName => {
	try {
		const googleClient = oauthClient.getClient();
		const myinformation = await mybusinessbusinessinformation({ version: "v1", auth: googleClient });
		const information = await myinformation.accounts.locations.list({
			parent: accountName,
			readMask: "name"
		});
		const { locations } = information.data;
		return locations;
	} catch (error) {
		throw error;
	}
};

export const getBusinessReviews = async (tokenData, businessAndTaskDetails, onlyNew = false) => {
	try {
		// get the accounts
		const googleClient = oauthClient.getClient();
		const mybusiness = await mybusinessaccountmanagement({ version: "v1", auth: googleClient });
		const accountsResponse = await mybusiness.accounts.list({
			pageSize: 10
		});

		const { accounts } = accountsResponse.data;

		if (!accounts) {
			throw new Error("No accounts found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		let lastFetchedReviewDate = null;
		if (onlyNew) {
			const lastFetchedReview = await sqlQuery({
				sql: "SELECT review_datetime FROM integration_data.reviews ORDER BY review_datetime DESC LIMIT 1"
			});
			lastFetchedReviewDate = lastFetchedReview.rows[0].review_datetime;
		}

		const businessReviewsQueue = new BullQueue(QUEUES.BUSINESS_REVIEWS);

		const response = {
			all_reviews: [],
			average_rating: 0,
			total_review_count: 0
		};

		// fetch reviews with the account & location
		for (const account of accounts) {
			const locations = await _getLocations(account.name);
			if (locations) {
				for (const location of locations) {
					const result = await getGoogleBusinessReviews(
						account.name,
						location.name,
						`Bearer ${tokenData.tokens.access_token}`
					);
					await uploadRawIntegrationDataToS3(
						result,
						businessAndTaskDetails.business_id,
						"public_records",
						DIRECTORIES.PUBLIC_RECORDS,
						"GOOGLE_BUSINESS_REVIEWS"
					);
					let reviews = result.reviews || {};
					if (Object.keys(reviews).length > 0) {
						response.average_rating = result.averageRating;
						response.total_review_count = result.totalReviewCount;
						if (onlyNew) {
							reviews = reviews.filter(review => new Date(review.createTime) > new Date(lastFetchedReviewDate));
						}
						response.all_reviews.push(...reviews); // Spread operator to combine reviews
					}
					if (result.nextPageToken) {
						await businessReviewsQueue.addJob(EVENTS.FETCH_BUSINESS_REVIEWS, {
							accountName: account.name,
							locationName: location.name,
							token: `Bearer ${tokenData.tokens.access_token}`,
							queryParams: { pageToken: result.nextPageToken },
							lastFetchedReviewDate,
							...businessAndTaskDetails
						});
					}
				}
			}
		}
		return response;
	} catch (error) {
		throw error;
	}
};

export const saveBusinessReviews = async (reviewsResponse, taskData) => {
	const {
		business_id: businessID,
		connection_id: connectionID,
		connection_status: connectionStatus,
		task_id: businessTaskID,
		task_status: taskStatus,
		log,
		error
	} = taskData;
	const queries = [];
	const values = [];

	const updateConnectionQuery = `UPDATE integrations.data_connections SET connection_status = $1 WHERE
	business_id = $3 AND platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = $4)`;
	const updateConnectionQueryValues = [connectionStatus, businessID, "google_business_reviews"];

	const insertConnectionHistory = `INSERT INTO integrations.data_connections_history (id, connection_id, log, connection_status, created_at) VALUES ($1, $2, $3, $4, $5)`;
	const insertConnectionHistoryValues = [
		uuidv4(),
		connectionID,
		log ? log : error,
		connectionStatus,
		new Date().toISOString()
	];

	const updateTaskStatusQuery = `UPDATE integrations.data_business_integrations_tasks SET task_status = $1 WHERE id = $2`;
	const updateTaskStatusQueryValues = [taskStatus, businessTaskID];

	queries.push(...[updateConnectionQuery, insertConnectionHistory, updateTaskStatusQuery]);
	values.push(...[updateConnectionQueryValues, insertConnectionHistoryValues, updateTaskStatusQueryValues]);

	// save reviews to the database
	if (reviewsResponse.length !== 0) {
		const reviews = reviewsResponse.map(review => {
			return [
				businessTaskID,
				review.reviewId,
				getGoogleRatingMapping(review.starRating),
				review.comment,
				new Date(review.createTime).toUTCString()
			];
		});

		const columns = ["business_integration_task_id", "review_id", "star_rating", "text", "review_datetime"];

		const insertGoogleReviewsQuery = buildInsertQuery("integration_data.reviews", columns, reviews);
		queries.push(insertGoogleReviewsQuery);
		values.push(reviews.flat());
	}
	await sqlTransaction(queries, values);
};

export const executeOtherTasksOnApplicationEdit = async (
	integrationPlatformID,
	businessID,
	authorization,
	additionalDetails
) => {
	// create only standalone case
	const createCaseResponse = await createCaseOnApplicationEdit(businessID, additionalDetails, authorization);

	const { standalone_case_id: standaloneCaseID } = createCaseResponse;

	const getAllPlatformsQuery = `SELECT * FROM integrations.core_integrations_platforms`;
	const getAllConnectionsQuery = `SELECT * FROM integrations.data_connections WHERE business_id = $1`;
	const getAllTasksQuery = `SELECT rel_tasks_integrations.id, core_tasks.id AS core_task_id, core_tasks.code AS task, core_integrations_platforms.id AS platform_id, core_integrations_platforms.code AS platfrom
			FROM integrations.rel_tasks_integrations
			LEFT JOIN integrations.core_tasks ON core_tasks.id = rel_tasks_integrations.task_category_id
			LEFT JOIN integrations.core_integrations_platforms ON core_integrations_platforms.id = rel_tasks_integrations.platform_id`;
	const getLatestBusinessScoreVersionQuery = `SELECT * FROM integrations.business_score_triggers WHERE business_id = $1  ORDER BY version DESC LIMIT 1`;

	const [platforms, connectionsResult, tasksConfig, scoreVersions] = await sqlTransaction(
		[getAllPlatformsQuery, getAllConnectionsQuery, getAllTasksQuery, getLatestBusinessScoreVersionQuery],
		[[], [businessID], [], [businessID]]
	);
	let existingConnections = connectionsResult.rows;
	existingConnections = convertToObject(existingConnections, "platform_id");

	const now = new Date().toISOString();

	let connections;
	let connectionHistory = [];
	if (Object.keys(existingConnections).length === platforms.rows.length) {
		connections = existingConnections;
	} else {
		// connections as object with platform_id as key
		// Each platfoem has one connection
		[connections, connectionHistory] = platforms.rows.reduce(
			(acc, platform) => {
				if (existingConnections[platform.id]) {
					// skip if connection already exists
					return acc;
				}

				const connection = {
					id: uuidv4(),
					business_id: businessID,
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

	const businessScoreTriggerID = uuidv4();
	const businessScoreTrigger = {
		id: businessScoreTriggerID,
		business_id: businessID,
		customer_id: null,
		trigger_type: SCORE_TRIGGER.APPLICATION_EDIT,
		version: scoreVersions.rows[0].version + 1
	};

	const caseData = {
		id: standaloneCaseID,
		business_id: businessID,
		score_trigger_id: businessScoreTrigger.id,
		created_at: now
	};

	const updatedIntegrationTask = [];
	const tasksToRefetchDataFor = [];
	// Tasks has to be created afresh for each score trigger irrespective of whether connections are new or existing
	const tasks = tasksConfig.rows.reduce((acc, task) => {
		let connection;
		if (existingConnections[task.platform_id]) {
			connection = existingConnections[task.platform_id];
		} else {
			connection = connections[task.platform_id];
		}

		if (!connection) {
			throw new Error(
				`executeOtherTasksOnApplicationEdit: No connection found for platform ${task.platform_id}: task ${task.task}`
			);
		}

		const taskEntry = {
			id: uuidv4(),
			connection_id: connection.id,
			integration_task_id: task.id,
			business_score_trigger_id: businessScoreTrigger.id,
			task_status: TASK_STATUS.CREATED,
			created_at: now,
			updated_at: now
		};

		acc.push(taskEntry);

		// We want to refetch data only for the platforms that are unchanged.
		if (integrationPlatformID !== task.platform_id) {
			tasksToRefetchDataFor.push(taskEntry);
		} else {
			updatedIntegrationTask.push(taskEntry);
		}

		return acc;
	}, []);

	const taskEvents = tasks.map(task => {
		return {
			id: uuidv4(),
			business_integration_task_id: task.id,
			task_status: task.task_status,
			event_data: null,
			created_at: now
		};
	});

	connections = Object.values(connections);

	const insertBusinessScoreTriggersQuery = `INSERT INTO integrations.business_score_triggers (id, business_id, customer_id, trigger_type, version) VALUES ($1, $2, $3, $4, $5)`;
	const insertCaseQuery = `INSERT INTO data_cases (id, business_id, score_trigger_id, created_at) VALUES ($1, $2, $3, $4) on conflict(id) DO NOTHING`;
	const insertTasksQuery = `INSERT INTO integrations.data_business_integrations_tasks SELECT * FROM json_populate_recordset(null::integrations.data_business_integrations_tasks, $1)`;
	const insertTaskEventsQuery = `INSERT INTO integrations.business_integration_tasks_events SELECT * FROM json_populate_recordset(null::integrations.business_integration_tasks_events, $1)`;
	const insertConnectionsQuery = `INSERT INTO integrations.data_connections SELECT * FROM json_populate_recordset(null::integrations.data_connections, $1) ON CONFLICT (business_id, platform_id) DO NOTHING`;
	const insertConnectionHistoryQuery = `INSERT INTO integrations.data_connections_history SELECT * FROM json_populate_recordset(null::integrations.data_connections_history, $1)`;
	// if connectionHistory is empty, then no new connections were created
	if (connectionHistory.length) {
		await sqlTransaction(
			[
				insertBusinessScoreTriggersQuery,
				insertCaseQuery,
				insertConnectionsQuery,
				insertConnectionHistoryQuery,
				insertTasksQuery,
				insertTaskEventsQuery
			],
			[
				[
					businessScoreTrigger.id,
					businessScoreTrigger.business_id,
					businessScoreTrigger.customer_id,
					businessScoreTrigger.trigger_type,
					businessScoreTrigger.version
				],
				[caseData.id, caseData.business_id, caseData.score_trigger_id, caseData.created_at],
				[JSON.stringify(connections)],
				[JSON.stringify(connectionHistory)],
				[JSON.stringify(tasks)],
				[JSON.stringify(taskEvents)]
			]
		);
	} else {
		await sqlTransaction(
			[insertBusinessScoreTriggersQuery, insertCaseQuery, insertTasksQuery, insertTaskEventsQuery],
			[
				[
					businessScoreTrigger.id,
					businessScoreTrigger.business_id,
					businessScoreTrigger.customer_id,
					businessScoreTrigger.trigger_type,
					businessScoreTrigger.version
				],
				[caseData.id, caseData.business_id, caseData.score_trigger_id, caseData.created_at],
				[JSON.stringify(tasks)],
				[JSON.stringify(taskEvents)]
			]
		);
	}

	// When banking is disconnected from the SMB dashboard,
	// insert an empty array in the rel_task_bank_account table
	// against the corresponding task ID to preserve historical data
	const getConnectionId = await sqlQuery({
		sql: `SELECT id FROM integrations.data_connections WHERE business_id = $1 AND platform_id = $2`,
		values: [caseData.business_id, INTEGRATION_ID.PLAID]
	});
	const connectionId = getConnectionId?.rows?.[0]?.id;
	if (connectionId) {
		const getBusinessIntegrationTaskId = await sqlQuery({
			sql: `SELECT id FROM integrations.data_business_integrations_tasks WHERE business_score_trigger_id = $1 AND connection_id = $2`,
			values: [caseData.score_trigger_id, connectionId]
		});
		const businessIntegrationTaskId = getBusinessIntegrationTaskId?.rows?.[0]?.id;
		if (businessIntegrationTaskId) {
			const insertRelBankAccountQuery = `INSERT INTO integration_data.rel_task_bank_account (business_integration_task_id, bank_account_id) VALUES ($1, $2)`;
			await sqlQuery({ sql: insertRelBankAccountQuery, values: [businessIntegrationTaskId, []] });
		}
	}

	let response;
	const failedPlatforms = new Set();
	const failedPlatformsNotificationStatus = new Set();
	for (const task of tasksToRefetchDataFor) {
		response = await executeIntegrationTask(task);
		if (!response.succeed && response.platform) {
			failedPlatforms.add(response.platform);
			failedPlatformsNotificationStatus.add(response.notification_status);
		}
	}

	// sending email when integration data fetching is failed
	if (failedPlatforms.size) {
		const emailMessage = {
			platforms: Array.from(failedPlatforms),
			business_id: businessID,
			platformsNotificationStatus: Array.from(failedPlatformsNotificationStatus)
		};

		const emailPayload = {
			topic: kafkaTopics.USERS_NEW,
			messages: [
				{
					key: businessID,
					value: {
						event: kafkaEvents.INTEGRATION_DATA_FETCH_FAILED,
						...emailMessage
					}
				}
			]
		};
		// send kafka event
		await producer.send(emailPayload);

		await checkAndTriggerRiskAlert("integrations", businessID, businessScoreTrigger.id);
	}
	logger.info("executeOtherTasksOnApplicationEdit: Completed");

	// create all new customer cases for this business ID
	createCaseOnApplicationEdit(
		businessID,
		{ case_type: "customer_cases", standalone_case_id: standaloneCaseID, ...additionalDetails },
		authorization
	);
	return updatedIntegrationTask;
};

export const fetchTaxFilings = async (taxFilings, businessID, data, taskID) => {
	try {
		if (!Object.hasOwn(taxFilings, "Data")) {
			logger.error(
				`Received invalid tax filings data: ${JSON.stringify(taxFilings)}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
			return { rows: [] };
		}

		let version = 1;
		const getTaxFilingsQuery = `SELECT MAX(version) as version FROM integration_data.tax_filings WHERE tax_filings.business_integration_task_id = $1`;

		const taxFilingsResult = await sqlQuery({ sql: getTaxFilingsQuery, values: [taskID] });
		if (taxFilingsResult.rows.length && taxFilingsResult.rows[0].version) {
			// Data is already filled for this business_integration_task_id
			version = parseInt(taxFilingsResult.rows[0].version) + 1;
			logger.info(`Received duplicate data for given task-id: ${taskID}, current version is ${version}`);
		}

		const businessType = Object.hasOwn(taxFilings, "SSN") ? "INDIVIDUAL" : "BUSINESS";

		// Store data for past 5 years
		const yearRange = [];
		const rows = [];
		for (let i = 0; i < 5; i++) {
			const element = new Date().getFullYear() - i;
			yearRange.push(element);
		}
		for await (const item of taxFilings.Data) {
			let industryCode = 0;
			let industryTitle = "";

			const apiObj = {
				tin: data.tin,
				transcriptType: item.FormType.toString(),
				transcriptForm: item.Form.toString(),
				transcriptPeriod: item.Period.toString()
			};
			/**
			 * Using fetchTranscriptDetails function for fetching and saving the data to the database for the quarterly data
			 */
			const transcriptData = await taxation.getDataForTranscriptDetails(item, apiObj, taskID);

			/**
			 * Fetches the transcript details for the industry.
			 * If the industry is found then it will be saved to the database
			 */
			const industryTranscriptDetails = await taxApi.fetchTranscriptDetails(
				apiObj,
				TAX_STATUS_ENDPOINTS.TRANSCRIPTDETAIL,
				"industry"
			);
			if (
				industryTranscriptDetails &&
				industryTranscriptDetails.industry &&
				industryTranscriptDetails.Message !== "Transcript not found"
			) {
				industryCode = industryTranscriptDetails.code;
				industryTitle = industryTranscriptDetails.industry;
				const message = {
					business_id: businessID,
					naics_code: industryCode,
					naics_title: industryTitle,
					platform: "tax_status"
				};
				logger.info(message);
				const payload = {
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: businessID,
							value: {
								event: kafkaEvents.UPDATE_NAICS_CODE,
								...message
							}
						}
					]
				};
				producer.send(payload);
			} else {
				logger.info(`Industry not found for ${apiObj.tin} and taskID: ${taskID}`);
			}
			const period = parseInt(item.Period.toString().substring(0, 4));
			if (yearRange.includes(period)) {
				rows.push([
					taskID,
					businessType,
					item.Period,
					item.Form,
					item.FormType,
					item.FilingStatus,
					item.AGI ? item.AGI : 0,
					item.TotalIncome ? item.TotalIncome : 0,
					item.TotalSales ? item.TotalSales : 0,
					item.TotalCompensation ? item.TotalCompensation : 0,
					item.TotalWages ? item.TotalWages : 0,
					item.IRSBalance ? item.IRSBalance : 0,
					item.LienBalance ? item.LienBalance : 0,
					industryCode ? industryCode : 0,
					industryTitle ? industryTitle : "",
					transcriptData.interest ? transcriptData.interest : 0,
					transcriptData.interestDate ? transcriptData.interestDate : "",
					transcriptData.penalty ? transcriptData.penalty : 0,
					transcriptData.penaltyDate ? transcriptData.penaltyDate : "",
					transcriptData.fileDate ? transcriptData.fileDate : "",
					transcriptData.balance ? transcriptData.balance : 0,
					transcriptData.taxPeriodEndingDate ? transcriptData.taxPeriodEndingDate : "",
					transcriptData.amountFiled ? transcriptData.amountFiled : 0,
					transcriptData.costOfGoodsSold ? transcriptData.costOfGoodsSold : 0,
					version
				]);
			}
		}

		return {
			rows
		};
	} catch (error) {
		throw error;
	}
};

export const updateTask = async (taskID, taskStatus) => {
	try {
		if (!Object.keys(TASK_STATUS).includes(taskStatus)) {
			throw new Error("Invalid task status");
		}

		const now = new Date().toISOString();

		const updateTaskQuery = `UPDATE integrations.data_business_integrations_tasks
			SET task_status = $1, updated_at = $2
			WHERE id = $3`;

		await sqlQuery({ sql: updateTaskQuery, values: [taskStatus, now, taskID] });
	} catch (error) {
		throw error;
	}
};

export async function updateBusinessDetailS3(businessId) {
	const { data } = await getBusinessDetails(businessId);

	const { path } = await uploadRawFileToS3(
		Buffer.from(JSON.stringify(data, null, 2)),
		businessId,
		"worthBusinessInfo.json",
		DIRECTORIES.BUSINESS_WORTH_INFO
	);

	logger.debug(
		`Business ${businessId} update S3 worthBusinessInfo.json to the most recent version. File path: ${path}`
	);
}
