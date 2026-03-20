import { logger } from "#helpers/logger";
import { catchAsync } from "#utils/index";
import { TruliooBusiness } from "#lib/trulioo/business/truliooBusiness";
import { TruliooPerson } from "#lib/trulioo/person/truliooPerson";
import { TruliooFlows } from "#lib/trulioo/common/types";
import { envConfig } from "#configs";
import { db } from "#helpers/knex";
import { getOrCreateConnection } from "#helpers/platformHelper";
import { INTEGRATION_ID } from "#constants";
import { convertToUUIDFormat, sanitizeLog } from "#lib/trulioo/common/utils";

/**
 * Simple sleep utility
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Search for business_id by company name as a fallback
 */
async function findBusinessIdByName(companyName: string): Promise<string | undefined> {
	if (!companyName) return undefined;
	try {
		const business = await db("public.businesses")
			.whereRaw("LOWER(name) = ?", [companyName.toLowerCase().trim()])
			.select("id")
			.first();
		return business?.id;
	} catch (error) {
		logger.error(error, `Error finding business ID by name: ${companyName}`);
		return undefined;
	}
}

/**
 * Check if webhook was already processed (idempotency)
 */
async function isWebhookProcessed(webhookId: string, transactionId: string): Promise<boolean> {
	try {
		const existing = await db("integration_data.trulioo_webhook_events")
			.where({ webhook_id: webhookId, transaction_id: transactionId })
			.first();
		return !!existing;
	} catch (error: unknown) {
		logger.error(error, `Error checking webhook idempotency for ${webhookId}, ${transactionId}`);
		return false; // Fail-open: continue processing if check fails
	}
}

/**
 * Record webhook as processed for idempotency
 */
async function recordWebhookProcessed(
	webhookId: string,
	transactionId: string,
	clientId: string | undefined,
	event: { name?: string; type?: string; result?: string } | undefined,
	hasError: boolean
): Promise<void> {
	try {
		await db("integration_data.trulioo_webhook_events")
			.insert({
				webhook_id: webhookId,
				transaction_id: transactionId,
				client_id: clientId || null,
				event_name: event?.name || null,
				event_type: event?.type || null,
				event_result: event?.result || null,
				has_error: hasError,
				processed_at: db.raw("now()")
			})
			.onConflict(["webhook_id", "transaction_id"])
			.ignore();
	} catch (error: unknown) {
		logger.error(error, `Error recording webhook idempotency for ${webhookId}, ${transactionId}`);
	}
}

/**
 * Determine flow type from webhook payload
 * @param flowId - Flow ID from webhook payload
 * @returns Flow type (KYB or PSC)
 */
function determineFlowType(flowId: string | undefined): TruliooFlows {
	if (!flowId) {
		return TruliooFlows.KYB; // Default to KYB if flowId not provided
	}

	const kybFlowId = envConfig.TRULIOO_KYB_FLOWID || "kyb-flow";
	const pscFlowId = envConfig.TRULIOO_PSC_FLOWID || "psc-screening-flow";

	if (flowId === pscFlowId) {
		return TruliooFlows.PSC;
	}

	// Default to KYB (for backward compatibility and if flowId matches KYB or is unknown)
	return TruliooFlows.KYB;
}

/**
 * International Business Webhook Controller
 * Handles Trulioo webhook events for international business verification
 * Supports both KYB and PSC flows
 */
