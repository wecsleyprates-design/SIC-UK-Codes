// TODO: Remove the @ts-nocheck and fix whatever problems it is masking
// @ts-nocheck
import { sqlQuery } from "#helpers/index";
import { db } from "#helpers/knex";
import type { UUID } from "crypto";
import type { AgingConfig } from "../../modules/businesses/types";

class ApplicantConfig {
	async getCustomerApplicantConfig(params: { customerID: UUID; coreConfigID: number }) {
		try {
			const getConfigQuery =
				"SELECT id, config, is_enabled FROM public.data_customer_applicant_configs WHERE customer_id = $1 AND core_config_id = $2 ORDER BY id DESC LIMIT 1";
			const values = [params.customerID, params.coreConfigID];
			const result = await sqlQuery({ sql: getConfigQuery, values });
			if (!result || !result.rows || !result.rows.length) {
				return null;
			}
			return result.rows[0];
		} catch (err) {
			throw err;
		}
	}

	async updateCustomerApplicantConfig(
		params: { customerID: UUID; coreConfigID: number },
		body: Array<{ urgency: string; threshold?: number; allowed_case_status?: number[]; message?: string }>
	) {
		try {
			const existing = await this.getCustomerApplicantConfig({
				customerID: params.customerID,
				coreConfigID: params.coreConfigID
			});

			if (!existing) {
				throw new Error("Customer applicant config not found");
			}

			const updateQuery = `UPDATE public.data_customer_applicant_configs SET config = $1	WHERE customer_id = $2 AND core_config_id = $3 RETURNING *`;
			const values = [JSON.stringify(body), params.customerID, params.coreConfigID];
			const result = await sqlQuery({ sql: updateQuery, values });

			return {
				id: result.rows[0].id,
				config: result.rows[0].config,
				is_enabled: result.rows[0].is_enabled
			};
		} catch (err) {
			throw err;
		}
	}

	async updateCustomerApplicantStatus(
		params: { customerID: UUID; coreConfigID: number },
		body: { is_enabled: boolean }
	) {
		try {
			const getConfigQuery =
				"SELECT id, config, is_enabled FROM public.data_customer_applicant_configs WHERE customer_id = $1 AND core_config_id = $2 ORDER BY id DESC LIMIT 1";
			const values = [params.customerID, params.coreConfigID];
			const result = await sqlQuery({ sql: getConfigQuery, values });
			if (result.rowCount === 0) {
				if (!body.is_enabled) {
					throw new Error("Cannot disable non-existing customer applicant config");
				}
				// copy core config and enable it
				const insertQuery = `INSERT INTO public.data_customer_applicant_configs (customer_id, core_config_id, config, is_enabled) VALUES ($1, $2, (SELECT config FROM public.core_applicant_configs WHERE id = $3), $4) RETURNING *`;
				const insertValues = [params.customerID, params.coreConfigID, params.coreConfigID, body.is_enabled];
				const insertResult = await sqlQuery({ sql: insertQuery, values: insertValues });
				return {
					id: insertResult.rows[0].id,
					config: insertResult.rows[0].config,
					is_enabled: insertResult.rows[0].is_enabled
				};
			}
			const updateQuery = `UPDATE public.data_customer_applicant_configs SET is_enabled = $1 WHERE customer_id = $2 AND core_config_id = $3 RETURNING *`;
			const updateValues = [body.is_enabled, params.customerID, params.coreConfigID];
			const updateResult = await sqlQuery({ sql: updateQuery, values: updateValues });
			return {
				id: updateResult.rows[0].id,
				config: updateResult.rows[0].config,
				is_enabled: updateResult.rows[0].is_enabled
			};
		} catch (err) {
			throw err;
		}
	}

	async getBusinessApplicantConfig(params: { businessID: UUID; coreConfigID: number }) {
		try {
			const getConfigQuery =
				"SELECT id, config, is_enabled FROM public.data_business_applicant_configs WHERE business_id = $1 AND core_config_id = $2 ORDER BY id DESC LIMIT 1";
			const values = [params.businessID, params.coreConfigID];
			const result = await sqlQuery({ sql: getConfigQuery, values });
			if (!result || !result.rows || !result.rows.length) {
				return null;
			}
			return result.rows[0];
		} catch (err) {
			throw err;
		}
	}

	async updateBusinessApplicantConfig(
		params: { businessID: UUID; coreConfigID: number },
		body: Array<{ urgency: string; threshold?: number; allowed_case_status?: number[]; message?: string }>
	) {
		try {
			const existing = await this.getBusinessApplicantConfig({
				businessID: params.businessID,
				coreConfigID: params.coreConfigID
			});

			if (!existing) {
				throw new Error("Business applicant config not found");
			}

			const updateQuery = `UPDATE public.data_business_applicant_configs SET config = $1 WHERE business_id = $2 AND core_config_id = $3 RETURNING *`;
			const values = [JSON.stringify(body), params.businessID, params.coreConfigID];
			const result = await sqlQuery({ sql: updateQuery, values });

			return {
				id: result.rows[0].id,
				config: result.rows[0].config,
				is_enabled: result.rows[0].is_enabled
			};
		} catch (err) {
			throw err;
		}
	}

