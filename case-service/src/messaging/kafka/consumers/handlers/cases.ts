import {
	ADMIN_UUID,
	CASE_STATUS,
	CASE_STATUS_ENUM,
	CASE_STATUS_REVERSE,
	FEATURE_FLAGS,
	INTEGRATION_CATEGORIES,
	kafkaEvents,
	kafkaTopics,
	WEBHOOK_EVENTS
} from "#constants/index";
import { db, getFlagValue, logger, producer, redis, sqlQuery, sqlTransaction } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { schema } from "./schema";
import { v4 as uuid } from "uuid";
import { ICreateRiskCase } from "./types";
import { envConfig } from "#configs";
import { sendKafkaEventForSection, sendWebhookEvent, triggerSectionCompletedKafkaEventWithRedis } from "#common/index";
import { businesses } from "../../../../api/v1/modules/businesses/businesses";
import { UUID } from "crypto";
import { caseManagementService } from "../../../../api/v1/modules/case-management/case-management";
import { caseManager } from "#core/case";

class CaseEventsHandler {
	async handleEvent(message) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				// TODO: Remove this handler (iuncluding schema and function) as CREATE_CASE handler creates a case with ONBOARDING status as default
				case kafkaEvents.APPLICANT_ONBOARDED:
					validateMessage(schema.applicantOnboarded, payload);
					await this.updateCaseStatus(payload);
					break;

				case kafkaEvents.CREATE_CASE_REQUEST:
					validateMessage(schema.createCaseRequest, payload);
					await this.createCase(payload);
					break;

				case kafkaEvents.INTEGRATION_TASK_FAILED:
					validateMessage(schema.integrationTaskFailed, payload);
					payload.user_id = ADMIN_UUID;
					payload.status = CASE_STATUS.UNDER_MANUAL_REVIEW;
					await this.integrationTaskFailed(payload);
					break;

				case kafkaEvents.CREATE_RISK_ALERT_CASE:
					validateMessage(schema.createRiskAlertCase, payload);
					await this.createRiskAlertCase(payload);
					break;
				case kafkaEvents.SECTION_COMPLETED:
					validateMessage(schema.sectionCompleted, payload);
					await this.sectionCompleted(payload);
					break;
				case kafkaEvents.BANK_ACCOUNT_VERIFICATION_FAILED:
					validateMessage(schema.bankAccountVerificationFailed, payload);
					// making sure to omit the CASE_STATUS.SCORE_CALCULATED status as the case can still move to manual review if the bank account verification fails after the score is calculated
					await this.bankAccountVerificationFailed(payload);
					break;
				case kafkaEvents.WORKFLOW_CHANGE_ATTRIBUTE:
					validateMessage(schema.workflowChangeAttribute, payload);

					if (!payload.user_id) {
						payload.user_id = ADMIN_UUID;
					}
					await caseManager.updateCaseAttribute(payload);
					break;
				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	shouldSkipStatusUpdate(currentStatus: number, skipStatuses: number[]) {
		return skipStatuses.includes(currentStatus);
	}

	/**
	 * Updates case status by case id
	 * @param {object} body
	 * @returns {Promise<void>}
	 * @throws {error}
	 */
	async updateCaseStatus(
		body: { status: any; user_id: any; case_id: any },
		skipStatuses: Array<(typeof CASE_STATUS)[keyof typeof CASE_STATUS]> = [
			CASE_STATUS.AUTO_APPROVED,
			CASE_STATUS.AUTO_REJECTED,
			CASE_STATUS.UNDER_MANUAL_REVIEW,
			CASE_STATUS.RISK_ALERT,
			CASE_STATUS.PAUSED
		]
	): Promise<void> {
		try {
			const currentStatusQuery = `SELECT data_cases.*, db.id as business_id, db.name as business_name
				FROM data_cases
				LEFT JOIN data_businesses db ON db.id = data_cases.business_id 
				WHERE data_cases.id = $1 AND db.is_deleted = false`;
			const currentStatus = await sqlQuery({ sql: currentStatusQuery, values: [body.case_id] });

			if (this.shouldSkipStatusUpdate(currentStatus.rows[0].status, skipStatuses)) {
				logger.info(`Case with id: ${body.case_id} is already in ${currentStatus.rows[0].status} status`);
				return;
			}

			const updateStatusQuery = `UPDATE data_cases SET status = $1, updated_by = $2 WHERE id = $3`;

			const insertStatusHistoryQuery = `INSERT INTO data_case_status_history
			(case_id, status, created_by)
			VALUES($1, $2, $3)`;

			await sqlTransaction(
				[updateStatusQuery, insertStatusHistoryQuery],
				[
					[body.status, body.user_id, body.case_id],
					[body.case_id, body.status, body.user_id]
				]
			);

			const caseData = currentStatus.rows[0];
			if (caseData.customer_id) {
				// Send webhook event for case status update
				const webhookPayload = await caseManagementService.getCaseStatusUpdatedWebhookPayload(body.case_id as UUID);

				await sendWebhookEvent(caseData.customer_id, WEBHOOK_EVENTS.CASE_STATUS_UPDATED, {
					...webhookPayload,
					status: CASE_STATUS_REVERSE[body.status]
				});
			}
		} catch (error) {
			logger.error({ error }, `Error updating case status for case_id: ${body.case_id}`);
			throw error;
		}
	}

