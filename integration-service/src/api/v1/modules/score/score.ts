import { sqlQuery } from "#helpers/index";
import { ScoreApiError } from "./error";
import { ERROR_CODES } from "#constants/error-codes.constant";
import { StatusCodes } from "http-status-codes";
import { KafkaHandlerError } from "../../../../messaging/kafka/consumers/handlers/error";
import { db } from "#helpers/knex";
import { SCORE_TRIGGER, type ScoreTrigger } from "#constants";
import { randomUUID, type UUID } from "crypto";
import type { BusinessScoreTrigger } from "#types/db";

class Score {
	/**
	 * Retrieves bank acount data required for score calculation based on the provided score trigger ID.
	 * @param {object} body.score_trigger_id - The ID of the score trigger.
	 * @returns {object} - An object containing the retrieved data.
	 * @property {Array} bank_accounts - An array of bank accounts data.
	 */
	async getBankingData(body) {
		try {
			const { score_trigger_id: scoreTriggerID } = body;

			const integrationDetails = (await this._getIntegrationDetails(scoreTriggerID, "banking")) as unknown as {
				rows: Array<{ id: string }>;
			};

			const integrationTaskIDs = integrationDetails.rows.map(row => row.id);

			let query = {};
			if (Object.hasOwn(body, "query")) {
				query = body.query;
			}

			let getBankAccountQuery = `SELECT integration_data.bank_accounts.*,
				(
					SELECT COALESCE(json_agg(transactions), '[]'::json)
					FROM (
						SELECT bank_account_transactions.*
						FROM integration_data.bank_account_transactions
						WHERE integration_data.bank_account_transactions.bank_account_id = bank_accounts.id
						) transactions
				) AS transactions,
				(
					SELECT COALESCE(json_agg(balances), '[]'::json)
					FROM (
						SELECT banking_balances.*
						FROM integration_data.banking_balances
						WHERE integration_data.banking_balances.bank_account_id = bank_accounts.id
					) balances
				) AS balances
				FROM integration_data.bank_accounts
				WHERE integration_data.bank_accounts.business_integration_task_id IN ('${integrationTaskIDs.join(", ")}')
				`;

			getBankAccountQuery = this._appendFilterDate(
				getBankAccountQuery,
				query,
				"integration_data.bank_accounts.created_at"
			);
			getBankAccountQuery += ` GROUP BY bank_accounts.id`;

			const bankAccounts = await sqlQuery({ sql: getBankAccountQuery, values: undefined });

			return bankAccounts.rows;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Retrieves public records data required for score calculation based on the provided score trigger ID.
	 * @param {string} body.score_trigger_id - The ID of the score trigger.
	 * @returns {object} - An object containing the retrieved data.
	 * @property {Array} public_records - An array of public records data.
	 */
	async getPublicRecords({ score_trigger_id: scoreTriggerID }) {
		try {
			const integrationDetails = (await this._getIntegrationDetails(scoreTriggerID, "public_records")) as unknown as {
				rows: Array<{ id: string }>;
			};

			const integrationTaskIDs = integrationDetails.rows.map(row => row.id);

			const getPublicRecordsQuery = `SELECT * FROM integration_data.public_records WHERE business_integration_task_id IN ('${integrationTaskIDs.join(", ")}')`;
			const publicRecords = await sqlQuery({ sql: getPublicRecordsQuery, values: undefined });

			// TODO : return only the data which is specific for calculation, returning all of it for now until the calculation logic comes into action
			return publicRecords.rows;
		} catch (error) {
			throw error;
		}
	}

	async generateNewVersion(
		businessId: UUID,
		customerId?: UUID,
		triggerType: ScoreTrigger = SCORE_TRIGGER.ONBOARDING_INVITE,
		caseId?: UUID
	): Promise<BusinessScoreTrigger> {
		const latestBusinessScore = await db<BusinessScoreTrigger>("integrations.business_score_triggers")
			.select("*")
			.where({
				business_id: businessId
			})
			.orderBy("version", "desc")
			.first();

		if (!latestBusinessScore) {
			throw new KafkaHandlerError("No score triggers found for business");
		}
		const scoreTrigger = {
			business_id: businessId,
			trigger_type: triggerType,
			version: latestBusinessScore.version + 1,
			customer_id: customerId
		};
		const newTriggers = await db<BusinessScoreTrigger>("integrations.business_score_triggers")
			.insert(scoreTrigger)
			.returning("*");
		const newTrigger = newTriggers[0];
		if (caseId) {
			await db("public.data_cases")
				.insert({ id: caseId, business_id: businessId, score_trigger_id: newTrigger.id, created_at: db.raw("now()") })
				.onConflict("id")
				.ignore();
		}
		return newTrigger;
	}

	async _getIntegrationDetails(scoreTriggerID, integrationCategory) {
		const getIntegrationDetailsQuery = `SELECT core_tasks.code, data_business_integrations_tasks.id, data_business_integrations_tasks.task_status, rel_tasks_integrations.platform_id, core_integrations_platforms.code
		FROM
			integrations.data_business_integrations_tasks
		JOIN
			integrations.rel_tasks_integrations
			ON rel_tasks_integrations.task_category_id = data_business_integrations_tasks.integration_task_id
		JOIN
			integrations.core_tasks
			ON core_tasks.id  = rel_tasks_integrations.task_category_id
		JOIN
			integrations.core_integrations_platforms
			ON core_integrations_platforms.id  = rel_tasks_integrations.platform_id
		JOIN
			integrations.core_categories
			ON core_integrations_platforms.category_id  = core_categories.id
		WHERE
			data_business_integrations_tasks.business_score_trigger_id = $1
			AND core_categories.code IN ($2)`;

		const integrationDetails = await sqlQuery({
			sql: getIntegrationDetailsQuery,
			values: [scoreTriggerID, integrationCategory]
		});

		if (!integrationDetails.rowCount) {
			throw new ScoreApiError(
				"No records found for the given score trigger id",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		return integrationDetails;
	}

	_appendFilterDate(query, queryParams, dateColumn) {
		if (Object.hasOwn(queryParams, "filter_date")) {
			if (!queryParams.filter_date.start_date || !queryParams.filter_date.end_date) {
				throw new ScoreApiError("Malformed Date Filter", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const startDate = queryParams.filter_date.start_date;
			const endDate = new Date(queryParams.filter_date.end_date);
			const endDateString = new Date(endDate.setDate(endDate.getDate() + 1)).toISOString().split("T")[0];

			if (startDate && endDateString && dateColumn) {
				query += ` AND ${dateColumn} >= '${startDate}' AND ${dateColumn} <= '${endDateString}'`;
			}
		}

		return query;
	}
}

export const score = new Score();
