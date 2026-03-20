import { TaskHandlerMap, TaskManager } from "#api/v1/modules/tasks/taskManager";
import { ERROR_CODES } from "#constants/error-codes.constant";
import { INTEGRATION_CATEGORIES } from "#constants/integrations.constant";
import { db } from "#helpers/knex";
import type { IDBConnection } from "#types/db";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { BureauApiError } from "./error";

/* Classes that handle bureau integrations should extend this abstract class */

abstract class BureauBase extends TaskManager {
	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
	}

	abstract taskHandlerMap: TaskHandlerMap;
	abstract callbackHandler(...args: any[]);
	abstract initialUpdate(...args: any[]);
	protected abstract getScore(...args: any[]);
	protected abstract archiveRequest(...args: any[]);

	public async getAllBureauIntegrations({ businessID }: { businessID: UUID }) {
		try {
			const getBureauIntegrations = await db
				.select("*")
				.from("integrations.data_connections")
				.join("integrations.core_integrations_platforms", "core_integrations_platforms.id", "=", "data_connections.platform_id")
				.where({ "data_connections.business_id": businessID, "core_integrations_platforms.category_id": INTEGRATION_CATEGORIES.BUREAU });

			if (!getBureauIntegrations) {
				// this means integration does not exists
				throw new BureauApiError("No integrations found", {}, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const records = getBureauIntegrations.map(integration => {
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
}

export default BureauBase;
