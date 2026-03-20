import { CONNECTION_STATUS, INTEGRATION_ID, kafkaEvents } from "#constants";
import { getOrCreateConnection, logger, updateConnectionByConnectionId } from "#helpers";
import { validateMessage } from "#middlewares";
import { UUID } from "crypto";
import { schema } from "./schema";
import { IDBConnection } from "#types";

enum IntegrationUpdatedBodyKeys {
	"document_signed"
}

type IntegrationUpdatedBodyKeysType = keyof typeof IntegrationUpdatedBodyKeys;

interface IntegrationUpdatedBody {
	business_id: UUID;
	key: IntegrationUpdatedBodyKeysType;
	integration: "Taxation";
	config?: Record<string, any>;
}

class ElectronicConsentEventHandler {
	async handleEvent(message: any) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.INTEGRATION_UPDATED:
					validateMessage(schema.integrationUpdated, payload);
					await this.integrationUpdated(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	async integrationUpdated(body: IntegrationUpdatedBody) {
		try {
			// mark connection and status based on integration key
			switch (body.integration) {
				case "Taxation":
					await this._handleTaxationIntegrationUpdated(body);
					break;

				default:
					logger.error(`${body.integration} integration not found`);
					break;
			}
			logger.debug(`integration_updated_event handled successfully`);
		} catch (error) {
			throw error;
		}
	}

	// Handle Taxation Integration Updated Event
	private async _handleTaxationIntegrationUpdated(body: IntegrationUpdatedBody) {
		try {
			const connection: IDBConnection = await getOrCreateConnection(body.business_id, INTEGRATION_ID.ELECTRONIC_SIGNATURE);

			switch (body.key) {
				case "document_signed":
					// mark the connection as SUCCESS
					await updateConnectionByConnectionId(connection.id, CONNECTION_STATUS.SUCCESS, body.config);
					break;

				default:
					logger.error(`Invalid Taxation integration key: ${body.key}`);
					break;
			}
		} catch (error: any) {
			logger.error(`Error handling Taxation integration updated event: ${error.message}`);
			throw error;
		}
	}
}

export const electronicConsentEventsHandler = new ElectronicConsentEventHandler();
