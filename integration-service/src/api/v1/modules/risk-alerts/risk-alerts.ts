import { ERROR_CODES, ROLES } from "#constants";
import { StatusCodes } from "http-status-codes";
import { RiskAlertsApiError } from "./error";
import { sqlQuery, sqlTransaction } from "#helpers/database";
import { SqlQueryResult, SqlTransactionResult } from "#types/db";
import { Validator } from "jsonschema";
import {
	getRiskAlertReasonsStatParams,
	getRiskAlertReasonsStatQuery,
	IRiskAlertsQueryResult,
	RisksData
} from "./types";
import { paginate } from "#utils/paginate";
import { getRiskCases, InternalDeleteDuplicateRisksById } from "#helpers/api";
import { buildInsertQuery } from "#utils/queryBuilder";
import { logger } from "#helpers/logger";

class RiskAlerts {
	async addUpdateRiskAlertConfig(body: Record<string, any>, userInfo: Record<string, any>) {
		let is_enabled: boolean;
		// check if the role is admin or customer
		switch (userInfo.role.code) {
			case ROLES.ADMIN:
				break;
			case ROLES.CUSTOMER:
				// check if customer_id is present in the body if role is customer
				if (!body.customer_id) {
					throw new RiskAlertsApiError("customer_id is required", StatusCodes.FORBIDDEN, ERROR_CODES.NOT_ALLOWED);
				}
				// TODO: check if the customer role is allowed to update the config
				break;
			default:
				break;
		}

		if (Object.hasOwn(body, "score_config")) {
			const temp = JSON.parse(JSON.stringify(body.score_config));
			const riskLevels = new Set(temp.map(item => item.risk_level));
			if (riskLevels.size !== 3) {
				throw new RiskAlertsApiError(
					"The array must contain exactly one of each risk_level: LOW, MODERATE, HIGH",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			// Sort based on risk_level order: HIGH, MODERATE, LOW
			const sortedByRiskLevel = temp.slice().sort((a, b) => {
				const order = { HIGH: 1, MODERATE: 2, LOW: 3 };
				return order[a.risk_level] - order[b.risk_level];
			});

			// Check if the min and max ranges are continuous and mutually exclusive
			for (let i = 0; i < sortedByRiskLevel.length - 1; i++) {
				if (sortedByRiskLevel[i].max + 1 !== sortedByRiskLevel[i + 1].min) {
					throw new RiskAlertsApiError(
						"The min and max ranges must be continuous and mutually exclusive",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}
		}

		const getRiskAlertsConfigQuery = `SELECT DRAC.id, DRAC.risk_alert_config_id, DRAC.is_enabled, DRAC.risk_level, CRAC.measurement_operation, CRAC.measurement_config_schema AS schema, DRAC.measurement_config, CRAC.customer_managed, CRT.code AS risk_type_code, CRST.code AS risk_sub_type_code
			FROM data_risk_alerts_config DRAC
			LEFT JOIN core_risk_alerts_config CRAC ON CRAC.id = DRAC.risk_alert_config_id 
			LEFT JOIN core_risk_types CRT ON CRT.id = CRAC.risk_type
			LEFT JOIN core_risk_sub_types CRST ON CRST.id = CRAC.risk_sub_type
			WHERE DRAC.customer_id ${body.customer_id ? `= '${body.customer_id}'` : `IS NULL`}`;

		const getCoreRiskConfigQuery = `SELECT CRAC.*, CRT.code AS risk_type_code, CRST.code AS risk_sub_type_code 
			FROM core_risk_alerts_config CRAC
			LEFT JOIN core_risk_types CRT ON CRT.id = CRAC.risk_type
			LEFT JOIN core_risk_sub_types CRST ON CRST.id = CRAC.risk_sub_type
			WHERE CRAC.risk_sub_type IS NOT NULL`;

		const [riskAlertsConfig, coreRiskAlertConfig]: SqlTransactionResult = await sqlTransaction(
			[getRiskAlertsConfigQuery, getCoreRiskConfigQuery],
			[[], []]
		);

		const mappedRiskAlertsConfigData = this.__mappedRiskAlertConfigs(riskAlertsConfig.rows);

		const mappedCoreConfigData = this.__mappedRiskAlertConfigs(coreRiskAlertConfig.rows);

		// mappedCoreConfigData & mappedRiskAlertsConfigData will be in the following format
		// and both of them will have the same structure
		// riskAlertsConfigData = {
		//  score_config: { HIGH: { id, schema, }, MODERATE: { id, schema }, LOW: { id } },
		//  new_lien: { HIGH: { id, schema }, MODERATE: { id }, LOW: { id } },
		//  equifax_credit_score: { HIGH: { id, schema } }
		// }

		const queries: string[] = [];
		const values: any = [];
		const updateConfigQuery = `UPDATE data_risk_alerts_config SET 
			risk_alert_config_id = $1,
			is_enabled = $2,
			measurement_config = $3,
			risk_level = $4,
			created_by = $5,
			updated_by = $6
			WHERE id = $7 AND customer_id ${body.customer_id ? `= '${body.customer_id}'` : `IS NULL`}`;

		const insertConfigQuery = `INSERT INTO data_risk_alerts_config (risk_alert_config_id, is_enabled, measurement_config, risk_level, customer_id, created_by, updated_by) 
    		VALUES ($1, $2, $3, $4, $5, $6, $7)`;

		// parse the body and generate the risk alert config query
		if (body.score_config) {
			if (mappedRiskAlertsConfigData.score_config) {
				// update the existing score_config
				body.score_config.forEach(item => {
					const data: any = mappedRiskAlertsConfigData.score_config[item.risk_level];
					is_enabled = body?.risk_alert_statuses?.risk_alerts_status;
					const schemaToValidate = { min: item.min, max: item.max };
					if (
						!this.__validateConfigUpdate(
							body.customer_id,
							{ customer_managed: data.customer_managed, schema: data.schema },
							schemaToValidate
						)
					) {
						throw new RiskAlertsApiError("Invalid schema", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
					}
					queries.push(updateConfigQuery);
					values.push([
						data.risk_alert_config_id,
						is_enabled,
						schemaToValidate,
						item.risk_level,
						userInfo.user_id,
						userInfo.user_id,
						data.id
					]);
				});
			} else {
				// insert new score_config
				body.score_config.forEach(item => {
					const data: any = mappedCoreConfigData.score_config[item.risk_level];
					is_enabled = body?.risk_alert_statuses?.risk_alerts_status;
					const schemaToValidate = { min: item.min, max: item.max };
					if (
						!this.__validateConfigUpdate(
							body.customer_id,
							{ customer_managed: data.customer_managed, schema: data.measurement_config_schema },
							schemaToValidate
						)
					) {
						throw new RiskAlertsApiError("Invalid schema", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
					}
					queries.push(insertConfigQuery);
					values.push([
						data.id,
						is_enabled,
						{ min: item.min, max: item.max },
						item.risk_level,
						body.customer_id,
						userInfo.user_id,
						userInfo.user_id
					]);
				});
			}
		}

		if (body.credit_score_config) {
			if (mappedRiskAlertsConfigData.equifax_credit_score) {
				// update config for equifax
				body.credit_score_config.forEach(item => {
					const data: any = mappedRiskAlertsConfigData.equifax_credit_score[item.risk_level];
					is_enabled = body?.risk_alert_statuses?.risk_alerts_status
						? body?.risk_alert_statuses?.credit_score_config_status
						: false;
					const schemaToValidate = { threshold: item.drop_percentage };
					if (
						!this.__validateConfigUpdate(
							body.customer_id,
							{ customer_managed: data.customer_managed, schema: data.schema },
							schemaToValidate
						)
					) {
						throw new RiskAlertsApiError("Invalid schema", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
					}
					queries.push(updateConfigQuery);
					values.push([
						data.risk_alert_config_id,
						is_enabled,
						schemaToValidate,
						item.risk_level,
						userInfo.user_id,
						userInfo.user_id,
						data.id
					]);
				});
			} else {
				// insert new config for equifax
				body.credit_score_config.forEach(item => {
					const data: any = mappedCoreConfigData.equifax_credit_score[item.risk_level];
					is_enabled = body?.risk_alert_statuses?.risk_alerts_status
						? body?.risk_alert_statuses?.credit_score_config_status
						: false;
					const schemaToValidate = { threshold: item.drop_percentage };
					if (
						!this.__validateConfigUpdate(
							body.customer_id,
							{ customer_managed: data.customer_managed, schema: data.measurement_config_schema },
							schemaToValidate
						)
					) {
						throw new RiskAlertsApiError("Invalid schema", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
					}
					queries.push(insertConfigQuery);
					values.push([
						data.id,
						is_enabled,
						schemaToValidate,
						item.risk_level,
						body.customer_id,
						userInfo.user_id,
						userInfo.user_id
					]);
				});
			}
		}

		if (body.worth_score_change_config) {
			if (mappedRiskAlertsConfigData.worth_score_change) {
				// update config for worth_score_change
				body.worth_score_change_config.forEach(item => {
					const data: any = mappedRiskAlertsConfigData.worth_score_change[item.risk_level];
					is_enabled = body?.risk_alert_statuses?.risk_alerts_status
						? body?.risk_alert_statuses?.worth_score_change_status
						: false;
					const schemaToValidate = { threshold: item.drop_value };
					if (
						!this.__validateConfigUpdate(
							body.customer_id,
							{ customer_managed: data.customer_managed, schema: data.schema },
							schemaToValidate
						)
					) {
						throw new RiskAlertsApiError("Invalid schema", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
					}
					queries.push(updateConfigQuery);
					values.push([
						data.risk_alert_config_id,
						is_enabled,
						schemaToValidate,
						item.risk_level,
						userInfo.user_id,
						userInfo.user_id,
						data.id
					]);
				});
			} else {
				// insert new config for worth_score_change
				body.worth_score_change_config.forEach(item => {
					const data: any = mappedCoreConfigData.worth_score_change[item.risk_level];
					is_enabled = body?.risk_alert_statuses?.risk_alerts_status
						? body?.risk_alert_statuses?.worth_score_change_status
						: false;
					const schemaToValidate = { threshold: item.drop_value };
					if (
						!this.__validateConfigUpdate(
							body.customer_id,
							{ customer_managed: data.customer_managed, schema: data.measurement_config_schema },
							schemaToValidate
						)
					) {
						throw new RiskAlertsApiError("Invalid schema", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
					}
					queries.push(insertConfigQuery);
					values.push([
						data.id,
						is_enabled,
						schemaToValidate,
						item.risk_level,
						body.customer_id,
						userInfo.user_id,
						userInfo.user_id
					]);
				});
			}
		}

		// check if new_lien, new_judgement, new_bankruptcy are present in the mappedRiskAlertsConfigData
		if (
			!Object.hasOwn(mappedRiskAlertsConfigData, "new_bankruptcy") &&
			!Object.hasOwn(mappedRiskAlertsConfigData, "new_lien") &&
			!Object.hasOwn(mappedRiskAlertsConfigData, "new_judgement")
		) {
			["new_lien", "new_judgement", "new_bankruptcy"].forEach(item => {
				const data: any = mappedCoreConfigData[item]["HIGH"];
				is_enabled = body?.risk_alert_statuses?.risk_alerts_status
					? body?.risk_alert_statuses?.new_bankruptcy_lien_judgement_status
					: false;
				queries.push(insertConfigQuery);
				values.push([
					data.id,
					is_enabled,
					{ threshold: 1 },
					"HIGH",
					body.customer_id,
					userInfo.user_id,
					userInfo.user_id
				]);
			});
		} else {
			["new_lien", "new_judgement", "new_bankruptcy"].forEach(item => {
				const data: any = mappedRiskAlertsConfigData[item]["HIGH"];
				const schemaToValidate = { threshold: 1 };
				if (
					!this.__validateConfigUpdate(
						body.customer_id,
						{ customer_managed: data.customer_managed, schema: data.schema },
						schemaToValidate
					)
				) {
					throw new RiskAlertsApiError("Invalid schema", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
				}
				is_enabled = body?.risk_alert_statuses?.risk_alerts_status
					? body?.risk_alert_statuses?.new_bankruptcy_lien_judgement_status
					: false;
				queries.push(updateConfigQuery);
				values.push([
					data.risk_alert_config_id,
					is_enabled,
					schemaToValidate,
					"HIGH",
					userInfo.user_id,
					userInfo.user_id,
					data.id
				]);
			});
		}

		const score_risk_tier_transition_config = [
			{ MODERATE: { from: "LOW", to: "MODERATE" } },
			{ HIGH: { from: "MODERATE", to: "HIGH" } },
			{ HIGH: { from: "LOW", to: "HIGH" } }
		];

		if (!Object.hasOwn(mappedRiskAlertsConfigData, "score_risk_tier_transition")) {
			score_risk_tier_transition_config.forEach((obj: any) => {
				const key = Object.keys(obj)[0];
				const item = obj[key];
				const data: any = mappedCoreConfigData.score_risk_tier_transition[key];
				const is_enabled = body?.risk_alert_statuses?.risk_alerts_status
					? body?.risk_alert_statuses?.score_risk_tier_transition_status
					: false;
				const schemaToValidate = { from: item.from, to: item.to };
				queries.push(insertConfigQuery);
				values.push([data.id, is_enabled, schemaToValidate, key, body.customer_id, userInfo.user_id, userInfo.user_id]);
			});
		} else {
			score_risk_tier_transition_config.forEach((obj: any) => {
				const key = Object.keys(obj)[0];
				const item = obj[key];
				let data: any = mappedRiskAlertsConfigData.score_risk_tier_transition[`${key}:${item.from}-${item.to}`];
				const is_enabled = body?.risk_alert_statuses?.risk_alerts_status
					? body?.risk_alert_statuses?.score_risk_tier_transition_status
					: false;
				const schemaToValidate = { from: item.from, to: item.to };
				if (data) {
					queries.push(updateConfigQuery);
					values.push([
						data.risk_alert_config_id,
						is_enabled,
						schemaToValidate,
						key,
						userInfo.user_id,
						userInfo.user_id,
						data.id
					]);
				} else {
					data = mappedCoreConfigData.score_risk_tier_transition[key];
					queries.push(insertConfigQuery);
					values.push([
						data.id,
						is_enabled,
						schemaToValidate,
						key,
						body.customer_id,
						userInfo.user_id,
						userInfo.user_id
					]);
				}
			});
		}

		// check if new_adverse_media are present in the mappedRiskAlertsConfigData
		if (!Object.hasOwn(mappedRiskAlertsConfigData, "new_adverse_media")) {
			const data: any = mappedCoreConfigData.new_adverse_media["MODERATE"];
			is_enabled = body?.risk_alert_statuses?.new_adverse_media ? body?.risk_alert_statuses?.new_adverse_media : false;
			queries.push(insertConfigQuery);
			values.push([
				data.id,
				is_enabled,
				{ threshold: 1 },
				"MODERATE",
				body.customer_id,
				userInfo.user_id,
				userInfo.user_id
			]);
		} else {
			const data: any =
				mappedRiskAlertsConfigData.new_adverse_media["MODERATE"] || mappedRiskAlertsConfigData.new_adverse_media["LOW"];
			const schemaToValidate = { threshold: 1 };
			if (
				!this.__validateConfigUpdate(
					body.customer_id,
					{ customer_managed: data.customer_managed, schema: data.schema },
					schemaToValidate
				)
			) {
				throw new RiskAlertsApiError("Invalid schema", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
			}
			is_enabled = body?.risk_alert_statuses?.new_adverse_media ? body?.risk_alert_statuses?.new_adverse_media : false;
			queries.push(updateConfigQuery);
			values.push([
				data.risk_alert_config_id,
				is_enabled,
				schemaToValidate,
				"MODERATE",
				userInfo.user_id,
				userInfo.user_id,
				data.id
			]);
		}

		await sqlTransaction(queries, values);

		if (body.customer_id && body.score_config && body.credit_score_config && body.worth_score_change_config) {
			return { data: {}, message: "The configurations have been updated successfully." };
		} else if (body.customer_id && body.score_config) {
			return { data: {}, message: "Score ranges updated successfully." };
		} else if (body.customer_id && body.credit_score_config) {
			return { data: {}, message: "Credit score changes updated successfully." };
		} else if (body.customer_id && body.worth_score_change_config) {
			return { data: {}, message: "Worth score change risk alerts updated successfully." };
		}
	}

	async copyRiskAlertConfigFromParent(
		parentCustomerId: string,
		childCustomerId: string,
		userInfo: Record<string, any>
	) {
		try {
			// Get all risk alert configurations from parent customer
			const getParentConfigQuery = `SELECT DRAC.*, CRAC.measurement_operation, CRAC.measurement_config_schema, CRAC.customer_managed, CRT.code AS risk_type_code, CRST.code AS risk_sub_type_code
				FROM data_risk_alerts_config DRAC
				LEFT JOIN core_risk_alerts_config CRAC ON CRAC.id = DRAC.risk_alert_config_id 
				LEFT JOIN core_risk_types CRT ON CRT.id = CRAC.risk_type
				LEFT JOIN core_risk_sub_types CRST ON CRST.id = CRAC.risk_sub_type
				WHERE DRAC.customer_id = $1`;

			const parentConfigResult = await sqlQuery({ sql: getParentConfigQuery, values: [parentCustomerId] });

			if (parentConfigResult.rows.length === 0) {
				logger.info(`No risk alert configurations found for parent customer ${parentCustomerId}`);
				return { data: {}, message: "No parent configurations to copy." };
			}

			// Get existing configurations for child customer
			const getChildConfigQuery = `SELECT DRAC.*, CRAC.measurement_operation, CRAC.measurement_config_schema, CRAC.customer_managed, CRT.code AS risk_type_code, CRST.code AS risk_sub_type_code
				FROM data_risk_alerts_config DRAC
				LEFT JOIN core_risk_alerts_config CRAC ON CRAC.id = DRAC.risk_alert_config_id 
				LEFT JOIN core_risk_types CRT ON CRT.id = CRAC.risk_type
				LEFT JOIN core_risk_sub_types CRST ON CRST.id = CRAC.risk_sub_type
				WHERE DRAC.customer_id = $1`;

			const childConfigResult = await sqlQuery({ sql: getChildConfigQuery, values: [childCustomerId] });
			const existingChildConfigs = new Map();

			// Create a map of existing child configurations by risk_alert_config_id and risk_level
			childConfigResult.rows.forEach((config: any) => {
				const key = `${config.risk_alert_config_id}_${config.risk_level}`;
				existingChildConfigs.set(key, config);
			});

			const updateConfigQuery = `UPDATE data_risk_alerts_config SET 
				risk_alert_config_id = $1,
				is_enabled = $2,
				measurement_config = $3,
				risk_level = $4,
				updated_by = $5
				WHERE id = $6 AND customer_id = $7`;

			const insertConfigQuery = `INSERT INTO data_risk_alerts_config (risk_alert_config_id, is_enabled, measurement_config, risk_level, customer_id, created_by, updated_by) 
				VALUES ($1, $2, $3, $4, $5, $6, $7)`;

			const queries: string[] = [];
			const values: any[] = [];
			let updateCount = 0;
			let insertCount = 0;

			// Process each parent configuration
			parentConfigResult.rows.forEach((parentConfig: any) => {
				const key = `${parentConfig.risk_alert_config_id}_${parentConfig.risk_level}`;
				const existingChildConfig = existingChildConfigs.get(key);

				if (existingChildConfig) {
					// Update existing configuration
					queries.push(updateConfigQuery);
					values.push([
						parentConfig.risk_alert_config_id,
						parentConfig.is_enabled,
						parentConfig.measurement_config,
						parentConfig.risk_level,
						userInfo.user_id,
						existingChildConfig.id,
						childCustomerId
					]);
					updateCount++;
				} else {
					// Insert new configuration
					queries.push(insertConfigQuery);
					values.push([
						parentConfig.risk_alert_config_id,
						parentConfig.is_enabled,
						parentConfig.measurement_config,
						parentConfig.risk_level,
						childCustomerId,
						userInfo.user_id,
						userInfo.user_id
					]);
					insertCount++;
				}
			});

			// Execute all queries in a transaction
			if (queries.length > 0) {
				await sqlTransaction(queries, values);
			}

			logger.info(
				`Successfully processed ${parentConfigResult.rows.length} risk alert configurations from parent customer ${parentCustomerId} to child customer ${childCustomerId}. Updated: ${updateCount}, Inserted: ${insertCount}`
			);

			return {
				data: {},
				message: `Successfully processed ${parentConfigResult.rows.length} risk alert configurations from parent customer. Updated: ${updateCount}, Inserted: ${insertCount}`
			};
		} catch (error) {
			logger.error(
				error,
				`Error copying risk alert configurations from parent ${parentCustomerId} to child ${childCustomerId}:`
			);
			throw error;
		}
	}

	async getRiskAlertConfig(customerID: string) {
		try {
			const getRiskAlertsConfigQuery = `SELECT DRAC.*, CRAC.measurement_operation, CRT.code AS risk_type_code, CRST.code AS risk_sub_type_code
				FROM data_risk_alerts_config DRAC
				LEFT JOIN core_risk_alerts_config CRAC ON CRAC.id = DRAC.risk_alert_config_id 
				LEFT JOIN core_risk_types CRT ON CRT.id = CRAC.risk_type
				LEFT JOIN core_risk_sub_types CRST ON CRST.id = CRAC.risk_sub_type
				WHERE additional-query`;

			const customerQuery = getRiskAlertsConfigQuery.replace("additional-query", `DRAC.customer_id = $1`);
			const adminQuery = getRiskAlertsConfigQuery.replace("additional-query", `DRAC.customer_id IS NULL`);
			const [customerRiskAlertsConfig, adminRiskAlertConfig] = await sqlTransaction(
				[customerQuery, adminQuery],
				[[customerID], []]
			);

			const mappedCustomerRiskAlertsConfigData = this.__mappedRiskAlertConfigs(customerRiskAlertsConfig.rows);
			const mappedAdminRiskAlertsConfigData = this.__mappedRiskAlertConfigs(adminRiskAlertConfig.rows);
			return { customer: mappedCustomerRiskAlertsConfigData, admin: mappedAdminRiskAlertsConfigData };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function maps the risk alert config data to a structured object.
	 * @param data : Array of risk alert config data
	 * @returns {Object} And it returns the structured object in sameway for the core config data & risk alert config data
	 */
	__mappedRiskAlertConfigs(data: any[]) {
		const risk_alert_statuses = {
			risk_alerts_status: false,
			score_risk_tier_transition_status: false,
			new_bankruptcy_lien_judgement_status: false,
			worth_score_change_status: false,
			credit_score_config_status: false,
			new_adverse_media: false
		};
		let mappedRiskAlertsConfigData = data.reduce((acc, row) => {
			switch (row.risk_sub_type_code) {
				case "new_lien": {
					acc = this.__addRiskLevel(row.risk_level, acc, "new_lien", row);
					risk_alert_statuses.new_bankruptcy_lien_judgement_status = row.is_enabled;
					// if (!Object.hasOwn(acc, "new_lien")) acc.new_lien = {};
					// acc.new_lien[row.risk_level] = row;
					return acc;
				}
				case "new_judgement": {
					acc = this.__addRiskLevel(row.risk_level, acc, "new_judgement", row);
					risk_alert_statuses.new_bankruptcy_lien_judgement_status = row.is_enabled;
					// if (!Object.hasOwn(acc, "new_judgement")) acc.new_judgement = {};
					// acc.new_judgement[row.risk_level] = row;
					return acc;
				}
				case "new_bankruptcy": {
					acc = this.__addRiskLevel(row.risk_level, acc, "new_bankruptcy", row);
					risk_alert_statuses.new_bankruptcy_lien_judgement_status = row.is_enabled;
					// if (!Object.hasOwn(acc, "new_bankruptcy")) acc.new_bankruptcy = {};
					// acc.new_bankruptcy[row.risk_level] = row;
					return acc;
				}
				case "equifax_credit_score": {
					acc = this.__addRiskLevel(row.risk_level, acc, "equifax_credit_score", row);
					risk_alert_statuses.credit_score_config_status = row.is_enabled;
					// if (!Object.hasOwn(acc, "equifax_credit_score")) acc.equifax_credit_score = {};
					// acc.equifax_credit_score[row.risk_level] = row;
					return acc;
				}
				case "score_range": {
					acc = this.__addRiskLevel(row.risk_level, acc, "score_config", row);
					risk_alert_statuses.risk_alerts_status = row.is_enabled;
					// if (!Object.hasOwn(acc, "score_config")) acc.score_config = {};
					// acc.score_config[row.risk_level] = row;
					return acc;
				}
				case "worth_score_change": {
					acc = this.__addRiskLevel(row.risk_level, acc, "worth_score_change", row);
					risk_alert_statuses.worth_score_change_status = row.is_enabled;
					return acc;
				}
				case "integration_failure": {
					acc = this.__addRiskLevel(row.risk_level, acc, "integration_failure", row);
					return acc;
				}
				case "score_risk_tier_transition": {
					if (row.measurement_config && row.measurement_config.from && row.measurement_config.to) {
						acc = this.__addRiskLevel(
							`${row.risk_level}:${row.measurement_config.from}-${row.measurement_config.to}`,
							acc,
							"score_risk_tier_transition",
							row
						);
					} else {
						acc = this.__addRiskLevel(row.risk_level, acc, "score_risk_tier_transition", row);
					}
					risk_alert_statuses.score_risk_tier_transition_status = row.is_enabled;
					return acc;
				}
				case "new_adverse_media": {
					acc = this.__addRiskLevel(row.risk_level, acc, "new_adverse_media", row);
					risk_alert_statuses.new_adverse_media = row.is_enabled;
					return acc;
				}
				default: {
					return acc;
				}
			}
		}, {});

		mappedRiskAlertsConfigData = {
			...mappedRiskAlertsConfigData,
			risk_alert_statuses
		};

		return mappedRiskAlertsConfigData;
	}

	/**
	 *
	 * @param riskLevel
	 * @param dataObject
	 * @param parentKey
	 * @param value
	 * @returns
	 */
	__addRiskLevel(riskLevel: string, dataObject: Object, parentKey: string, value: Object) {
		if (!Object.hasOwn(dataObject, parentKey)) dataObject[parentKey] = {};
		if (riskLevel) {
			dataObject[parentKey][riskLevel] = value;
		} else {
			dataObject[parentKey]["HIGH"] = value;
			dataObject[parentKey]["MODERATE"] = value;
			dataObject[parentKey]["LOW"] = value;
		}

		return dataObject;
	}

	/**
	 * @description This function validates the schema of the config data & checks for customer managed or admin managed configs
	 * @param {string} customerID : Customer ID
	 * @param {Object} coreConfig : Core config data
	 * @param {boolean} coreConfig.customer_managed : Customer managed or Admin managed
	 * @param {JSON} coreConfig.schema : Schema of the core config data
	 * @param {Object} schemaToValidate : Schema to validate
	 * @returns
	 */
	__validateConfigUpdate(customerID: string, coreConfig: Record<string, any>, schemaToValidate: Object) {
		if (customerID && !coreConfig.customer_managed) {
			throw new RiskAlertsApiError(
				"You are not authorized to update Admin managed Risk Alerts configs",
				StatusCodes.FORBIDDEN,
				ERROR_CODES.NOT_ALLOWED
			);
		}

		const validator = new Validator();
		try {
			const res = validator.validate(schemaToValidate, coreConfig.schema);
			return res.valid;
		} catch (error) {
			throw new RiskAlertsApiError("Invalid schema", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	/**
	 * This function is to get the Stats for the Risk Alert Reasons
	 * @param params
	 * @param query
	 * @param userInfo
	 * @returns array of objects containing monthly data for given or latest year
	 */
	async getRiskAlertReasonsStat(params: getRiskAlertReasonsStatParams, query: getRiskAlertReasonsStatQuery) {
		try {
			let year: string;
			if (!Object.hasOwn(query, "period")) {
				const getLatestYearQuery = `SELECT EXTRACT(YEAR FROM MAX(created_at)) AS latest_year
						FROM data_risk_alerts
						WHERE customer_id = $1`;
				const latestYearResult: SqlQueryResult = await sqlQuery({
					sql: getLatestYearQuery,
					values: [params.customerID]
				});

				if (!latestYearResult.rows.length || !latestYearResult.rows[0].latest_year) {
					// no businesses onboarded yet
					const currentYear = new Date().getFullYear();
					return {
						result: [],
						period: currentYear
					};
				} else {
					year = latestYearResult.rows[0].latest_year;
				}
			} else {
				year = query.period;
			}
			const allowedFilterParams = ["data_risk_alerts_config.risk_level"];
			let existingFilterParamsValues: { column: string; value: any }[] = [];
			if (query.filter) {
				existingFilterParamsValues = Object.keys(query.filter).reduce((acc, field) => {
					if (allowedFilterParams.includes(field)) {
						let value;
						// reduce an array into a comma separated string
						if (Array.isArray(query.filter[field])) {
							value = query.filter[field].reduce((str, item) => {
								if (typeof item === "string") {
									str = str.concat(`'${item}'`, ",");
								} else {
									str = str.concat(`${item}`, ",");
								}
								return str;
							}, "");
							value = value.slice(0, -1); // remove the last comma
						} else if (typeof query.filter[field] === "string") {
							value = `'${query.filter[field]}'`;
						} else {
							value = query.filter[field].toString();
						}

						const filter = {
							column: field,
							value
						};
						acc.push(filter);
						return acc;
					}
					return acc;
				}, [] as any[]);
			}
			let counter = 1;
			let queryParams = "";
			if (existingFilterParamsValues.length) {
				let filter = " AND ";
				counter++;
				filter += existingFilterParamsValues
					.reduce((acc, field) => {
						acc.push(`${field.column} IN (${field.value})`);
						return acc;
					}, [] as any[])
					.join(" AND ");
				queryParams += filter;
			}
			const getAllRiskAlertsQuery = `SELECT DATE_TRUNC('month', data_risk_alerts.created_at) AS month_in_tz, 
				to_char(DATE_TRUNC('month', data_risk_alerts.created_at), 'Month') AS month, core_risk_sub_types.code as sub_type_code, 
				count(core_risk_sub_types.code)
				FROM data_risk_alerts
				LEFT JOIN data_risk_alerts_config ON data_risk_alerts_config.id = data_risk_alerts.risk_alert_config_id
				LEFT JOIN core_risk_alerts_config ON core_risk_alerts_config.id = data_risk_alerts_config.risk_alert_config_id
				LEFT JOIN core_risk_sub_types ON core_risk_sub_types.id = core_risk_alerts_config.risk_sub_type
				WHERE data_risk_alerts.customer_id = $1
					AND EXTRACT(YEAR FROM data_risk_alerts.created_at) = $2
					${queryParams}
				GROUP BY month_in_tz, core_risk_sub_types.code
				ORDER BY month_in_tz`;
			const getAllRiskAlertsResult: SqlQueryResult = await sqlQuery({
				sql: getAllRiskAlertsQuery,
				values: [params.customerID, year]
			});

			const risksData: RisksData[] = getAllRiskAlertsResult.rows;

			const riskAlertsStat = risksData.reduce((acc, row) => {
				const trimmedMonth = row.month.trim();
				if (!Object.hasOwn(acc, trimmedMonth)) {
					acc[trimmedMonth] = {
						credit_score: 0,
						worth_score: 0,
						judgements_liens: 0,
						others: 0
					};
				}

				switch (row.sub_type_code) {
					case "new_lien":
					case "new_judgement":
					case "new_bankruptcy":
						acc[trimmedMonth].judgements_liens += parseInt(row.count);
						break;

					case "equifax_credit_score":
						acc[trimmedMonth].credit_score += parseInt(row.count);
						break;

					case "score_range":
						acc[trimmedMonth].worth_score += parseInt(row.count);
						break;

					case "worth_score_change":
						acc[trimmedMonth].worth_score += parseInt(row.count);
						break;

					case "score_risk_tier_transition":
						acc[trimmedMonth].worth_score += parseInt(row.count);
						break;

					default:
						acc[trimmedMonth].others += parseInt(row.count);
						break;
				}

				return acc;
			}, {});

			const result = Object.keys(riskAlertsStat).map(key => {
				return {
					...riskAlertsStat[key],
					month: key
				};
			});

			return {
				result,
				period: year
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function is to get all the risk alerts
	 * @param query : query params like filters, sort, pagination
	 * @returns risk alerts
	 */
	async getRiskAlerts(query: any) {
		try {
			let pagination = true;

			if (Object.hasOwn(query, "pagination")) {
				pagination = JSON.parse(query.pagination);
			}

			let itemsPerPage: number = 20,
				page: number = 1;
			if (pagination) {
				if (query.items_per_page) {
					itemsPerPage = query.items_per_page as number;
				}

				if (query.page) {
					page = query.page as number;
				}
			}

			let queryParams = "";

			const allowedSortParams = ["data_risk_alerts.created_at"];
			let sortParam = "data_risk_alerts.created_at";
			let sortParamValue = "DESC";
			if (query.sort) {
				const param = Object.keys(query.sort)[0];
				if (allowedSortParams.includes(param)) {
					sortParam = param;
					sortParamValue = query.sort[sortParam];
				}
			}

			type Params = {
				column: string;
				value: string | any;
			};

			const allowedFilterParams = ["data_risk_alerts.id", "customer_id", "risk_level", "risk_type", "risk_sub_type"];
			let existingFilterParamsValues: Params[] = [];
			if (query.filter) {
				existingFilterParamsValues = Object.keys(query.filter).reduce((acc, field) => {
					if (allowedFilterParams.includes(field)) {
						let value;
						// parse string to boolean
						if (query.filter[field] === "true" || query.filter[field] === "false") {
							value = JSON.parse(query.filter[field]);
						}

						// reduce an array into a comma separated string
						if (Array.isArray(query.filter[field])) {
							value = query.filter[field].reduce((str, item) => {
								if (typeof item === "string") {
									str = str.concat(`'${item}'`, ",");
								} else {
									str = str.concat(`${item}`, ",");
								}
								return str;
							}, "");
							value = value.slice(0, -1); // remove the last comma
						} else if (typeof query.filter[field] === "string") {
							value = `'${query.filter[field]}'`;
						} else {
							value = query.filter[field].toString();
						}
						if (value !== "") {
							const filter = {
								column: field,
								value
							};
							acc.push(filter);
						}
						return acc;
					}
					return acc;
				}, [] as Params[]);
			}

			const allowedFilterDateParams = ["data_risk_alerts.created_at"];
			let existingFilterDateParamsValues: Params[] = [];
			if (query.filter_date) {
				existingFilterDateParamsValues = Object.keys(query.filter_date).reduce((acc, field) => {
					if (allowedFilterDateParams.includes(field)) {
						const filterDate = {
							column: field,
							value: query.filter_date[field].toString()
						};
						acc.push(filterDate);
						return acc;
					}
					return acc;
				}, [] as Params[]);
			}

			let counter = 0;
			if (existingFilterParamsValues.length) {
				let filter = `${counter ? " AND " : " WHERE "}`;
				counter++;
				filter += existingFilterParamsValues
					.reduce((acc, field) => {
						acc.push(`${field.column} IN (${field.value})`);
						return acc;
					}, [] as any)
					.join(" AND ");
				queryParams += filter;
			}

			if (existingFilterDateParamsValues.length && existingFilterDateParamsValues?.[0]?.value?.length !== 0) {
				let filterDate = `${counter ? " AND " : " WHERE "}`;
				counter++;
				filterDate += existingFilterDateParamsValues
					.reduce((acc, field) => {
						const values = field.value.split(",");
						acc.push(`${field.column} >= '${values[0]}' AND ${field.column} <= '${values[1]}'`);
						return acc;
					}, [] as string[])
					.join(" AND ");
				queryParams += filterDate;
			}

			const sort = ` ORDER BY ${sortParam} ${sortParamValue} `;
			queryParams += sort;

			// TODO: check use of customer_id in the query
			let getRiskAlertQuery = `SELECT subquery.* FROM (SELECT data_risk_alerts.*, data_risk_alerts_config.risk_level, core_risk_sub_types.code AS risk_sub_type_code, core_risk_types.code AS risk_type_code FROM data_risk_alerts
      LEFT JOIN data_risk_alerts_config ON data_risk_alerts_config.id = data_risk_alerts.risk_alert_config_id
      LEFT JOIN core_risk_alerts_config ON core_risk_alerts_config.id = data_risk_alerts_config.risk_alert_config_id
      LEFT JOIN core_risk_types ON core_risk_types.id = core_risk_alerts_config.risk_type
      LEFT JOIN core_risk_sub_types ON core_risk_sub_types.id = core_risk_alerts_config.risk_sub_type
      ${queryParams} ) AS subquery `;

			const RiskAlertsCountQuery = `SELECT count(subquery.id) as totalCount FROM (SELECT data_risk_alerts.*, core_risk_sub_types.code AS risk_sub_type_code, core_risk_types.code AS risk_type_code FROM data_risk_alerts
      LEFT JOIN data_risk_alerts_config ON data_risk_alerts_config.id = data_risk_alerts.risk_alert_config_id
      LEFT JOIN core_risk_alerts_config ON core_risk_alerts_config.id = data_risk_alerts_config.risk_alert_config_id
      LEFT JOIN core_risk_types ON core_risk_types.id = core_risk_alerts_config.risk_type
      LEFT JOIN core_risk_sub_types ON core_risk_sub_types.id = core_risk_alerts_config.risk_sub_type
      ${queryParams} ) AS subquery `;

			const countQueryResult = await sqlQuery({ sql: RiskAlertsCountQuery, values: [] });

			const totalcount = parseInt(countQueryResult.rows[0].totalcount);

			if (!pagination) {
				itemsPerPage = totalcount;
			}

			const paginationDetails = paginate(totalcount, itemsPerPage);
			if (page > paginationDetails.totalPages && paginationDetails.totalPages !== 0) {
				throw new RiskAlertsApiError(
					"Page Requested is Out of Max Page Range",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				getRiskAlertQuery += paginationQuery;
			}
			// get the risk alerts data by applying the filters
			const riskAlertsData: SqlQueryResult = await sqlQuery({ sql: getRiskAlertQuery, values: [] });

			const records = await Promise.all(
				riskAlertsData.rows.map(async (row: IRiskAlertsQueryResult) => {
					const titleDescription = await this._addRiskTitleDescription(row, query.time_zone);
					return {
						...row,
						...titleDescription
					};
				})
			);

			return {
				records,
				total_items: paginationDetails.totalItems,
				total_pages: paginationDetails.totalPages
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This helper function adds the title and description to the risk alerts data
	 * @param data : object of risk alert
	 * @param timeZone : timezone of user's locale fallback to utc
	 * @returns
	 */
	async _addRiskTitleDescription(data: IRiskAlertsQueryResult, timeZone: string = "UTC") {
		switch (data.risk_sub_type_code) {
			case "new_lien":
				return {
					title: "Lien Reported",
					description: `Lien has been reported on ${new Date(data.created_at).toLocaleString("en-US", { timeZone })}.`
				};
			case "new_judgement":
				return {
					title: "Judgment Reported",
					description: `Judgment has been reported ${new Date(data.created_at).toLocaleString("en-US", { timeZone })}.`
				};
			case "new_bankruptcy":
				return {
					title: "Bankruptcy Reported",
					description: `Bankruptcy has been reported on ${new Date(data.created_at).toLocaleString("en-US", { timeZone })}.`
				};
			case "equifax_credit_score":
				return {
					title: "VantageScore® Drop",
					description: `VantageScore® for control/beneficial owner dropped by ${data.measurement_config.threshold}% on ${new Date(data.created_at).toLocaleString("en-US", { timeZone })}.`
				};
			case "score_range":
				return {
					title: `Worth Score Generated`,
					description: `New score generated, falling into the ${data.risk_level} range on ${new Date(data.created_at).toLocaleString("en-US", { timeZone })}.`
				};
			case "worth_score_change":
				return {
					title: `Worth Score Changed`,
					description: `Worth score changed, falling into the ${data.risk_level} range on ${new Date(data.created_at).toLocaleString("en-US", { timeZone })}.`
				};
			case "score_risk_tier_transition":
				return {
					title: `Movement to Higher Risk Tier`,
					description: `Score has transitioned from a '${data.measurement_config.from}' tier to a '${data.measurement_config.to}' tier, triggering an alert on ${new Date(
						data.created_at
					).toLocaleString("en-US", { timeZone })}.`
				};

			case "integration_failure": {
				const failedIntegrationPlatformsQuery = `SELECT distinct(integrations.core_categories.label) as category_label
				FROM public.data_risk_alerts
				INNER JOIN public.rel_risk_alert_failure_platforms ON public.rel_risk_alert_failure_platforms.risk_alert_id = public.data_risk_alerts.id
				INNER JOIN integrations.core_integrations_platforms ON integrations.core_integrations_platforms.id = public.rel_risk_alert_failure_platforms.platform_id 
				INNER JOIN integrations.core_categories ON integrations.core_categories.id = integrations.core_integrations_platforms.category_id
				WHERE public.data_risk_alerts.score_trigger_id = $1`;

				const failedIntegrationPlatformsResult = await sqlQuery({
					sql: failedIntegrationPlatformsQuery,
					values: [data.score_trigger_id]
				});

				if (!failedIntegrationPlatformsResult.rows.length) return;

				const platforms = failedIntegrationPlatformsResult.rows
					.map((row: any) => {
						if (row.category_label === "Public Records") return "Social";
						else if (row.category_label === "Taxation") return "Taxes";
						return row.category_label;
					})
					.join(", ");

				const verb = failedIntegrationPlatformsResult.rows.length > 1 ? "are" : "is";

				return {
					title: "Integration broken",
					description: `${platforms} ${verb} not working as of ${new Date(data.created_at).toLocaleString("en-US", { timeZone })}. Awaiting to be fixed by business.`
				};
			}
		}
	}

	// TODO: PROD EXECUTE API
	/**
	 * @description This api is to get the risk score trigger IDs. which will be filled in case-svc in rel_risk_cases table
	 * @returns {Object} returns object with key as risk alert id and value as score trigger id
	 */
	async getRiskScoreTriggerIDs() {
		try {
			const getRiskScoreTriggerIDByScoreCauseIDQuery = `SELECT data_risk_alerts.id, bst.id AS score_trigger_id FROM data_risk_alerts
        INNER JOIN integrations.business_score_triggers bst ON bst.id = data_risk_alerts.score_trigger_id`;

			const getRiskScoreTriggerIDByIntegrationCauseIDQuery = `SELECT data_risk_alerts.id, bst.id AS score_trigger_id FROM data_risk_alerts
        INNER JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = data_risk_alerts.integration_task_id
        INNER JOIN integrations.business_score_triggers bst ON bst.id = dbit.business_score_trigger_id`;

			const [riskScoreTriggerIDByScoreCauseID, riskScoreTriggerIDByIntegrationCauseID] = await sqlTransaction(
				[getRiskScoreTriggerIDByScoreCauseIDQuery, getRiskScoreTriggerIDByIntegrationCauseIDQuery],
				[[], []]
			);

			const riskScoreTriggerID = [
				...riskScoreTriggerIDByScoreCauseID.rows,
				...riskScoreTriggerIDByIntegrationCauseID.rows
			];

			const response = riskScoreTriggerID.reduce((acc, row) => {
				acc[row.id] = row.score_trigger_id;
				return acc;
			}, {});

			return response;
		} catch (error) {
			throw error;
		}
	}

	// TODO: temp api to update risk alert failure platforms data
	async updateRiskAlertFailurePlatforms() {
		try {
			const insertPlatformRiskIdQuery = `INSERT INTO public.rel_risk_alert_failure_platforms (platform_id, risk_alert_id)
								SELECT integrations.core_integrations_platforms.id, public.data_risk_alerts.id
									FROM public.data_risk_alerts 
									INNER JOIN integrations.data_business_integrations_tasks dbit ON dbit.business_score_trigger_id = public.data_risk_alerts.score_trigger_id 
									INNER JOIN integrations.rel_tasks_integrations ON integrations.rel_tasks_integrations.id = dbit.integration_task_id
									INNER JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
									INNER JOIN integrations.core_integrations_platforms ON integrations.core_integrations_platforms.id = integrations.rel_tasks_integrations.platform_id
									WHERE task_status = 'FAILED' OR connection_status IN ('REVOKED', 'FAILED', 'NEEDS_ACTION') 
									ON CONFLICT(platform_id, risk_alert_id) DO NOTHING`;
			await sqlQuery({ sql: insertPlatformRiskIdQuery, values: [] });
		} catch (error) {
			throw error;
		}
	}
	// TODO: PROD EXECUTE API
	/**
	 * @description This function is to have entry for risk cases in integration-svc
	 */
	async createRiskCases() {
		try {
			const riskCases = await getRiskCases();
			const columns = ["id", "business_id", "score_trigger_id", "created_at"];
			const values = riskCases.map(riskCase => {
				return [riskCase.id, riskCase.business_id, riskCase.score_trigger_id, riskCase.created_at];
			});

			let createRiskCasesQuery = buildInsertQuery("data_cases", columns, values);

			createRiskCasesQuery += ` ON CONFLICT (id) DO NOTHING`;

			await sqlQuery({ sql: createRiskCasesQuery, values: values.flat() });
		} catch (error) {
			throw error;
		}
	}
	// function for remove duplicates records form risk alerts
	async deleteDuplicateRiskCases() {
		try {
			const getDuplicateRisks = `SELECT  count(dra.customer_id) as numOfCount,dra.customer_id,dra.business_id,dra.score_trigger_id,crst.code
			,(select  string_agg(dras.id::text, ',') AS risks_ids  from public.data_risk_alerts dras where dras.customer_id = dra.customer_id and dras.business_id = dra.business_id and dras.score_trigger_id = dra.score_trigger_id limit 1) FROM public.data_risk_alerts dra
	INNER JOIN public.data_risk_alerts_config drac ON drac.id = dra.risk_alert_config_id
	INNER JOIN public.core_risk_alerts_config crac ON crac.id = drac.risk_alert_config_id
	INNER JOIN public.core_risk_sub_types crst ON  crst.id = crac.risk_sub_type
	where crst.code = 'integration_failure'
	group by dra.customer_id,dra.business_id,dra.score_trigger_id,crst.code HAVING COUNT(dra.customer_id) > 1`;
			let duplicateRisks: any = await sqlQuery({ sql: getDuplicateRisks });
			duplicateRisks = duplicateRisks.rows.filter(row => row.numofcount > 1);
			let deleteActionItems;
			let duplicateRisksIds: any = [];
			duplicateRisks.map(row => {
				let ids = row.risks_ids.split(",");
				if (ids.length > 1) {
					ids = ids.slice(1, ids.length);
					ids.forEach(id => {
						duplicateRisksIds.push(`'${id}'`);
					});
				}
			});
			if (duplicateRisksIds.length > 0) {
				let riskIds = duplicateRisksIds.join(",");
				deleteActionItems = `DELETE FROM public.data_risk_alerts WHERE id IN(${riskIds})`;
				let deleteActionItemsFailurePlatforms = `DELETE FROM public.rel_risk_alert_failure_platforms WHERE risk_alert_id IN(${riskIds})`;
				InternalDeleteDuplicateRisksById({ riskIds: duplicateRisksIds });
				await sqlQuery({ sql: deleteActionItemsFailurePlatforms });
				let deleteQueryRes = await sqlQuery({ sql: deleteActionItems });

				return { deletedrecords: deleteQueryRes.rowCount };
			} else {
				return { deletedrecords: duplicateRisksIds.length };
			}
		} catch (error) {
			throw error;
		}
	}
}

export const riskAlerts = new RiskAlerts();
