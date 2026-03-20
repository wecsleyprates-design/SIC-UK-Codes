import {
	CUSTOM_ONBOARDING_SETUP,
	CUSTOM_ONBOARDING_TYPES,
	FEATURE_FLAGS,
	kafkaEvents,
	kafkaTopics,
	PLATFORM_PRIORITY
} from "#constants/index";
import {
	producer,
	getFlagValue,
	sqlQuery,
	sqlSequencedTransaction,
	logger,
	getCustomerData,
	getBusinessApplicants,
	sqlTransaction,
	db,
	redis
} from "#helpers/index";
import { UUID } from "crypto";
import { tokenConfig } from "#configs/index";
import { jwtSign, encryptData } from "#utils/index";

interface SendWebhookMessagePayload {
	event_code: string;
	customer_id: string;
	data: object;
}

interface sendEventToGatherWebhookDataPayload {
	events: string[];
	options: {
		business_id?: string;
		case_id?: string;
		customer_id?: string;
	};
}

interface SendSectionCompletedMessagePayload {
	business_id: UUID;
	section_name: string;
	user_id?: UUID | null;
	customer_id?: UUID | null;
	link?: string | null;
}

export const sendWebhookEvent = async (customerID: string, event: string, data: object) => {
	const sendWebhookEventFlag = await getFlagValue(FEATURE_FLAGS.WIN_1223_SEND_WEBHOOK_EVENTS);

	if (sendWebhookEventFlag) {
		const message: SendWebhookMessagePayload = {
			event_code: event,
			customer_id: customerID,
			data
		};

		await producer.send({
			topic: kafkaTopics.WEBHOOKS,
			messages: [{
				key: customerID,
				value: {
					event: kafkaEvents.SEND_WEBHOOK,
					...message
				}
			}]
		});
	}
};

export const sendEventToGatherWebhookData = async (
	events: string[],
	options: { business_id?: string; case_id?: string; customer_id?: string }
) => {
	const sendWebhookEventFlag = await getFlagValue(FEATURE_FLAGS.WIN_1223_SEND_WEBHOOK_EVENTS);

	if (sendWebhookEventFlag) {
		const message: sendEventToGatherWebhookDataPayload = {
			events,
			options
		};

		await producer.send({
			topic: kafkaTopics.BUSINESS,
			messages: [{
				key: options.business_id ?? options.case_id ?? options.customer_id ?? "",
				value: {
					event: kafkaEvents.SEND_WEBHOOK,
					...message
				}
			}]
		});
	}
};

export const addIndustryAndNaicsPlatform = async (
	businessId: string,
	platform: keyof typeof PLATFORM_PRIORITY,
	{ naics, industry }: { naics?: number | null; industry?: number }
) => {
	if (!naics && !industry) return;
	let queries: string[] = [];
	let values: any[] = [];

	const getRecord = `SELECT rel_business_industry_naics.* FROM rel_business_industry_naics 
	LEFT JOIN data_businesses db ON db.id = rel_business_industry_naics.business_id
	WHERE business_id = $1 AND platform = $2 AND db.is_deleted = false`;
	const getRecordResult = await sqlQuery({ sql: getRecord, values: [businessId, platform] });

	if (getRecordResult.rows.length) {
		await sqlQuery({
			sql: `UPDATE rel_business_industry_naics SET industry_id = $3, naics_id = $4 WHERE business_id = $1 and platform = $2`,
			values: [businessId, platform, industry, naics]
		});
	} else {
		await sqlQuery({
			sql: `INSERT INTO rel_business_industry_naics (business_id, platform, industry_id, naics_id) VALUES ($1, $2, $3, $4)`,
			values: [businessId, platform, industry, naics]
		});
	}

	const getPlatforms = `SELECT rel_business_industry_naics.* FROM rel_business_industry_naics
	LEFT JOIN data_businesses db ON db.id = rel_business_industry_naics.business_id
	WHERE business_id = $1 AND db.is_deleted = false`;
	const getPlatformsResult = await sqlQuery({ sql: getPlatforms, values: [businessId] });

	if (getPlatformsResult.rows.length < 2) return; // if there are no records or only one record as it cant be compared

	const updateNaicsQuery = `UPDATE data_businesses
						SET naics_id = $1, mcc_id = (SELECT mcc_id FROM rel_naics_mcc WHERE naics_id = $1 limit 1)
						WHERE id = $2`;
	const updateIndustryQuery = `UPDATE data_businesses SET industry = $1 WHERE id = $2`;

	const highestPriorityValue = (rows, key) => {
		const filteredDataNaics = rows
			.filter(item => item[key] !== null)
			.sort((a, b) => PLATFORM_PRIORITY[a.platform] - PLATFORM_PRIORITY[b.platform]);
		return filteredDataNaics.length > 0 ? filteredDataNaics[0][key] : null;
	};

	switch (platform) {
		case "manual":
			// bulk import has highest priority
			break;
		case "serp_scrape":
		case "tax_status":
			const highestPriorityNaicsId = highestPriorityValue(getPlatformsResult.rows, "naics_id");
			const highestPriorityIndustry = highestPriorityValue(getPlatformsResult.rows, "industry_id");

			queries.push(updateNaicsQuery);
			values.push([highestPriorityNaicsId, businessId]);
			queries.push(updateIndustryQuery);
			values.push([highestPriorityIndustry, businessId]);
			break;
		case "equifax":
			// equifax has least priority and already checking if exists
			break;
		case "frontend":
			const highestPriorityIndustry1 = highestPriorityValue(getPlatformsResult.rows, "industry_id");

			queries.push(updateIndustryQuery);
			values.push([highestPriorityIndustry1, businessId]);
	}
	await sqlSequencedTransaction(queries, values);
};

