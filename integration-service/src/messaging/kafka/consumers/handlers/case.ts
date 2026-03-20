import { kafkaEvents, kafkaTopics } from "#constants/index";
import { logger, producer, sqlQuery } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { ICreateRiskAlert, SqlQueryResult } from "#types";
import { KafkaHandlerError } from "./error";
import { schema } from "./schema";
import { v4 as uuid } from "uuid";

class CaseEventsHandler {
	async handleEvent(message) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.CREATE_RISK_ALERT:
					validateMessage(schema.createRiskAlert, payload);
					await this.createRiskAlert(payload);
					break;

				case kafkaEvents.CREATE_CASE_FOR_A_RISK_ALERT_REQUEST:
					validateMessage(schema.createCaseRequest, payload);
					await this.createRiskAlertCase(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	async createRiskAlert(payload: ICreateRiskAlert) {
		try {
			logger.info(`RISK ALERT: Creating risk alert for customer: ${payload.customer_id}`);

			// No need to generate risk alert if the risk alert is already created
			switch (payload.risk_alert_subtype) {
				case "equifax_credit_score": {
					const isIntegrationFailureAlertAlreadyExist = await this._checkRiskAlertExists(payload);
					if (isIntegrationFailureAlertAlreadyExist) return;
					break;
				}

				case "integration_failure": {
					const isIntegrationFailureAlertAlreadyExist = await this._checkRiskAlertExists(payload);
					if (isIntegrationFailureAlertAlreadyExist) return;
					break;
				}

				default:
					break;
			}

			const riskID = uuid();
			// insert into data_risk_alerts table
			const insertRiskAlertQuery = `INSERT INTO data_risk_alerts (id, risk_alert_config_id, measurement_config, customer_id, integration_task_id, score_trigger_id, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
			await sqlQuery({
				sql: insertRiskAlertQuery,
				values: [
					riskID,
					payload.risk_alert_config_id,
					JSON.parse(payload.measurement_config.toString()),
					payload.customer_id,
					payload.integration_task_id,
					payload.score_trigger_id,
					payload.business_id
				]
			});
			logger.info(`RISK ALERT: Risk alert created for customer: ${payload.customer_id}`);

			// conditions where there is no need to create risk case
			switch (payload.risk_alert_subtype) {
				case "score_range": {
					// No need to create case for low risk level only alert is enough
					if (payload.risk_level === "LOW") return;
					else break;
				}
				default:
					break;
			}

			// send kafka event to create risk alert case on case-service
			const casePayload = {
				business_id: payload.business_id,
				customer_id: payload.customer_id,
				risk_alert_id: riskID,
				score_trigger_id: payload.score_trigger_id,
				risk_alert_subtype: payload.risk_alert_subtype
			};
		await producer.send({
			topic: kafkaTopics.CASES,
			messages: [{ 
				key: payload.business_id, 
				value: { 
					event: kafkaEvents.CREATE_RISK_ALERT_CASE,
					...casePayload 
				}
			}]
			});
			if (payload.risk_alert_subtype === "integration_failure") {
				// insert platform id and risk alert id into rel_risk_alert_failure_platforms
				const insertPlatformRiskIdQuery = `INSERT INTO public.rel_risk_alert_failure_platforms (platform_id, risk_alert_id)
							SELECT integrations.core_integrations_platforms.id, $1
								FROM integrations.core_integrations_platforms
								INNER JOIN integrations.rel_tasks_integrations ON integrations.rel_tasks_integrations.platform_id = core_integrations_platforms.id
								INNER JOIN integrations.data_business_integrations_tasks dbit ON dbit.integration_task_id = integrations.rel_tasks_integrations.id
								INNER JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
								INNER JOIN integrations.rel_platforms_status on integrations.rel_platforms_status.platform_id = integrations.core_integrations_platforms.id
								WHERE dbit.business_score_trigger_id = $2 AND (task_status = 'FAILED' OR connection_status IN ('REVOKED', 'FAILED', 'NEEDS_ACTION')) 
								AND integrations.rel_platforms_status.risk_alert_status = TRUE
								ON CONFLICT(platform_id, risk_alert_id) DO NOTHING`;
				await sqlQuery({ sql: insertPlatformRiskIdQuery, values: [riskID, payload.score_trigger_id] });
			}
			logger.info(`RISK ALERT: Risk alert case created for customer: ${payload.customer_id} event sent to case-service`);
		} catch (error) {
			logger.error({ error }, `RISK ALER: customer_id: ${payload.customer_id} business_id: ${payload.business_id}`);
			throw error;
		}
	}

	async _checkRiskAlertExists(payload: ICreateRiskAlert): Promise<boolean> {
		try {
			// query to check if the risk alert is already created for the customer
			const riskAlertExistsQuery = `SELECT dra.* FROM public.data_risk_alerts dra
						INNER JOIN public.data_risk_alerts_config drac ON drac.id = dra.risk_alert_config_id
						INNER JOIN public.core_risk_alerts_config crac ON crac.id = drac.risk_alert_config_id
						INNER JOIN public.core_risk_sub_types crst ON  crst.id = crac.risk_sub_type						
					 WHERE dra.customer_id = $1 AND dra.business_id = $2 AND crst.code = $3 AND dra.score_trigger_id = $4`;

			const riskAlert = await sqlQuery({ sql: riskAlertExistsQuery, values: [payload.customer_id, payload.business_id, payload.risk_alert_subtype, payload.score_trigger_id] });

			if (riskAlert.rows.length > 0) {
				logger.info(`RISK ALERT: Risk alert already exists for customer: ${payload.customer_id}, business_id: ${payload.business_id} and risk_alert_subtype: ${payload.risk_alert_subtype}`);
				// insert platform id and risk alert id into rel_risk_alert_failure_platforms
				const insertPlatformRiskIdQuery = `INSERT INTO public.rel_risk_alert_failure_platforms (platform_id, risk_alert_id)
							SELECT integrations.core_integrations_platforms.id, $1
								FROM integrations.core_integrations_platforms
								INNER JOIN integrations.rel_tasks_integrations ON integrations.rel_tasks_integrations.platform_id = core_integrations_platforms.id
								INNER JOIN integrations.data_business_integrations_tasks dbit ON dbit.integration_task_id = integrations.rel_tasks_integrations.id
								INNER JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
								INNER JOIN integrations.rel_platforms_status on integrations.rel_platforms_status.platform_id = integrations.core_integrations_platforms.id
								WHERE dbit.business_score_trigger_id = $2 AND (task_status = 'FAILED' OR connection_status IN ('REVOKED', 'FAILED', 'NEEDS_ACTION')) 
								AND integrations.rel_platforms_status.risk_alert_status = TRUE
								ON CONFLICT(platform_id, risk_alert_id) DO NOTHING`;
				await sqlQuery({ sql: insertPlatformRiskIdQuery, values: [riskAlert.rows[0].id, payload.score_trigger_id] });
				return true;
			}
			return false;
		} catch (error) {
			throw error;
		}
	}

	async createRiskAlertCase(payload) {
		try {
			// insert into data_risk_alert_cases table
			const insertRiskAlertCaseQuery = `INSERT INTO data_cases (id, business_id, score_trigger_id, created_at) VALUES ($1, $2, $3, current_timestamp)`;
			await sqlQuery({ sql: insertRiskAlertCaseQuery, values: [payload.id, payload.business_id, payload.score_trigger_id] });
			logger.info(`RISK ALERT CASE: Risk alert case added in integration-svc for business: ${payload.business_id}`);
		} catch (error) {
			logger.error({ error }, `RISK ALERT CASE: Failed to create case for business_id: ${payload.business_id}`);
			throw error;
		}
	}
}

export const caseEventsHandler = new CaseEventsHandler();