	/**
	 * When an applicant accepts an invite, auth service invokes the create_case_event which creates a case
	 * and emits an business_invite_accepted_event event that is comsumed by integration service to fill up connection entries for this business
	 * that would later up be updated when the integrations are actually linked.
	 * TODO: Link Miro / confluence doc explaining the flow
	 * @param {object} body
	 * @returns {object}
	 */

	async createCase(body: { business_id: UUID; applicant_id: UUID; customer_id: UUID | null }) {
		return caseManagementService.ensureCasesExist(body.business_id, {
			applicantID: body.applicant_id,
			customerID: body.customer_id
		});
	}

	async createRiskAlertCase(body: ICreateRiskCase) {
		try {
			// get case status id of RISK_ALERT/PAUSED
			const caseStatusResult = await sqlQuery({
				sql: `SELECT id FROM core_case_statuses WHERE code = $1`,
				values: [
					body.risk_alert_subtype === "integration_failure" ? CASE_STATUS_ENUM.PAUSED : CASE_STATUS_ENUM.RISK_ALERT
				]
			});
			const caseStatus = caseStatusResult.rows[0].id;

			// check if the case already exists
			const getRelRiskCaseQuery = `SELECT * FROM rel_risk_cases as rrc JOIN data_cases as dc ON dc.id = rrc.case_id WHERE rrc.score_trigger_id = $1 AND dc.status = $2`;
			const getRelRiskCase = await sqlQuery({ sql: getRelRiskCaseQuery, values: [body.score_trigger_id, caseStatus] });

			// insert or update case and rel_risk_case
			if (getRelRiskCase.rows.length) {
				logger.info(
					`Inserting rel risk case for score_trigger_id: ${body.score_trigger_id} and risk_alert_id: ${body.risk_alert_id}`
				);
				const caseID = getRelRiskCase.rows[0].case_id;
				const insertRelRiskCaseQuery = `INSERT INTO rel_risk_cases (case_id, risk_alert_id, score_trigger_id) VALUES($1, $2, $3)`;
				await sqlQuery({ sql: insertRelRiskCaseQuery, values: [caseID, body.risk_alert_id, body.score_trigger_id] });
			} else {
				logger.info(
					`Creating risk alert case for business_id: ${body.business_id} and risk_alert_id: ${body.risk_alert_id}`
				);
				const caseID = uuid();
				// get applicant_id from the business_id
				const getApplicantIDQuery = `SELECT data_cases.applicant_id AS id FROM data_cases 
				LEFT JOIN data_businesses db ON db.id = data_cases.business_id
				WHERE data_cases.business_id = $1 AND data_cases.applicant_id != $2 AND db.is_deleted = false ORDER BY data_cases.created_at ASC LIMIT 1`;
				const caseTypeQuery = `SELECT id FROM core_case_types WHERE code = $1`;
				const [applicant, caseTypes] = await sqlTransaction(
					[getApplicantIDQuery, caseTypeQuery],
					[[body.business_id, envConfig.ENTERPRISE_APPLICANT_ID], ["risk"]]
				);

				if (!applicant.rows.length) {
					applicant.rows.push({ id: envConfig.ENTERPRISE_APPLICANT_ID });
				}

				// insert case and rel_risk_case
				const insertCaseQuery = `INSERT INTO data_cases (id, customer_id, applicant_id, status, business_id, created_by, updated_by, case_type) VALUES($1, $2, $3,$4, $5, $6, $7, $8)`;
				const insertRelRiskCaseQuery = `INSERT INTO rel_risk_cases (case_id, risk_alert_id, score_trigger_id) VALUES($1, $2, $3)`;

				const insertStatusHistoryQuery = `INSERT INTO data_case_status_history
				(case_id, status, created_by)
				VALUES($1, $2, $3)`;

				await sqlTransaction(
					[insertCaseQuery, insertStatusHistoryQuery, insertRelRiskCaseQuery],
					[
						[
							caseID,
							body.customer_id,
							applicant.rows[0].id,
							caseStatus,
							body.business_id,
							applicant.rows[0].id,
							applicant.rows[0].id,
							(caseTypes.rows[0] as any).id
						],
						[caseID, caseStatus, applicant.rows[0].id],
						[caseID, body.risk_alert_id, body.score_trigger_id]
					]
				);

				await producer.send({
					topic: kafkaTopics.CASES,
					messages: [{
						key: body.business_id,
						value: {
							event: kafkaEvents.CREATE_CASE_FOR_A_RISK_ALERT_REQUEST,
							id: caseID,
							business_id: body.business_id,
							score_trigger_id: body.score_trigger_id
						}
					}]
				});
			}
		} catch (error) {
			logger.error(
				`RISK ALERT: Error creating risk alert case for business_id: ${body.business_id} and risk_alert_id: ${body.risk_alert_id}, error: ${error}`
			);
			throw error;
		}
	}