/**
 *  utility function for sending section completion events
 * @param businessId
 * @param sectionName
 * @param userId   userId is required to check whether the user is co-applicant or not.
 * @param customerId  customerId is required for white labelling purposes.
 */
export const sendKafkaEventForSection = async (
	businessId: UUID,
	sectionName: string,
	userId?: UUID | null,
	customerId?: UUID | null
): Promise<void> => {
	const sendSectionCompletedEventFlag = await getFlagValue(FEATURE_FLAGS.PAT_69_SECTION_COMPLETED_EMAIL);

	if (sendSectionCompletedEventFlag) {
		let link = "";
		if (customerId) {
			const customerConfig = await getCustomerOnboardingStages(
				customerId,
				CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP
			);
			const loginWithEmailPasswordField = customerConfig
				?.find(row => row.stage.toLowerCase() == "login")
				?.config?.fields?.find(field => field.name.toLowerCase() == "Login with Email & Password".toLowerCase());
			const customerData = await getCustomerData(customerId);
			logger.info(`customerData for ${businessId} : ${JSON.stringify(customerData)}`);

			const getInvitationQuery = `SELECT data_invites.id FROM public.data_invites
			LEFT JOIN data_businesses db ON db.id = data_invites.business_id
			WHERE data_invites.customer_id = $1 AND data_invites.business_id = $2 AND data_invites.action_taken_by = $3 AND db.is_deleted = false`;
			const getBusinessNameQuery = `SELECT name FROM data_businesses WHERE id = $1 AND is_deleted = false`;

			const records = await getBusinessApplicants(businessId);
			const ownerDetails = records.find(record => record.code === "owner");

			if (ownerDetails) {
				const [getInvitationResult, getBusinessNameResult] = await sqlTransaction(
					[getInvitationQuery, getBusinessNameQuery],
					[[customerId, businessId, ownerDetails.id], [businessId]]
				);
				const businessName = getBusinessNameResult.rows[0].name;

				let inviteToken: any = {
					applicant_id: ownerDetails.id,
					applicant_name: `${ownerDetails.first_name} ${ownerDetails.last_name}`,
					email: ownerDetails.email,
					invitation_id: getInvitationResult?.rows?.[0]?.id,
					business_id: businessId,
					is_no_login: false,
					case: "onboard_applicant_by_customer",
					first_name: ownerDetails.first_name,
					last_name: ownerDetails.last_name,
					business_name: businessName,
					customer_name: customerData.company_details.name,
					customer_id: customerId,
					iat: Date.now(),
					exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS * 1000
				};

				if (loginWithEmailPasswordField && !loginWithEmailPasswordField?.status) {
					inviteToken = {
						...inviteToken,
						exp: Date.now() + tokenConfig.NO_LOGIN_VERIFY_EMAIL_INVITE_TOKEN_LIFE_SECONDS * 1000,

						is_no_login: true
					};
				}

				logger.info(`inviteToken for ${businessId} : ${JSON.stringify(inviteToken)}`);

				link = `verify/invite?token=${jwtSign(encryptData(inviteToken))}&first_name=${encodeURIComponent(
					`${ownerDetails.first_name}`
				)}&last_name=${encodeURIComponent(`${ownerDetails.last_name}`)}&business_name=${encodeURIComponent(
					businessName
				)}&customer_name=${encodeURIComponent(`${customerData.company_details.name}`)}`;
			}
		}
		logger.info(`link for ${businessId} : ${link}`);

		const message: SendSectionCompletedMessagePayload = {
			business_id: businessId,
			section_name: sectionName,
			user_id: userId,
			customer_id: customerId,
			...(link && { link })
		};

	const payload = {
		topic: kafkaTopics.NOTIFICATIONS,
		messages: [{
			key: businessId,
			value: {
				event: kafkaEvents.SECTION_COMPLETED,
				...message
			}
		}]
	};

	await producer.send(payload);
	logger.info(`Kafka event sent for business: ${businessId}, section: ${sectionName}`);
	}
};

