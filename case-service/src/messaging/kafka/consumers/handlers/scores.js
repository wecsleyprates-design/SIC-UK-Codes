import { sendWebhookEvent } from "#common/index";
import {
	ADMIN_UUID,
	BUSINESS_STATUS,
	CASE_STATUS,
	CASE_STATUS_ENUM,
	CASE_STATUS_REVERSE,
	FEATURE_FLAGS,
	kafkaEvents,
	kafkaTopics,
	SCORE_TRIGGER,
	WEBHOOK_EVENTS
} from "#constants/index";
import {
	fetchCaseVerifications,
	getBusinessKybDetails,
	getCustomersRiskAlertConfigs,
	getCustomerWithPermissions,
	getFlagValue,
	logger,
	producer,
	sqlQuery,
	sqlTransaction
} from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { schema } from "./schema";
import { getCaseStatusText } from "#utils/index";
import { workflowDecisioning } from "../../../../api/v1/modules/case-decisioning/case-decisioning";
import { caseManagementService } from "../../../../api/v1/modules/case-management/case-management";

class ScoreEventsHandler {
	async handleEvent(message) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.SCORE_CALCULATED:
					validateMessage(schema.scoreCalculated, payload);
					await this.scoreCalculated(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	async scoreCalculated(payload) {
		try {
			logger.info(`SCORE: score calculated event ${payload.case_id} with payload ${JSON.stringify(payload)}`);

			let caseStatus = CASE_STATUS.SCORE_CALCULATED;
			let customerID = payload.customer_id;
			let businessVerificationStatus = BUSINESS_STATUS.VERIFIED;
			let businessMCCID = null;

			const auditMessage = {
				business_id: payload.business_id,
				case_id: payload.case_id,
				worth_score: payload.score_850
			};

			let sendWebhookEventFlag = false;
			let webhookPayload = null;

			let activeDecisioningType = null;
			if (payload.case_id) {
				webhookPayload = await caseManagementService.getCaseStatusUpdatedWebhookPayload(payload.case_id);
				const getCaseQuery = `SELECT data_cases.*, data_businesses.name, data_businesses.id as business_id, data_businesses.status as business_status, data_businesses.mcc_id as business_mcc_id
					FROM data_cases LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id 
					WHERE data_cases.id = $1
					AND data_businesses.is_deleted = false`;
				const caseDetails = await sqlQuery({ sql: getCaseQuery, values: [payload.case_id] });

				customerID = customerID ? customerID : caseDetails.rows[0]?.customer_id;

				businessVerificationStatus = caseDetails.rows[0]?.business_status;
				businessMCCID = caseDetails.rows[0]?.business_mcc_id;
				auditMessage.business_name = caseDetails.rows[0]?.name;

				if (customerID) {
					await sendWebhookEvent(customerID, WEBHOOK_EVENTS.CASE_STATUS_UPDATED, {
						...webhookPayload,
						status: CASE_STATUS_ENUM.SCORE_CALCULATED
					});
				}
			} else {
				const getBusinessQuery = `SELECT name FROM data_businesses WHERE id = $1 AND is_deleted = false`;
				const businessDetails = await sqlQuery({ sql: getBusinessQuery, values: [payload.business_id] });
				if (businessDetails.rows.length > 0) {
					auditMessage.business_name = businessDetails.rows[0].name;
				} else {
					logger.warn(`No business found with id: ${payload.business_id}`);
					return;
				}
			}

			// Get active_decisioning_type from data_cases_decisioning_config using customer_id
			// If this fails, we continue with null (default behavior) to ensure backward compatibility
			if (customerID) {
				try {
					const decisioningConfig = await workflowDecisioning.getWorkflowDecisioningConfiguration(customerID);
					activeDecisioningType = decisioningConfig.active_decisioning_type;
				} catch (error) {
					logger.error(
						error,
						`Error getting workflow decisioning configuration for customer ${customerID}, continuing with default behavior`
					);
				}
			}
			// Create an audit log
			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: payload.business_id,
						value: {
							event: kafkaEvents.SCORE_GENERATED_AUDIT,
							...auditMessage
						}
					}
				]
			});

			const getFirstScoreQuery = `SELECT data_business_scores.* FROM data_business_scores
			LEFT JOIN data_businesses db ON db.id = data_business_scores.business_id
			WHERE data_business_scores.business_id = $1 AND data_business_scores.trigger_type = $2 AND db.is_deleted = false ORDER BY data_business_scores.created_at ASC LIMIT 1`;
			const getFirstScoreOfBusiness = await sqlQuery({
				sql: getFirstScoreQuery,
				values: [payload.business_id, "ONBOARDING_INVITE"]
			});

			if (customerID) {
				const result = await getCustomerWithPermissions({
					customer_ids: [customerID],
					permissions: ["risk_monitoring_module:write"]
				});
				const monitoringAllowedCustomers = Object.hasOwn(result, "risk_monitoring_module:write")
					? result["risk_monitoring_module:write"]
					: [];
				const isMonitoringAllowed = monitoringAllowedCustomers.includes(customerID);

				// check if we need to create risk alert & risk alert case for the customer
				// means fetch the risk monitoring status of customer for the business
				const riskMonitoringStatus = await sqlQuery({
					sql: `SELECT is_monitoring_enabled 
						FROM rel_business_customer_monitoring
						LEFT JOIN data_businesses db on rel_business_customer_monitoring.business_id = db.id 
						WHERE rel_business_customer_monitoring.customer_id = $1 
							AND rel_business_customer_monitoring.business_id = $2 
							AND db.is_deleted = false`,
					values: [customerID, payload.business_id]
				});
				const isMonitoringEnabled = riskMonitoringStatus.rows[0]?.is_monitoring_enabled;
				logger.info(
					`RISK ALERT: Risk monitoring status for customer ${customerID} is ${riskMonitoringStatus.rows[0]?.is_monitoring_enabled}`
				);
				logger.info(
					`RISK ALERT: Monitoring allowed for customer ${customerID} is ${isMonitoringAllowed}, response: ${JSON.stringify(
						result
					)}`
				);

				// fetch the config for the score ranges
				const customerRiskAlertConfig = await getCustomersRiskAlertConfigs(customerID);
				const riskAlertStatuses =
					customerRiskAlertConfig.customer.risk_alert_statuses || customerRiskAlertConfig.admin.risk_alert_statuses;
				if (riskAlertStatuses.risk_alerts_status === true) {
					const scoreRanges =
						customerRiskAlertConfig.customer.score_config || customerRiskAlertConfig.admin.score_config;
					const worthScoreChangeRange =
						customerRiskAlertConfig.customer.worth_score_change || customerRiskAlertConfig.admin.worth_score_change;
					const highRiskMovement =
						customerRiskAlertConfig.customer.score_risk_tier_transition ||
						customerRiskAlertConfig.admin.score_risk_tier_transition;
					logger.info(`RISK ALERT: Score ranges for customer ${customerID} are ${JSON.stringify(scoreRanges)}`);

					if (payload.score_850 >= scoreRanges.LOW.measurement_config.min) {
						caseStatus = CASE_STATUS.AUTO_APPROVED;
						payload.risk_level = "LOW";
					} else if (
						payload.score_850 >= scoreRanges.MODERATE.measurement_config.min &&
						payload.score_850 < scoreRanges.MODERATE.measurement_config.max
					) {
						caseStatus = CASE_STATUS.UNDER_MANUAL_REVIEW;
						payload.risk_level = "MODERATE";
					} else {
						caseStatus = CASE_STATUS.AUTO_REJECTED;
						payload.risk_level = "HIGH";
					}

					logger.debug({
						msg: `RISK ALERT: caseStatus after score calculation for customer: ${customerID}, business: ${payload.business_id}, case: ${payload.case_id}`,
						case_status: getCaseStatusText(caseStatus)
					});

					// produce kafka event for creating risk alert only if the risk monitoring is enabled & the trigger type is MONITORING_REFRESH or APPLICATION_EDIT
					if (
						isMonitoringAllowed &&
						isMonitoringEnabled &&
						[SCORE_TRIGGER.MONITORING_REFRESH, SCORE_TRIGGER.APPLICATION_EDIT, SCORE_TRIGGER.MANUAL_REFRESH].includes(
							payload.trigger_type
						)
					) {
						const riskAlertPayload = {
							customer_id: customerID,
							business_id: payload.business_id,
							risk_alert_subtype: "score_range",
							risk_level: payload.risk_level,
							risk_alert_config_id: scoreRanges[payload.risk_level].id,
							measurement_config: JSON.stringify(scoreRanges[payload.risk_level].measurement_config),
							score_trigger_id: payload.score_trigger_id
						};

						logger.info(
							`RISK ALERT: Creating risk alert for customer ${customerID} with payload ${JSON.stringify(
								riskAlertPayload
							)}`
						);
						await producer.send({
							topic: kafkaTopics.CASES,
							messages: [
								{
									key: payload.business_id,
									value: {
										event: kafkaEvents.CREATE_RISK_ALERT,
										...riskAlertPayload
									}
								}
							]
						});

						await sendWebhookEvent(customerID, WEBHOOK_EVENTS.RISK_ALERT, riskAlertPayload);

						if (
							getFirstScoreOfBusiness.rows.length &&
							getFirstScoreOfBusiness.rows[0].score_850 &&
							riskAlertStatuses.worth_score_change_status
						) {
							const firstScore850 = getFirstScoreOfBusiness.rows[0].score_850;
							const currentScore850 = payload.score_850;
							if (firstScore850 > currentScore850) {
								const scoreDropPoints = firstScore850 - currentScore850;
								if (scoreDropPoints >= worthScoreChangeRange.HIGH.measurement_config.threshold) {
									const riskAlertPayloadForWorthScoreRange = {
										customer_id: customerID,
										business_id: payload.business_id,
										risk_alert_subtype: "worth_score_change",
										risk_level: "HIGH",
										risk_alert_config_id: worthScoreChangeRange.HIGH.id,
										measurement_config: JSON.stringify(worthScoreChangeRange.HIGH.measurement_config),
										score_trigger_id: payload.score_trigger_id
									};
									logger.info(
										`RISK ALERT: Creating risk alert for customer ${customerID} with payload ${JSON.stringify(
											riskAlertPayloadForWorthScoreRange
										)}`
									);
									await producer.send({
										topic: kafkaTopics.CASES,
										messages: [
											{
												key: payload.business_id,
												value: {
													event: kafkaEvents.CREATE_RISK_ALERT,
													...riskAlertPayloadForWorthScoreRange
												}
											}
										]
									});

									await sendWebhookEvent(customerID, WEBHOOK_EVENTS.RISK_ALERT, riskAlertPayloadForWorthScoreRange);
								}
							}
						}

						const getMostRecentScoreOfBusinessQuery = `SELECT data_business_scores.* FROM data_business_scores
						LEFT JOIN data_businesses db ON db.id = data_business_scores.business_id
						WHERE data_business_scores.business_id = $1 AND data_business_scores.customer_id = $2 AND db.is_deleted = false
						ORDER BY data_business_scores.created_at DESC LIMIT 1`;
						const getMostRecentScoreOfBusinessQueryResult = await sqlQuery({
							sql: getMostRecentScoreOfBusinessQuery,
							values: [payload.business_id, customerID]
						});
						if (
							getMostRecentScoreOfBusinessQueryResult.rows.length &&
							getMostRecentScoreOfBusinessQueryResult.rows[0].score_850 &&
							riskAlertStatuses.score_risk_tier_transition_status
						) {
							let lastScoreRiskLevel, measurementConfig;
							let riskOfTransitioning = null;
							let riskAlertConfigId = null;
							const lastScore850 = getMostRecentScoreOfBusinessQueryResult.rows[0].score_850;
							const currentScore850 = payload.score_850;
							if (lastScore850 > currentScore850) {
								if (lastScore850 >= scoreRanges.LOW.measurement_config.min) {
									lastScoreRiskLevel = "LOW";
								} else if (
									lastScore850 >= scoreRanges.MODERATE.measurement_config.min &&
									lastScore850 < scoreRanges.MODERATE.measurement_config.max
								) {
									lastScoreRiskLevel = "MODERATE";
								} else {
									lastScoreRiskLevel = "HIGH";
								}

								if (lastScoreRiskLevel === "LOW" && payload.risk_level === "MODERATE") {
									measurementConfig =
										highRiskMovement[`${payload.risk_level}:${lastScoreRiskLevel}-MODERATE`].measurement_config;
									riskAlertConfigId = highRiskMovement[`${payload.risk_level}:${lastScoreRiskLevel}-MODERATE`].id;
									riskOfTransitioning = "MODERATE";
								} else if (lastScoreRiskLevel === "LOW" && payload.risk_level === "HIGH") {
									measurementConfig =
										highRiskMovement[`${payload.risk_level}:${lastScoreRiskLevel}-HIGH`].measurement_config;
									riskAlertConfigId = highRiskMovement[`${payload.risk_level}:${lastScoreRiskLevel}-HIGH`].id;
									riskOfTransitioning = "HIGH";
								} else if (lastScoreRiskLevel === "MODERATE" && payload.risk_level === "HIGH") {
									measurementConfig =
										highRiskMovement[`${payload.risk_level}:${lastScoreRiskLevel}-HIGH`].measurement_config;
									riskAlertConfigId = highRiskMovement[`${payload.risk_level}:${lastScoreRiskLevel}-HIGH`].id;
									riskOfTransitioning = "HIGH";
								}

								if (riskOfTransitioning !== null) {
									const riskAlertPayloadForHighRiskMovement = {
										customer_id: customerID,
										business_id: payload.business_id,
										risk_alert_subtype: "score_risk_tier_transition",
										risk_level: riskOfTransitioning,
										risk_alert_config_id: riskAlertConfigId,
										measurement_config: JSON.stringify(measurementConfig),
										score_trigger_id: payload.score_trigger_id
									};
									logger.info(
										`RISK ALERT: Creating risk alert for customer ${customerID} with payload ${JSON.stringify(
											riskAlertPayloadForHighRiskMovement
										)}`
									);
									await producer.send({
										topic: kafkaTopics.CASES,
										messages: [
											{
												key: payload.business_id,
												value: {
													event: kafkaEvents.CREATE_RISK_ALERT,
													...riskAlertPayloadForHighRiskMovement
												}
											}
										]
									});

									await sendWebhookEvent(customerID, WEBHOOK_EVENTS.RISK_ALERT, riskAlertPayloadForHighRiskMovement);
								}
							}
						}
					}
					if (businessVerificationStatus === BUSINESS_STATUS.UNVERIFIED) {
						logger.debug({
							msg: "❌ VERIFICATION: Business status is UNVERIFIED; setting UMR",
							business_id: payload.business_id,
							customer_id: customerID
						});
						caseStatus = CASE_STATUS.UNDER_MANUAL_REVIEW;
					}

					const checkMultipleVerifications = await getFlagValue(
						FEATURE_FLAGS.DOS_543_AUTO_APPROVAL_FOR_MULTIPLE_VERIFICATION_SIGNALS,
						{ key: "customer", kind: "customer", customer_id: customerID },
						false
					);
					logger.debug(`AUTO-APPROVAL: DOS_543 FF is ${checkMultipleVerifications} for customer ${customerID}`);

					if (checkMultipleVerifications && payload.case_id) {
						const connections = await fetchCaseVerifications(payload.business_id, payload.case_id, customerID);

						const kybDetails = await getBusinessKybDetails(payload.business_id);

						const allIDVCheckPass =
							Array.isArray(connections.verification_of_owners) &&
							connections.verification_of_owners.every(owner => owner.status === "SUCCESS");

						let allBankVerified = false;
						const bankEvaluationPaths = [];

						if (connections.banking.is_giact_verified) {
							if (connections.banking.giact_service_flags.includes("verify")) {
								allBankVerified =
									Array.isArray(connections.banking.bank_accounts_info) &&
									connections.banking.bank_accounts_info.length > 0 &&
									connections.banking.bank_accounts_info.every(acc => {
										const code = acc.verification_result?.account_verification_response?.code;
										return ["_1111", "_3333", "_5555"].includes(code);
									});
								bankEvaluationPaths.push({ path: "GIACT_VERIFY", pass: allBankVerified });
							}

							if (connections.banking.giact_service_flags.includes("authenticate")) {
								allBankVerified =
									Array.isArray(connections.banking.bank_accounts_info) &&
									connections.banking.bank_accounts_info.length > 0 &&
									connections.banking.bank_accounts_info.every(
										acc => acc.verification_result?.account_authentication_response?.code === "CA11"
									);
								bankEvaluationPaths.push({ path: "GIACT_AUTHENTICATE", pass: allBankVerified });
							}
						} else {
							allBankVerified =
								Array.isArray(connections.banking.bank_accounts_info) &&
								connections.banking.bank_accounts_info.length > 0 &&
								connections.banking.bank_accounts_info.every(acc => acc.verification_status === "VERIFIED");

							bankEvaluationPaths.push({ path: "FALLBACK_STATUS", pass: allBankVerified });
						}

						const hasActiveSOS =
							kybDetails?.sos_active?.value === true &&
							Array.isArray(kybDetails?.sos_filings?.value) &&
							kybDetails.sos_filings.value.some(filing => filing.active === true);

						const hasWatchlistHits = !(
							kybDetails?.watchlist?.value?.message === "No Watchlist hits were identified" &&
							(kybDetails?.watchlist_hits?.value === 0 || kybDetails?.watchlist_hits?.value === null)
						);

						const hasMCC = Boolean(businessMCCID);

						const isSoleProp = kybDetails?.is_sole_prop?.value === true;

						const minAutoApproveScore = scoreRanges.LOW.measurement_config.min;

						try {
							const bankAccountsDebug = (
								Array.isArray(connections?.banking?.bank_accounts_info) ? connections.banking.bank_accounts_info : []
							).map(acc => ({
								id: acc?.id,
								verify_code: acc?.verification_result?.account_verification_response?.code,
								auth_code: acc?.verification_result?.account_authentication_response?.code,
								status: acc?.verification_status
							}));

							// Capture a structured snapshot of every signal the auto-approval process evaluates for this case.
							// Enables searching by business_id / customer_id / case_id to know the reasons that changed the case status
							logger.debug({
								msg: `📸 AUTO-APPROVAL: Verification snapshot for case=${payload.case_id} business=${payload.business_id} customer=${customerID}`,
								verification_snapshot: {
									idv_owner_statuses: connections?.verification_of_owners,
									all_idv_check_pass: allIDVCheckPass,
									banking: {
										is_giact_verified: connections?.banking?.is_giact_verified,
										giact_service_flags: connections?.banking?.giact_service_flags,
										accounts: bankAccountsDebug,
										all_bank_verified: allBankVerified,
										bank_evaluation_paths: bankEvaluationPaths
									},
									kyb: {
										is_sole_prop: isSoleProp,
										watchlist_hits: hasWatchlistHits,
										active_sos: hasActiveSOS
									},
									business_mcc: hasMCC,
									tin_verified: businessVerificationStatus === BUSINESS_STATUS.VERIFIED,
									score_850: payload?.score_850,
									min_threshold: minAutoApproveScore
								}
							});
						} catch (e) {
							logger.debug(`AUTO-APPROVAL: Failed to serialize verification snapshot for debugging: ${e.message}`);
						}

						if (
							isSoleProp &&
							payload.score_850 >= scoreRanges.LOW.measurement_config.min &&
							allIDVCheckPass &&
							allBankVerified &&
							businessVerificationStatus === BUSINESS_STATUS.VERIFIED &&
							!hasWatchlistHits &&
							hasMCC
						) {
							caseStatus = CASE_STATUS.AUTO_APPROVED;
						} else if (
							!isSoleProp &&
							(!allIDVCheckPass ||
								!allBankVerified ||
								!hasActiveSOS ||
								businessVerificationStatus !== BUSINESS_STATUS.VERIFIED ||
								hasWatchlistHits ||
								!hasMCC)
						) {
							const reasons = [];
							if (!allIDVCheckPass) {
								reasons.push("IDV");
							}
							if (!allBankVerified) {
								reasons.push("Bank");
							}
							if (!hasActiveSOS) {
								reasons.push("SOS");
							}
							if (businessVerificationStatus !== BUSINESS_STATUS.VERIFIED) {
								reasons.push("TIN/BUSINESS_STATUS");
							}
							if (hasWatchlistHits) {
								reasons.push("Watchlist");
							}
							if (!hasMCC) {
								reasons.push("MCC");
							}
							logger.debug({
								msg: `AUTO-APPROVAL: non-sole-prop UMR for customer: ${customerID}, business: ${payload.business_id}, case: ${payload.case_id}`,
								reasons
							});
							caseStatus = CASE_STATUS.UNDER_MANUAL_REVIEW;
						}
					}
				} else {
					const scoreRanges = customerRiskAlertConfig.admin.score_config;

					logger.info(`RISK ALERT: Default score ranges for customer ${customerID} are ${JSON.stringify(scoreRanges)}`);

					if (payload.score_850 >= scoreRanges.LOW.measurement_config.min) {
						caseStatus = CASE_STATUS.AUTO_APPROVED;
						payload.risk_level = "LOW";
					} else if (
						payload.score_850 >= scoreRanges.MODERATE.measurement_config.min &&
						payload.score_850 < scoreRanges.MODERATE.measurement_config.max
					) {
						caseStatus = CASE_STATUS.UNDER_MANUAL_REVIEW;
						payload.risk_level = "MODERATE";
					} else {
						caseStatus = CASE_STATUS.AUTO_REJECTED;
						payload.risk_level = "HIGH";
					}

					logger.debug({
						msg: `DEFAULT: caseStatus after score calculation for customer: ${customerID}, business: ${payload.business_id}, case: ${payload.case_id}`,
						case_status: getCaseStatusText(caseStatus)
					});
				}
			}

			const insertBusinessQuery = `INSERT INTO data_business_scores (score_trigger_id, business_id, customer_id, trigger_type, score_100, score_850, risk_level, decision, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				ON CONFLICT (score_trigger_id) 
				DO UPDATE SET 
					trigger_type = EXCLUDED.trigger_type,
					score_100 = EXCLUDED.score_100,
					score_850 = EXCLUDED.score_850,
					risk_level = EXCLUDED.risk_level,
					decision = EXCLUDED.decision`;
			const queries = [insertBusinessQuery];
			const values = [
				[
					payload.score_trigger_id,
					payload.business_id,
					customerID,
					payload.trigger_type,
					payload.score_100,
					payload.score_850,
					payload.risk_level,
					payload.decision,
					payload.created_at
				]
			];
			// As payload.case_id is optional & nullable, only attempt to modify records with case-related data if the payload contains a case_id
			// Check feature flag to determine if we should respect active_decisioning_type
			let shouldSkipStatusUpdate = false;
			if (payload.case_id && customerID) {
				const approvalWorkflowsEnabled = await getFlagValue(
					FEATURE_FLAGS.FOTC_79_APPROVAL_WORKFLOWS,
					{ key: "customer", kind: "customer", customer_id: customerID },
					false
				);

				if (approvalWorkflowsEnabled && activeDecisioningType === "custom_workflow") {
					shouldSkipStatusUpdate = true;
					logger.info(
						`SCORE: Skipping case status update for case ${payload.case_id} - case uses custom_workflow decisioning type (FF enabled)`
					);
				}
			}

			// to stop automatic case status transition if the PAT_926_PAUSE_DECISIONING is enabled
			const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
				key: "customer",
				kind: "customer",
				customer_id: customerID
			});

			if (payload.case_id && !shouldSkipStatusUpdate && !shouldPauseTransition) {
				const now = new Date().toISOString();
				const updateCaseStatusQuery = `UPDATE data_cases SET status = $1, updated_at = $2 WHERE id = $3`;
				const insertCaseHistoryQuery = `INSERT INTO data_case_status_history (case_id, status, created_by) VALUES ($1,$2,$3)`;
				queries.push(updateCaseStatusQuery, insertCaseHistoryQuery);
				values.push([caseStatus, now, payload.case_id], [payload.case_id, caseStatus, ADMIN_UUID]);

				if (customerID) {
					// Send webhook event for case status update
					sendWebhookEventFlag = true;
					webhookPayload = await caseManagementService.getCaseStatusUpdatedWebhookPayload(payload.case_id);
				}
			}

			await sqlTransaction(queries, values);

			if (sendWebhookEventFlag) {
				await sendWebhookEvent(customerID, WEBHOOK_EVENTS.CASE_STATUS_UPDATED, {
					...webhookPayload,
					status: CASE_STATUS_REVERSE[caseStatus]
				});
			}
		} catch (error) {
			throw error;
		}
	}
}

export const scoreEventsHandler = new ScoreEventsHandler();
