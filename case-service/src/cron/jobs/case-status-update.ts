import { DateTime } from "luxon";
import { sqlQuery, sqlTransaction } from "#helpers/database";
import { logger } from "#helpers/logger";
import { ADMIN_UUID, CASE_STATUS, CASE_STATUS_ENUM, FEATURE_FLAGS, WEBHOOK_EVENTS } from "#constants";
import { sendWebhookEvent } from "#common";
import { caseManagementService } from "../../api/v1/modules/case-management/case-management";
import { UUID } from "crypto";
import { getFlagValue } from "#helpers";

export const updateCaseStatus = async () => {
	logger.info("CRON_CASE_STATUS: Cron started to update Case statuses");
	const getCasesQuery = `SELECT data_cases.* from data_cases 
  LEFT JOIN data_businesses db ON db.id = data_cases.business_id
  WHERE data_cases.status IN(SELECT id from core_case_statuses WHERE core_case_statuses.code NOT IN('UNDER_MANUAL_REVIEW', 'ARCHIVED')) AND db.is_deleted = false`;
	const casesResult = await sqlQuery({ sql: getCasesQuery });

	const getCronConfigQuery = `SELECT config from core_cron_config WHERE job_type = $1`;
	const [archiveCaseConfig, umrCaseConfig] = await sqlTransaction(
		[getCronConfigQuery, getCronConfigQuery],
		[["ARCHIVE_CASES"], ["UMR_CASES"]]
	);

	const ARCHIVE_CASES_TRANSITION_DAYS = archiveCaseConfig.rows?.[0].config?.transition_days || 30;
	const UMR_CASES_TRANSITION_DAYS = umrCaseConfig.rows?.[0].config?.transition_days || 30;

	logger.info(`CRON_CASE_STATUS: Archive Cases Transition Days: ${ARCHIVE_CASES_TRANSITION_DAYS}`);
	logger.info(`CRON_CASE_STATUS: UMR Cases Transition Days: ${UMR_CASES_TRANSITION_DAYS}`);
	function getDaysDifference(value: Date) {
		const today = new Date();
		return DateTime.fromJSDate(today).diff(DateTime.fromJSDate(value), "days").days;
	}

	async function _updateCaseStatus(caseID: string, status: string) {
		const updateCaseQuery = `UPDATE data_cases SET status = (SELECT id from core_case_statuses WHERE code = $1), updated_by = $2 WHERE id = $3`;

		const getBusinessDetailsQuery = `SELECT data_businesses.id as business_id, data_businesses.name as business_name, data_cases.customer_id from data_cases 
		LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id 
		WHERE data_cases.id = $1`;

		try {
			const [_, businessDetails] = await sqlTransaction(
				[updateCaseQuery, getBusinessDetailsQuery],
				[[status, ADMIN_UUID, caseID], [caseID]]
			);

			if (businessDetails.rows[0].customer_id) {
				// Send webhook event for case status update
				const webhookPayload = await caseManagementService.getCaseStatusUpdatedWebhookPayload(caseID as UUID);

				await sendWebhookEvent(businessDetails.rows[0].customer_id, WEBHOOK_EVENTS.CASE_STATUS_UPDATED, {
					...webhookPayload,
					status: status
				});
			}
		} catch (error) {
			logger.error(error, `CRON_CASE_STATUS: Case ID: ${caseID} => Cron failed to update case status to ${status}`);
		}
	}

	casesResult.rows.forEach(async caseData => {
		switch (caseData.status) {
			case CASE_STATUS.INVITED:
				break;
			case CASE_STATUS.INVITE_EXPIRED:
				break;
			case CASE_STATUS.ONBOARDING:
				break;
			case CASE_STATUS.UNDER_MANUAL_REVIEW:
				break;
			case CASE_STATUS.MANUALLY_APPROVED: {
				// TODO: move 30 to a config file
				if (getDaysDifference(caseData.updated_at) >= ARCHIVE_CASES_TRANSITION_DAYS) {
					// Update case status 'MANUALLY_APPROVED' to 'ARCHIVED'
					await _updateCaseStatus(caseData.id, CASE_STATUS_ENUM.ARCHIVED);
					logger.info(
						`CRON_CASE_STATUS: Case ID: ${caseData.id} => Cron updated case status from MANUALLY_APPROVED to ARCHIVED`
					);
				}
				break;
			}
			case CASE_STATUS.AUTO_APPROVED: {
				if (getDaysDifference(caseData.updated_at) >= ARCHIVE_CASES_TRANSITION_DAYS) {
					// Update case status 'AUTO_APPROVED' to 'ARCHIVED'
					await _updateCaseStatus(caseData.id, CASE_STATUS_ENUM.ARCHIVED);
					logger.info(
						`CRON_CASE_STATUS: Case ID: ${caseData.id} => Cron updated case status from AUTO_APPROVED to ARCHIVED`
					);
				}
				break;
			}
			case CASE_STATUS.SCORE_CALCULATED: {
				if (getDaysDifference(caseData.updated_at) >= ARCHIVE_CASES_TRANSITION_DAYS) {
					// Update case status 'SCORE_CALCULATED' to 'ARCHIVED'
					await _updateCaseStatus(caseData.id, CASE_STATUS_ENUM.ARCHIVED);
					logger.info(
						`CRON_CASE_STATUS: Case ID: ${caseData.id} => Cron updated case status from SCORE_CALCULATED to ARCHIVED`
					);
				}
				break;
			}
			case CASE_STATUS.MANUALLY_REJECTED: {
				if (getDaysDifference(caseData.updated_at) >= ARCHIVE_CASES_TRANSITION_DAYS) {
					// Update case status 'MANUALLY_REJECTED' to 'ARCHIVED'
					await _updateCaseStatus(caseData.id, CASE_STATUS_ENUM.ARCHIVED);
					logger.info(
						`CRON_CASE_STATUS: Case ID: ${caseData.id} Cron updated case status from MANUALLY_REJECTED to ARCHIVED`
					);
				}
				break;
			}
			case CASE_STATUS.ARCHIVED:
				break;
			case CASE_STATUS.PENDING_DECISION: {
				if (caseData.customer_id && getDaysDifference(caseData.updated_at) >= UMR_CASES_TRANSITION_DAYS) {
					// Update case status 'PENDING_DECISION' to 'UNDER_MANUAL_REVIEW'
					const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
						key: "customer",
						kind: "customer",
						customer_id: caseData.customer_id
					});
					if (!shouldPauseTransition) {
						await _updateCaseStatus(caseData.id, CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW);
						logger.info(
							`CRON_CASE_STATUS: Case ID: ${caseData.id} => Cron updated case status from PENDING_DECISION to UNDER_MANUAL_REVIEW`
						);
					}
				}
				break;
			}
			case CASE_STATUS.INFORMATION_REQUESTED:
				break;
			case CASE_STATUS.SUBMITTED: {
				if (caseData.customer_id && getDaysDifference(caseData.updated_at) >= UMR_CASES_TRANSITION_DAYS) {
					// Update case status 'SUBMITTED' to 'UNDER_MANUAL_REVIEW'
					const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
						key: "customer",
						kind: "customer",
						customer_id: caseData.customer_id
					});
					if (!shouldPauseTransition) {
						await _updateCaseStatus(caseData.id, CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW);
						logger.info(
							`CRON_CASE_STATUS: Case ID: ${caseData.id} => Cron updated case status from SUBMITTED to UNDER_MANUAL_REVIEW`
						);
					}
				}
				break;
			}
			case CASE_STATUS.AUTO_REJECTED: {
				if (getDaysDifference(caseData.updated_at) >= ARCHIVE_CASES_TRANSITION_DAYS) {
					// Update case status 'AUTO_REJECTED' to 'ARCHIVED'
					await _updateCaseStatus(caseData.id, CASE_STATUS_ENUM.ARCHIVED);
					logger.info(
						`CRON_CASE_STATUS: Case ID: ${caseData.id} Cron updated case status from AUTO_REJECTED to ARCHIVED`
					);
				}
				break;
			}
		}
	});

	logger.info("Cron updated Case statuses successfully");
};