export const sendApplicationReadytoSubmit = async (
	businessId: UUID,
	inviteLink?: string | null,
	customerId?: UUID | null
): Promise<void> => {
	const message = {
		business_id: businessId,
		customer_id: customerId,
		invite_link: inviteLink
	};

	const redisKey = `{business}:${businessId}:ready_to_submit`;
	const redisResult = await redis.get(redisKey);

	if (redisResult) {
		logger.info(`Kafka event already sent for business: ${businessId}`);
		return;
	}

	const payload = {
		topic: kafkaTopics.USERS_NEW,
		messages: [{
			key: businessId,
			value: {
				event: kafkaEvents.APPLICATION_READY_TO_SUBMIT,
				...message
			}
		}]
	};

	await producer.send(payload);
	await redis.set(redisKey, "true");
	logger.info(`Kafka event APPLICATION_READY_TO_SUBMIT sent for business: ${businessId}}`);
};

export const createLinkForReadyToSubmitEvent = async (
	businessId: UUID,
	ownerDetails: { id: UUID; first_name: string; last_name: string; email: string },
	businessName: string,
	customerId?: UUID | null,
	noLogin = false
): Promise<void> => {
	let link = "";
	if (customerId) {
		const customerData = await getCustomerData(customerId);
		logger.info(`customerData for ${businessId} : ${JSON.stringify(customerData)}`);

		const getInvitationQuery = `SELECT data_invites.id FROM public.data_invites
		LEFT JOIN data_businesses db ON db.id = data_invites.business_id
		WHERE data_invites.customer_id = $1 AND data_invites.business_id = $2 AND data_invites.action_taken_by = $3 AND db.is_deleted = false`;
		const getInvitationResult = await sqlQuery({
			sql: getInvitationQuery,
			values: [customerId, businessId, ownerDetails.id]
		});

		logger.info(`getInvitationResult for ${businessId} : ${JSON.stringify(getInvitationResult)}`);

		const inviteToken = {
			applicant_id: ownerDetails.id,
			applicant_name: `${ownerDetails.first_name} ${ownerDetails.last_name}`,
			email: ownerDetails.email,
			invitation_id: getInvitationResult?.rows?.[0]?.id,
			business_id: businessId,
			case: "onboard_applicant_by_customer",
			iat: Date.now(),
			exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS * 1000,
			customer_id: customerId,
			is_no_login: noLogin
		};

		logger.info(`inviteToken for ${businessId} : ${JSON.stringify(inviteToken)}`);

		link = `verify/invite?token=${encodeURIComponent(
			jwtSign(encryptData(inviteToken))
		)}&first_name=${encodeURIComponent(`${ownerDetails.first_name}`)}&last_name=${encodeURIComponent(
			`${ownerDetails.last_name}`
		)}&business_name=${encodeURIComponent(businessName)}&customer_name=${encodeURIComponent(
			`${customerData?.first_name} ${customerData?.last_name}`
		)}`;
	}
	logger.info(`link for ${businessId} : ${link}`);

	await sendApplicationReadytoSubmit(businessId, link, customerId);
};

export const sendEventToFetchAdverseMedia = async (businessId: UUID, customerId: UUID, caseId: UUID) => {
	const [businessResult, dbaNamesResult, contactNamesResult] = await Promise.all([
		db("data_businesses")
			.select("data_businesses.name", "data_businesses.address_city", "data_businesses.address_state")
			.where("id", businessId)
			.andWhere("data_businesses.is_deleted", false)
			.first(),

		db("data_business_names")
			.leftJoin("data_businesses as db", "db.id", "data_business_names.business_id")
			.select("data_business_names.name")
			.where("data_business_names.business_id", businessId)
			.andWhere("data_business_names.is_primary", false)
			.andWhere("db.is_deleted", false),

		db("data_owners")
			.select("first_name", "last_name")
			.leftJoin("rel_business_owners", "data_owners.id", "rel_business_owners.owner_id")
			.leftJoin("data_businesses as db", "db.id", "rel_business_owners.business_id")
			.where("rel_business_owners.business_id", businessId)
			.andWhere("db.is_deleted", false)
	]);

	const dbaNames = dbaNamesResult.map(item => item.name);
	const contactNames = contactNamesResult.map(item => `${item.first_name} ${item.last_name}`);

	const message = {
		customer_id: customerId,
		business_id: businessId,
		case_id: caseId,
		business_name: businessResult.name,
		dba_names: dbaNames,
		contact_names: contactNames,
		city: businessResult?.address_city,
		state: businessResult?.address_state
	};

	const payload = {
		topic: kafkaTopics.BUSINESS,
		messages: [{
			key: businessId,
			value: {
				event: kafkaEvents.FETCH_ADVERSE_MEDIA_REPORT,
				...message
			}
		}]
	};

	await producer.send(payload);
};

