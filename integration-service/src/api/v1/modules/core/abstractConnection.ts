import { CONNECTION_STATUS, ConnectionStatus, ERROR_CODES, INTEGRATION_ID, IntegrationPlatform } from "#constants";
import { db } from "#helpers/knex";
import { StatusCodes } from "http-status-codes";
import { CoreApiError } from "./error";

import type { TDateISO } from "#types/datetime";
import type { IDBConnection, IDBConnectionEgg } from "#types/db";
import type { UUID } from "crypto";
/* Meant to be extended by another class or used as part of a Mixin */
export default abstract class AbstractConnection {
	protected dbConnection: IDBConnection | undefined;
	private readonly CONNECTIONS_TABLE_NAME = "integrations.data_connections";
	private readonly HISTORY_TABLE_NAME = "integrations.data_connections_history";

	constructor(dbConnection?: IDBConnection) {
		if (dbConnection) {
			this.dbConnection = dbConnection;
		}
	}

	deactivateConnection() {
		this.updateConnectionStatus(CONNECTION_STATUS.FAILED);
	}

	/**
	 * Insert or update a Connection record for a business:platform relationship  -- insert appropriate entry into connection_history table
	 * @param connectionEgg : the DBConnection without ID -- this is what will be inserted or updated
	 * @returns Promise<IDBConnection> - a Promise for the created/updated DBConnection -- scrubbed of the `configuration` key since it most likely has sensitive info
	 * throws if it cannot create or update the connection
	 */
	public async initializeConnection(connectionEgg: IDBConnectionEgg): Promise<IDBConnection> {
		// A connection with a status of any of these can be updated, otherwise it'll throw.
		const statusesThatCanBeUpdated: ConnectionStatus[] = [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS, CONNECTION_STATUS.REVOKED, CONNECTION_STATUS.NEEDS_ACTION];
		const now: TDateISO = new Date().toISOString() as TDateISO;

		//Check if already exists
		const existingConnection = await db<IDBConnection>(this.CONNECTIONS_TABLE_NAME).select("*").where({ business_id: connectionEgg.business_id, platform_id: connectionEgg.platform_id }).first();
		let connection: IDBConnection | undefined;
		if (existingConnection && existingConnection.id) {
			//never surface the access token!
			delete existingConnection.configuration;
			if (statusesThatCanBeUpdated.includes(existingConnection.connection_status)) {
				const updatedConnection = await db<IDBConnection>(this.CONNECTIONS_TABLE_NAME)
					.update({ ...connectionEgg, updated_at: now })
					.where({ business_id: connectionEgg.business_id, platform_id: connectionEgg.platform_id })
					.returning("*");
				if (updatedConnection[0] && updatedConnection[0].id) {
					connection = updatedConnection[0];
				}
			}
		} else {
			const insertConnection = await db<IDBConnection>(this.CONNECTIONS_TABLE_NAME)
				.insert({ ...connectionEgg, created_at: now })
				.returning("*");
			if (insertConnection[0] && insertConnection[0].id) {
				connection = insertConnection[0];
			}
		}
		if (connection) {
			this.dbConnection = { ...connection };
			await db(this.HISTORY_TABLE_NAME).insert({
				connection_id: this.getDbConnectionId(),
				connection_status: connectionEgg.connection_status,
				log: { trigger: "initializeConnection()", previousState: existingConnection, newState: connection }
			});
			delete connection.configuration;
			return connection;
		}
		throw new CoreApiError("A connection could not be created or updated", StatusCodes.EXPECTATION_FAILED, ERROR_CODES.UNKNOWN_ERROR);
	}
	public hasConnection(): boolean {
		return this.dbConnection != undefined;
	}
	public getDBConnection(): IDBConnection | undefined {
		return this.dbConnection;
	}
	public getPlatform(): IntegrationPlatform {
		const connection = this.getDBConnection();
		if (!connection || !connection.platform_id) {
			throw new Error(`Connection not defined`);
		}

		const validatedPlatform = Object.keys(INTEGRATION_ID).find(key => INTEGRATION_ID[key] === connection.platform_id) as IntegrationPlatform | undefined;
		if (validatedPlatform) {
			return validatedPlatform as IntegrationPlatform;
		}
		throw new Error(`Invalid integration platform ${connection.platform_id}`);
	}
	public async updateConnectionStatus(connection_status: keyof typeof CONNECTION_STATUS, log?: string): Promise<void> {
		await Promise.all([
			db<IDBConnection>(this.CONNECTIONS_TABLE_NAME)
				.update({ connection_status, updated_at: new Date().toISOString() as TDateISO })
				.where({ id: this.getDbConnectionId() }),
			db(this.HISTORY_TABLE_NAME).insert({ connection_id: this.getDbConnectionId(), connection_status, log: log || "" })
		]);
	}

	public getDbConnectionId(): UUID {
		const connection = this.getDBConnection();
		if (connection && connection.id) {
			return connection.id;
		}
		throw new CoreApiError("connection not initialized");
	}
}

/* Use if we need to use AbstractConnection as part of a Mixin versus extending */
export const applyAbstractConnection = derivedClass => {
	Object.assign(derivedClass.prototype, AbstractConnection.prototype);
};