	async integrationTaskFailed(payload) {
		try {
			logger.info(` integrationTaskFailed payload ${JSON.stringify(payload)}`);
			const caseWithBusiness = await db("public.data_cases as dc")
				.leftJoin("public.data_businesses as db", "db.id", "dc.business_id")
				.select("dc.status", "dc.business_id", "db.name as business_name")
				.where("dc.id", payload.case_id)
				.andWhere("db.is_deleted", false)
				.first();
		const message = {
			case_id: payload.case_id,
			integration_category: payload.integration_category,
			business_id: caseWithBusiness?.business_id
		};
		await producer.send({
			topic: kafkaTopics.NOTIFICATIONS,
			messages: [{
				key: caseWithBusiness?.business_id,
				value: {
					event: kafkaEvents.INTEGRATION_FAILED_AUDIT,
					...message
				}
			}]
		});
			const customerID = await businesses.getCustomerByCaseId(payload.case_id);

			const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
				key: "customer",
				kind: "customer",
				customer_id: customerID
			});

			if (!shouldPauseTransition) {
				const skipStatuses = [
					CASE_STATUS.UNDER_MANUAL_REVIEW,
					CASE_STATUS.AUTO_REJECTED,
					CASE_STATUS.RISK_ALERT,
					CASE_STATUS.PAUSED,
					CASE_STATUS.AUTO_APPROVED,
					CASE_STATUS.INFORMATION_REQUESTED
				];
				await this.updateCaseStatus(payload, skipStatuses);
			}

			if (customerID) {
				payload.business_id = caseWithBusiness?.business_id;
				const kafkaPayload = {
					...payload,
					status: "FAILED",
					business_id: caseWithBusiness?.business_id,
					business_name: caseWithBusiness?.business_name
				};
				await sendWebhookEvent(customerID, WEBHOOK_EVENTS.INTEGRATION_FAILED, kafkaPayload);
			}
		} catch (error) {
			throw error;
		}
	}

	async sectionCompleted(payload: {
		business_id: UUID;
		section_name: string;
		user_id?: UUID | null;
		customer_id?: UUID | null;
	}) {
		const { business_id, section_name, user_id, customer_id } = payload;
		logger.info(`SECTION COMPLETED EVENT FROM CASE: ${JSON.stringify(payload)}`);

		// Define the list of section names that should trigger Kafka directly because these events are coming from integration service
		const directTriggerSections = new Set(["Accounting", "Banking Deposit Account", "Banking", "Taxation"]);

		// Check if section_name is in the list and call sendKafkaEventForSection directly
		if (directTriggerSections.has(section_name)) {
			await sendKafkaEventForSection(business_id, section_name, user_id as UUID, customer_id as UUID);
		} else {
			// Otherwise, use the existing Redis-based trigger method
			await triggerSectionCompletedKafkaEventWithRedis(
				business_id,
				section_name,
				user_id as UUID,
				customer_id as UUID,
				redis
			);
		}
	}

	async bankAccountVerificationFailed(payload: { case_id: UUID; reason: string }) {
		const caseWithBusiness = await db("public.data_cases as dc")
			.leftJoin("public.data_businesses as db", "db.id", "dc.business_id")
			.select("dc.status", "dc.business_id", "db.name as business_name")
			.where("dc.id", payload.case_id)
			.andWhere("db.is_deleted", false)
			.first();
		const message = {
			case_id: payload.case_id,
			integration_category: INTEGRATION_CATEGORIES.BANKING,
			business_id: caseWithBusiness?.business_id
		};
		await producer.send({
			topic: kafkaTopics.NOTIFICATIONS,
			messages: [{
				key: caseWithBusiness?.business_id,
				value: {
					event: kafkaEvents.INTEGRATION_FAILED_AUDIT,
					...message
				}
			}]
		});
		const payloadForCaseUpdate = {
			...payload,
			status: CASE_STATUS.UNDER_MANUAL_REVIEW,
			user_id: ADMIN_UUID
		};
		const skipStatuses = [
			CASE_STATUS.UNDER_MANUAL_REVIEW,
			CASE_STATUS.AUTO_REJECTED,
			CASE_STATUS.RISK_ALERT,
			CASE_STATUS.PAUSED,
			CASE_STATUS.AUTO_APPROVED,
			CASE_STATUS.INFORMATION_REQUESTED
		];
		const customerID = await businesses.getCustomerByCaseId(payload.case_id);

		const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
			key: "customer",
			kind: "customer",
			customer_id: customerID
		});
		if (!shouldPauseTransition) {
			await this.updateCaseStatus(payloadForCaseUpdate, skipStatuses);
		}
		logger.info(
			`Bank account verification event received for case: ${payload.case_id}. Cause: ${payload.reason}.${!shouldPauseTransition ? " Case status updated to UNDER_MANUAL_REVIEW" : ""}`
		);
	}
}

export const caseEventsHandler = new CaseEventsHandler();