export const triggerSectionCompletedKafkaEventWithRedis = async (
	businessID: UUID,
	sectionName: string,
	userID: UUID,
	customerID: UUID,
	redis
) => {
	const businessKey = `{business}:${businessID}:{first_integration}`;
	const redisKey = `{business}:${businessID}:${sectionName.toLowerCase()}:${userID}`;

	const alreadyTriggered = await redis.sismember(businessKey, redisKey);
	logger.info(
		`SECTION COMPLETED EVENT REDIS KEY ALREADY EXISTS: ${sectionName} : ${JSON.stringify(
			alreadyTriggered
		)} : ${redisKey}`
	);

	if (!alreadyTriggered) {
		try {
			await sendKafkaEventForSection(businessID, sectionName, userID, customerID);
			await redis.sadd(businessKey, redisKey);
		} catch (err) {
			logger.error({ err }, `Error sending Kafka event for section '${sectionName}'`);
		}
	}
};

export const getCustomerOnboardingStages = async (customerID: string, setupType: string) => {
	try {
		// Get customer onboarding setups
		const getCustomerOnboardingSetupsQuery = `SELECT rcss.setup_id, rcss.is_enabled, cost.code, cost.label
			FROM onboarding_schema.rel_customer_setup_status rcss
			LEFT JOIN onboarding_schema.core_onboarding_setup_types cost ON cost.id = rcss.setup_id
			WHERE rcss.customer_id = $1 AND cost.code = $2`;
		const getCustomerOnboardingSetupsResult = await sqlQuery({
			sql: getCustomerOnboardingSetupsQuery,
			values: [customerID, setupType]
		});

		if (!getCustomerOnboardingSetupsResult.rows.length || !getCustomerOnboardingSetupsResult.rows[0].is_enabled) {
			return null;
		} else {
			const getCustomerOnboardingStagesQuery = `SELECT dcos.id AS stage_id, dcos.stage, dcos.completion_weightage, dcos.allow_back_nav, dcos.is_skippable, dcos.is_enabled, dcos.is_removable, dcos.is_orderable, dcos.next_stage, dcos.prev_stage, dcos.priority_order, dcos.stage_code, dcsfc.config
				FROM onboarding_schema.data_customer_onboarding_stages dcos
				LEFT JOIN onboarding_schema.data_customer_stage_fields_config dcsfc ON dcsfc.customer_stage_id = dcos.id
				LEFT JOIN onboarding_schema.core_onboarding_stages cos ON cos.code = dcos.stage_code
				LEFT JOIN onboarding_schema.rel_onboarding_stage_type ON rel_onboarding_stage_type.stage_id = cos.id
				LEFT JOIN onboarding_schema.core_onboarding_types cot ON cot.id = rel_onboarding_stage_type.onboarding_type_id
				WHERE dcos.customer_id = $1 AND cot.code = $2`;
			const getCustomerOnboardingStagesValues = [customerID];
			getCustomerOnboardingStagesValues.push(
				setupType === CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP
					? CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING
					: CUSTOM_ONBOARDING_TYPES.LIGHTNING_ONBOARDING
			);
			const getCustomerOnboardingStagesResult = await sqlQuery({
				sql: getCustomerOnboardingStagesQuery,
				values: getCustomerOnboardingStagesValues
			});
			return getCustomerOnboardingStagesResult.rows;
		}
	} catch (error) {
		throw error;
	}
};

export const calculateBusinessFactsEvent = async (
	businessId: UUID,
	caseId?: UUID,
	customerId?: UUID,
	previousStatus?: string
) => {
	const payload = {
		topic: kafkaTopics.BUSINESS,
		messages: [{
			key: businessId,
			value: {
				event: kafkaEvents.CALCULATE_BUSINESS_FACTS,
				business_id: businessId,
				case_id: caseId,
				customer_id: customerId,
				previous_status: previousStatus
			}
		}]
	};

	await producer.send(payload);
};