	async updateBusinessApplicantStatus(
		params: { businessID: UUID; coreConfigID: number },
		body: { is_enabled: boolean }
	) {
		try {
			const getConfigQuery =
				"SELECT id, config, is_enabled FROM public.data_business_applicant_configs WHERE business_id = $1 AND core_config_id = $2 ORDER BY id DESC LIMIT 1";
			const values = [params.businessID, params.coreConfigID];
			const result = await sqlQuery({ sql: getConfigQuery, values });
			if (result.rowCount === 0) {
				if (!body.is_enabled) {
					throw new Error("Cannot disable non-existing business applicant config");
				}
				// copy core config and enable it
				const insertQuery = `INSERT INTO public.data_business_applicant_configs (business_id, core_config_id, config, is_enabled) VALUES ($1, $2, (SELECT config FROM public.core_applicant_configs WHERE id = $3), $4) RETURNING *`;
				const insertValues = [params.businessID, params.coreConfigID, params.coreConfigID, body.is_enabled];
				const insertResult = await sqlQuery({ sql: insertQuery, values: insertValues });
				return {
					id: insertResult.rows[0].id,
					config: insertResult.rows[0].config,
					is_enabled: insertResult.rows[0].is_enabled
				};
			}
			const updateQuery = `UPDATE public.data_business_applicant_configs SET is_enabled = $1 WHERE business_id = $2 AND core_config_id = $3 RETURNING *`;
			const updateValues = [body.is_enabled, params.businessID, params.coreConfigID];
			const updateResult = await sqlQuery({ sql: updateQuery, values: updateValues });
			return {
				id: updateResult.rows[0].id,
				config: updateResult.rows[0].config,
				is_enabled: updateResult.rows[0].is_enabled
			};
		} catch (err) {
			throw err;
		}
	}

		
	/**
	 * Adds or updates applicant configuration for a specific business.
	 * This method retrieves the existing configuration (from business, customer, or core level)
	 * and updates it with new aging thresholds and custom messages.
	 * 
	 * @param businessID - The unique identifier of the business
	 * @param customerID - Optional customer ID to check for customer-level configuration
	 * @param coreConfigID - The core configuration ID (defaults to 1)
	 * @param aging_config - Object containing thresholds and custom messages for aging configuration
	 * @returns Empty object on success
	 */
	async addOrUpdateApplicantConfigForBusiness(
		businessID: UUID,
		customerID?: UUID,
		coreConfigID: number = 1,
		aging_config: AgingConfig
	) {
		try {
			// Query existing config using Knex query builder with UNION ALL
			const result = await db
				.select("config", db.raw("'business' as source"))
				.from("data_business_applicant_configs")
				.where({ business_id: businessID, core_config_id: coreConfigID })
				.unionAll([
					db
						.select("config", db.raw("'customer' as source"))
						.from("data_customer_applicant_configs")
						.where({ customer_id: customerID, core_config_id: coreConfigID }),
					db
						.select("config", db.raw("'core' as source"))
						.from("core_applicant_configs")
						.where({ id: coreConfigID })
				])
				.limit(1);

			const existingBusinessConfig = result[0]?.config;
			// Parse the existing config or use empty array
			const configArray = Array.isArray(existingBusinessConfig) ? existingBusinessConfig : [];

			// Update the config with new thresholds and messages
			const updatedConfig = configArray.map((item: any) => {
				const urgencyKey = item.urgency as 'low' | 'medium' | 'high';
				const updatedItem = { ...item };
				// Update threshold if provided
				if (aging_config.thresholds?.[urgencyKey] !== undefined) {
					updatedItem.threshold = aging_config.thresholds[urgencyKey];
				}

				// Update custom message if provided
				if (aging_config.custom_messages?.[urgencyKey]) {
					updatedItem.message = aging_config.custom_messages[urgencyKey];
				}

				return updatedItem;
			});

			// Insert or update using Knex query builder
			if (result[0]?.source === 'business') {
				await db("data_business_applicant_configs")
					.where({ business_id: businessID, core_config_id: coreConfigID })
					.update({ config: JSON.stringify(updatedConfig), is_enabled: true });
			} else {
				await db("data_business_applicant_configs")
					.insert({
						business_id: businessID,
						core_config_id: coreConfigID,
						config: JSON.stringify(updatedConfig),
						is_enabled: true
					});
			}
			return {};
		} catch (err) {
			console.error("Error in addOrUpdateApplicantConfigForBusiness:", err);
			throw err;
		}
	}
}

export const applicantConfig = new ApplicantConfig();
