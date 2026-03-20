import { TaskHandlerMap, TaskManager } from "#api/v1/modules/tasks/taskManager";
import { uploadRawIntegrationDataToS3 } from "#common/common";
import { DIRECTORIES } from "#constants";
import { ERROR_CODES } from "#constants/error-codes.constant";
import { INTEGRATION_CATEGORIES, TaskStatus } from "#constants/integrations.constant";
import { db } from "#helpers/knex";
import { getPlatformFromId } from "#helpers/platformHelper";
import type { IDBConnection } from "#types/db";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { AccountingApiError } from "./error";

/* Classes that handle accounting integrations should extend this abstract class */
export abstract class AccountingBase extends TaskManager {
	public static readonly PUBLIC_KEY = "";
	public readonly PENDING_TASK_STATUSES: TaskStatus[] = ["CREATED", "ERRORED"];

	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
		if (dbConnection) {
			this.dbConnection = dbConnection;
		}
	}

	static getPublicKey() {
		throw new AccountingApiError("Class hasn't implemented static getPublicKey()", {}, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
	}

	abstract taskHandlerMap: TaskHandlerMap;
	abstract callbackHandler(...args: any[]);
	abstract initialUpdate(...args: any[]);
	abstract getCompanyInfo();
	abstract syncBalanceSheets(...args: any[]);
	abstract syncIncomeStatements(...args: any[]);
	abstract syncCashFlowStatements(...args: any[]);
	protected async archiveRequest(data: Object, task_code: string) {
		const connection = this.getDBConnection();
		if (connection) {
			const platformName: string = getPlatformFromId(connection.platform_id);
			await uploadRawIntegrationDataToS3(data, connection.business_id, task_code || "accounting", DIRECTORIES.ACCOUNTING, "rutter");
		}
	}
	public async getAllAccountingIntegrations({ businessID }: { businessID: UUID }) {
		try {
			const getAccountingDetailsResult = await db
				.select("*")
				.from("integrations.data_connections")
				.join("integrations.core_integrations_platforms", "core_integrations_platforms.id", "=", "data_connections.platform_id")
				.where({ "data_connections.business_id": businessID, "core_integrations_platforms.category_id": INTEGRATION_CATEGORIES.ACCOUNTING });

			if (!getAccountingDetailsResult) {
				// this means integration does not exists
				throw new AccountingApiError("No integrations found", {}, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const records = getAccountingDetailsResult.map(integration => {
				const { integration_id, status, business_id, label: integrationLabel } = integration;

				return {
					[integrationLabel]: {
						business_id,
						integration_id,
						status
					}
				};
			});

			return {
				records
			};
		} catch (error) {
			throw error;
		}
	}
	public getDbConnectionId(): UUID {
		const connection = this.getDBConnection();
		if (connection && connection.id) {
			return connection.id;
		}
		throw new AccountingApiError("connection not initialized");
	}
}