export const internationalBusinessController = {
	/**
	 * Handle Trulioo international business webhook events
	 * POST /api/v1/verification/international-businesses/webhook
	 *
	 * Handles both:
	 * 1. URL verification handshake (initial setup)
	 *    Docs: https://developer.trulioo.com/reference/api-handshake
	 * 2. Regular webhook events
	 *    Docs: https://developer.trulioo.com/reference/sendevent
	 */
	handleInternationalBusinessWebhook: catchAsync(async (req, res) => {
		const { type, challenge, id, transactionId, clientId, event, error, flowId } = req.body;

		// Determine flow type from webhook payload
		const flowType = determineFlowType(flowId);
		// logger.info(`Determined flow type: ${flowType} for flowId: ${flowId}`);

		// Handle URL verification handshake
		// Trulioo sends this when configuring the webhook URL to verify ownership
		if (type === "URL_VERIFICATION" && challenge) {
			logger.info(`Trulioo webhook URL verification handshake received. Challenge: ${challenge.substring(0, 20)}...`);
			// Return the challenge value to complete verification
			// Must return 200 with JSON object containing challenge field
			// Response format: { "challenge": "<challenge_value>" }
			const response = { challenge };
			logger.info(`Trulioo webhook handshake response: ${JSON.stringify(response)}`);
			return res.status(200).json(response);
		}

		// Handle EVENT_CALLBACK webhooks (different structure, no transactionId/clientId)
		// When FLOW_END is received, process the webhook using id as transactionId (hfSession)
		if (type === "EVENT_CALLBACK") {
			const eventType = event?.type;
			const eventName = event?.name;
			const sanitizedData = sanitizeLog(JSON.stringify({ id, flowId, eventType, eventName, flowType }));
			logger.info(`Trulioo EVENT_CALLBACK webhook received: ${sanitizedData}`);

			// PROACTIVE LINKING: For intermediate steps, try to link company name to hfSession (id)
			// This helps break race conditions before FLOW_END arrives
			const companyName = req.body?.payload?.company_name || req.body?.payload?.name;
			if ((eventType === "STEP_SUBMIT" || eventType === "SERVICE_SUBMIT") && companyName) {
				try {
					const businessId = await findBusinessIdByName(companyName);
					if (businessId) {
						const uuidFormattedSession = convertToUUIDFormat(id);
						await db("integration_data.business_entity_verification")
							.insert({
								business_id: businessId,
								external_id: uuidFormattedSession,
								name: companyName,
								status: "in_progress",
								unique_external_id: uuidFormattedSession
							})
							.onConflict(["external_id"])
							.ignore();
						logger.info(`Proactively linked ${sanitizeLog(id)} to business ${businessId} via ${sanitizeLog(eventType)}`);
					}
				} catch (e) {
					logger.warn(`Failed proactive linking for ${sanitizeLog(id)}: ${e}`);
				}
			}

			// Process FLOW_END events - these indicate the flow has completed
			if (eventType === "FLOW_END") {
				logger.info(`Processing Trulioo FLOW_END event for transaction: ${sanitizeLog(id)}, flowType: ${flowType}`);
				try {
					const uuidFormattedSession = convertToUUIDFormat(id);

					// TODO: Idempotency check - implement in future sprint
					// The FLOW_END event is only sent once per flow, so idempotency is not critical for now
					// See: trulioo_webhook_events table migration for future implementation

					// RESILIENCE: Retry loop to find the business_id (handles race conditions where webhook arrives before insert)
					let verificationRecord;
					let retries = 3;
					while (retries > 0) {
						verificationRecord = await db("integration_data.business_entity_verification")
							.where({ external_id: uuidFormattedSession })
							.first();

						if (verificationRecord?.business_id) break;

						logger.info(`Business ID not found for ${sanitizeLog(id)}, retrying in 2s... (${retries} attempts left)`);
						await sleep(2000);
						retries--;
					}

					let businessId = verificationRecord?.business_id;

					// FALLBACK: If still not found, try searching by company name in public.businesses if available in payload
					if (!businessId && companyName) {
						businessId = await findBusinessIdByName(companyName);
						if (businessId) {
							logger.info(`Found businessId ${businessId} via name fallback for session ${sanitizeLog(id)}`);
						}
					}

					if (!businessId) {
						logger.error(`Trulioo FLOW_END webhook: Could not find business_id for transaction: ${sanitizeLog(id)} after retries and fallback.`);
						return res.jsend.success("Trulioo FLOW_END webhook received but no business_id found.");
					}

					// Process webhook based on flow type
					logger.info(`Processing Trulioo FLOW_END event for business: ${businessId}, transaction: ${sanitizeLog(id)}, flowType: ${flowType}`);
					const connection = await getOrCreateConnection(businessId, INTEGRATION_ID.TRULIOO);

					if (flowType === TruliooFlows.PSC) {
						const truliooPerson = new TruliooPerson(businessId, connection);
						await truliooPerson.processWebhookDoneEvent(id, "fetch_business_entity_verification_person");
					} else {
						const truliooBusiness = new TruliooBusiness(businessId, connection);
						await truliooBusiness.processWebhookDoneEvent(id);

						// DYNAMIC TRIGGER: After KYB completes, trigger PSC screening with dynamic data
						try {
							logger.info(`KYB flow completed. Triggering dynamic PSC screening for business: ${businessId}`);

							// Retrieve the full results from Trulioo to get UBOs/Directors
							const rawClientData = await truliooBusiness.getClientData({
								hfSession: id,
								queryParams: { includeFullServiceDetails: "true" }
							});

							const flowResult = {
								hfSession: id,
								flowData: { elements: [] },
								submitResponse: {},
								clientData: rawClientData
							};

							// Trigger PSC screening (this extracts people and calls Trulioo for each one)
							// Pass the taskId from KYB verification so PSC records can inherit it
							await truliooBusiness.triggerPSCScreening(verificationRecord.id, rawClientData, flowResult, verificationRecord.business_integration_task_id);
						} catch (pscError: unknown) {
							logger.error(pscError, `Error triggering dynamic PSC screening for business: ${businessId}`);
						}
					}


					return res.jsend.success(`Trulioo FLOW_END webhook processed successfully (flowType: ${flowType}).`);
				} catch (error: unknown) {
					logger.error(error, `Error processing Trulioo FLOW_END event for transaction: ${sanitizeLog(id)}`);
					return res.jsend.error("Error processing Trulioo FLOW_END webhook.");
				}
			}

			// For other EVENT_CALLBACK types (STEP_SUBMIT, SERVICE_SUBMIT), just acknowledge
			return res.jsend.success("Trulioo EVENT_CALLBACK webhook received.");
		}

		// Regular webhook event processing (standard verification events)
		// Validate required fields
		if (!id || !transactionId) {
			logger.warn(`Trulioo webhook missing required fields: id=${id}, transactionId=${transactionId}`);
			return res.jsend.success("Trulioo webhook received but missing required fields.");
		}

		// TODO: idempotency check
		// Idempotency check
		// if (await isWebhookProcessed(id, transactionId)) {
		// 	logger.info(`Trulioo webhook ${id} for transaction ${transactionId} already processed, skipping`);
		// 	return res.jsend.success("Trulioo webhook already processed.");
		// }

		logger.info(`Trulioo webhook received: ${JSON.stringify({ webhookId: id, transactionId, clientId, eventName: event?.name, hasError: !!error, flowType })}`);

		if (!clientId) {
			logger.warn(`Trulioo webhook received without clientId for transactionId: ${transactionId}`);
			return res.jsend.success("Trulioo webhook received but not processed (no clientId provided).");
		}

		// Process "done" events based on flow type
		let webhookProcessed = false;
		if (event?.name === "done") {
			logger.info(`Processing Trulioo "done" event for business: ${clientId}, transaction: ${transactionId}, flowType: ${flowType}`);
			try {
				// Get or create connection for Trulioo to ensure dbConnection is available
				const connection = await getOrCreateConnection(clientId, INTEGRATION_ID.TRULIOO);

				if (flowType === TruliooFlows.PSC) {
					// Process PSC flow webhook
					const truliooPerson = new TruliooPerson(clientId, connection);
					await truliooPerson.processWebhookDoneEvent(transactionId, "fetch_business_person_verification");
				} else {
					// Process KYB flow webhook (existing logic)
					const truliooBusiness = new TruliooBusiness(clientId, connection);
					await truliooBusiness.processWebhookDoneEvent(transactionId);
				}
				webhookProcessed = true;
			} catch (error: unknown) {
				logger.error(error, `Error processing Trulioo "done" event for business: ${clientId}, transaction: ${transactionId}`);
				// Don't mark as processed to allow retry
			}
		} else {
			logger.info(`Trulioo webhook event "${event?.name}" received but not processed for business: ${clientId}`);
			webhookProcessed = true; // Mark non-"done" events as processed to avoid reprocessing
		}

		if (error) {
			logger.error(`Trulioo webhook error: ${JSON.stringify({ errorCode: error.code, errorMessage: error.message })}`);
		}

		// TODO: idempotency check
		// Record as processed if successful
		// if (webhookProcessed) {
		// 	await recordWebhookProcessed(id, transactionId, clientId, event, !!error);
		// }

		res.jsend.success(`Trulioo international business webhook processed successfully (flowType: ${flowType}).`);
	}),

	/**
	 * Handle Trulioo international business person webhook events (PSC flows)
	 * POST /api/v1/verification/international-businesses/person/webhook
	 *
	 * Handles both:
	 * 1. URL verification handshake (initial setup)
	 *    Docs: https://developer.trulioo.com/reference/api-handshake
	 * 2. Regular webhook events for PSC flows
	 *    Docs: https://developer.trulioo.com/reference/sendevent
	 */
	handleInternationalBusinessPersonWebhook: catchAsync(async (req, res) => {
		const { type, challenge, id, transactionId, clientId, event, error, flowId } = req.body;

		// Determine flow type from webhook payload (should be PSC for person webhook)
		const flowType = determineFlowType(flowId);
		logger.info(`Person webhook - Determined flow type: ${flowType} for flowId: ${flowId}`);

		// Handle URL verification handshake
		if (type === "URL_VERIFICATION" && challenge) {
			logger.info(`Trulioo person webhook URL verification handshake received. Challenge: ${challenge.substring(0, 20)}...`);
			const response = { challenge };
			logger.info(`Trulioo person webhook handshake response: ${JSON.stringify(response)}`);
			return res.status(200).json(response);
		}

		// Handle EVENT_CALLBACK webhooks
		if (type === "EVENT_CALLBACK") {
			const eventType = event?.type;
			logger.info(`Trulioo person EVENT_CALLBACK webhook received: ${JSON.stringify({ id, flowId, eventType, flowType })}`);

			// Process FLOW_END events
			if (eventType === "FLOW_END") {
				logger.info(`Processing Trulioo person FLOW_END event for transaction: ${id}, flowType: ${flowType}`);
				try {
					const uuidFormattedSession = convertToUUIDFormat(id);

					// TODO: Idempotency check - implement in future sprint
					// The FLOW_END event is only sent once per flow, so idempotency is not critical for now
					// See: trulioo_webhook_events table migration for future implementation

					// RESILIENCE: Retry loop to find the business_id
					let verificationRecord;
					let retries = 3;
					while (retries > 0) {
						verificationRecord = await db("integration_data.business_entity_verification")
							.where({ external_id: uuidFormattedSession })
							.first();

						if (verificationRecord?.business_id) break;

						logger.info(`Business ID not found for person session ${sanitizeLog(id)}, retrying in 2s... (${retries} attempts left)`);
						await sleep(2000);
						retries--;
					}

					if (!verificationRecord?.business_id) {
						logger.error(`Trulioo person FLOW_END webhook: Could not find business_id for transaction: ${sanitizeLog(id)} (UUID: ${uuidFormattedSession}) after retries.`);
						return res.jsend.success("Trulioo person FLOW_END webhook received but no business_id found.");
					}

					const businessId = verificationRecord.business_id;

					// Process PSC flow webhook - gather data and save to request_response table
					logger.info(`Processing Trulioo person FLOW_END event for business: ${businessId}, transaction: ${sanitizeLog(id)}`);
					const connection = await getOrCreateConnection(businessId, INTEGRATION_ID.TRULIOO);
					const truliooPerson = new TruliooPerson(businessId, connection);
					await truliooPerson.processWebhookDoneEvent(id, "fetch_business_entity_verification_person");



					return res.jsend.success(`Trulioo person FLOW_END webhook processed successfully .`);
				} catch (error: unknown) {
					logger.error(error, `Error processing Trulioo person FLOW_END event for transaction: ${sanitizeLog(id)}`);
					return res.jsend.error("Error processing Trulioo person FLOW_END webhook.");
				}
			}

			return res.jsend.success("Trulioo person EVENT_CALLBACK webhook received (not processed - not FLOW_END).");
		}

		// Regular webhook event processing
		if (!id || !transactionId) {
			logger.warn(`Trulioo person webhook missing required fields: id=${id}, transactionId=${transactionId}`);
			return res.jsend.success("Trulioo person webhook received but missing required fields.");
		}

		// TODO: idempotency check
		// Idempotency check
		// if (await isWebhookProcessed(id, transactionId)) {
		// 	logger.info(`Trulioo person webhook ${id} for transaction ${transactionId} already processed, skipping`);
		// 	return res.jsend.success("Trulioo person webhook already processed.");
		// }

		logger.info(`Trulioo person webhook received: ${JSON.stringify({ webhookId: id, transactionId, clientId, eventName: event?.name, hasError: !!error, flowType })}`);

		if (!clientId) {
			logger.warn(`Trulioo person webhook received without clientId for transactionId: ${transactionId}`);
			return res.jsend.success("Trulioo person webhook received but not processed (no clientId provided).");
		}

		// Process "done" events for PSC flows
		// Note: Regular "done" events are typically handled by FLOW_END events above
		// This section handles legacy webhook format if needed
		let webhookProcessed = false;
		if (event?.name === "done") {
			logger.info(`Processing Trulioo person "done" event for business: ${clientId}, transaction: ${transactionId}, flowType: ${flowType}`);
			try {
				const connection = await getOrCreateConnection(clientId, INTEGRATION_ID.TRULIOO);
				const truliooPerson = new TruliooPerson(clientId, connection);
				// Save PSC flow results with new request_type
				await truliooPerson.processWebhookDoneEvent(transactionId, "fetch_business_entity_verification_person");
				webhookProcessed = true;
			} catch (error: unknown) {
				logger.error(error, `Error processing Trulioo person "done" event for business: ${clientId}, transaction: ${transactionId}`);
			}
		} else {
			logger.info(`Trulioo person webhook event "${event?.name}" received but not processed for business: ${clientId}`);
			webhookProcessed = true;
		}

		if (error) {
			logger.error(`Trulioo person webhook error: ${JSON.stringify({ errorCode: error.code, errorMessage: error.message })}`);
		}

		// TODO: idempotency check
		// Record as processed if successful
		// if (webhookProcessed) {
		// 	await recordWebhookProcessed(id, transactionId, clientId, event, !!error);
		// }

		res.jsend.success(`Trulioo person webhook processed successfully (flowType: ${flowType}).`);
	})
};
