import { sqlQuery, sqlTransaction } from "#helpers/database";
import { UUID } from "crypto";
import { customerIntegrationSettings } from "./customer-integration-settings";
import { CustomerIntegrationSettingsData, CustomerIntegrationSettingsSettingsData } from "./types";
import { logger } from "#helpers/index";
import { DEFAULT_CUSTOMER_INTEGRATION_SETTINGS } from "#constants/customer-integration-settings.constants";
class CustomerIntegrationSettingsRepository {
	async findById(customerId: UUID): Promise<CustomerIntegrationSettingsData | null> {
		const query = `select * from data_customer_integration_settings dcis where dcis.customer_id = $1`;
		const response = await sqlQuery({ sql: query, values: [customerId] });

		if (response.rowCount === 0) {
			return {
				customer_id: customerId,
				settings: DEFAULT_CUSTOMER_INTEGRATION_SETTINGS
			};
		}
		return response.rows[0];
	}

	async update(
		customerId: UUID,
		settings: CustomerIntegrationSettingsSettingsData
	): Promise<CustomerIntegrationSettingsData> {
		const query = `
					INSERT INTO public.data_customer_integration_settings (customer_id, settings)
					VALUES ($2, $1::jsonb)
					ON CONFLICT (customer_id) 
					DO UPDATE SET settings = COALESCE(data_customer_integration_settings.settings, '{}'::jsonb) || EXCLUDED.settings
					RETURNING customer_id as "customerID", settings;
				`;

		const value = [JSON.stringify(settings), customerId];

		const response = await sqlQuery({ sql: query, values: value });

		logger.info(`🚀 ~ CustomerIntegrationSettingsRepository ~ update ~ response: ${JSON.stringify(response.rows)}`);

		return response.rows?.[0];
	}

	async create(
		customerId: UUID,
		settings: CustomerIntegrationSettingsSettingsData
	): Promise<CustomerIntegrationSettingsData> {
		const query = `
			INSERT INTO public.data_customer_integration_settings (customer_id, settings)
			VALUES ($1, $2)
			ON CONFLICT (customer_id) DO UPDATE SET settings = EXCLUDED.settings
			RETURNING customer_id as "customerID", settings;
		`;

		const value = [customerId, JSON.stringify(settings)];

		const response = await sqlTransaction([query], [value]);

		return response[0]?.rows?.[0];
	}
}

export const customerIntegrationSettingsRepository = new CustomerIntegrationSettingsRepository();
