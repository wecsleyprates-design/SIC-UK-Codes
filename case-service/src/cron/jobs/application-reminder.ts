import { logger, producer, sqlQuery } from "../../helpers/index";

import { kafkaTopics, kafkaEvents, CASE_TYPE, WEBHOOK_EVENTS, CUSTOM_ONBOARDING_SETUP } from "../../constants/index";
import { onboarding } from "../../api/v1/modules/onboarding/onboarding";

export const applicantReminder = async () => {
	logger.info("=============== Executing Cron Job to Send Applicant Reminders ===============");

	// Fetch all cases eligible for reminders
	// The query fetches cases with their first invite date and checks against the reminder configurations
	// to determine if a reminder should be sent based on thresholds and allowed case statuses.
	// we have three levels of config: business, customer, default core
	// We pick the most specific config available in that order.(business > customer > default core)

	const _allCases = await sqlQuery({
		sql: `WITH first_invite AS (
                    SELECT
                        dc.id AS case_id,
                        dc.applicant_id,
                        dc.business_id,
                        db.name as business_name,
                        dc.customer_id,
                        dc.status,
                        fi.id AS first_invitation_id,
                        fi.created_at AS first_invite_created_at
                    FROM data_cases dc
                    left join data_businesses db on db.id = dc.business_id
                    LEFT JOIN LATERAL (
                        SELECT di.id, di.created_at
                        FROM data_invites di
                        WHERE di.case_id = dc.id
                        ORDER BY di.created_at ASC
                        LIMIT 1
                    ) fi ON true
                    WHERE dc.case_type = ${CASE_TYPE.ONBOARDING}
                    AND dc.customer_id IS NOT NULL
                ),
                final_config AS (
                    SELECT
                        fi.case_id,
                        fi.business_id,
                        fi.customer_id,
                        fi.applicant_id,
                        fi.business_name,
                        fi.status,
                        fi.first_invite_created_at,
                        fi.first_invitation_id,
                        CASE
                            WHEN b.is_enabled = true THEN b.config
                            WHEN c.is_enabled = true AND b.id IS NULL THEN c.config
                            ELSE NULL
                        END AS config
                    FROM first_invite fi
                    LEFT JOIN data_business_applicant_configs b
                        ON b.business_id = fi.business_id
                        AND b.core_config_id = 1
                        AND b.is_enabled = true  
                    LEFT JOIN data_customer_applicant_configs c
                        ON c.customer_id = fi.customer_id
                        AND c.core_config_id = 1
                        AND c.is_enabled = true
                        AND b.id IS NULL
                ),
                eligible_thresholds AS (
                    SELECT
                        fi.case_id,
                        fi.business_id,
                        fi.customer_id,
                        fi.applicant_id,
                        fi.business_name,
                        fi.status,
                        fi.first_invite_created_at,
                        fi.first_invitation_id,
                        DATE_PART('day', NOW() - fi.first_invite_created_at)::int AS days_since_first_invite,
                        elem->>'urgency'            AS urgency,
                        (elem->>'threshold')::int   AS threshold,
                        elem->'allowed_case_status' AS allowed_case_status,
                        elem->>'message'            AS message
                    FROM final_config fi
                    CROSS JOIN LATERAL jsonb_array_elements(fi.config) elem
                    LEFT JOIN data_applicants_threshold_reminder_tracker tr
                        ON tr.applicant_id = fi.applicant_id
                        AND tr.case_id = fi.case_id
                        AND tr.urgency = elem->>'urgency'
                        AND tr.threshold_days = (elem->>'threshold')::int
                    WHERE fi.config IS NOT NULL 
                    AND fi.first_invite_created_at IS NOT NULL
                    AND tr.id IS NULL
                    AND DATE_PART('day', NOW() - fi.first_invite_created_at)::int >= (elem->>'threshold')::int
                    AND fi.status = ANY (
                            SELECT jsonb_array_elements_text(elem->'allowed_case_status')::int
                        )
                    AND (elem->>'threshold')::int = (
					    SELECT MAX((elem2->>'threshold')::int)
					    FROM jsonb_array_elements(fi.config) elem2
					    WHERE DATE_PART('day', NOW() - fi.first_invite_created_at)::int >= (elem2->>'threshold')::int
					)
                ),
                ranked_thresholds AS (
                    SELECT 
                        et.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY et.case_id
                            ORDER BY et.threshold DESC
                        ) AS rank
                    FROM eligible_thresholds et
                )
                SELECT
                    case_id,
                    applicant_id,
                    business_id,
                    customer_id,
                    business_name,
                    first_invitation_id,
                    first_invite_created_at,
                    days_since_first_invite,
                    urgency,
                    threshold,
                    message,
                    allowed_case_status
                FROM ranked_thresholds
                WHERE rank = 1
                ORDER BY case_id`
	});

	for (const _case of _allCases.rows) {
		try {
			const customerConfig = await onboarding.getCustomerOnboardingStages(
				{ customerID: _case.customer_id },
				{ setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP },
				false
			);
			const loginWithEmailPasswordField = customerConfig
				?.find(row => row.stage.toLowerCase() === "login")
				?.config?.fields?.find(field => field.name.toLowerCase() === "Login with Email & Password".toLowerCase());

			// Create Kafka event payload
			const payload = {
				event: kafkaEvents.APPLICANT_REMINDER,
				event_code: WEBHOOK_EVENTS.APPLICANT_REMINDER,
				timestamp: new Date().toISOString(),
				business_id: _case.business_id,
				business_name: _case.business_name,
				customer_id: _case.customer_id,
				invitation_id: _case.first_invitation_id,
				case_id: _case.case_id,
				applicant_id: _case.applicant_id,
				urgency: _case.urgency,
				days_since_invite_click: _case.days_since_first_invite,
				urgency_threshold_days: _case.threshold,
				custom_message: _case.message,
				is_no_login: loginWithEmailPasswordField ? !loginWithEmailPasswordField?.status : false
			};

		// Send Kafka event
		await producer.send({
			topic: kafkaTopics.USERS_NEW,
			messages: [
				{
					key: _case.business_id,
					value: payload
				}
			]
		});

			// Track that reminder was sent
			await sqlQuery({
				sql: `INSERT INTO data_applicants_threshold_reminder_tracker 
					(applicant_id, case_id, business_id, customer_id, threshold_days, urgency, days_since_invite_click) 
					VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				values: [
					_case.applicant_id,
					_case.case_id,
					_case.business_id,
					_case.customer_id,
					_case.threshold,
					_case.urgency,
					_case.days_since_first_invite
				]
			});

			logger.info(`Applicant reminder sent for case ${_case.case_id} with urgency ${_case.urgency}`);
		} catch (error) {
			logger.error(error, `Error processing applicant reminder for case ID ${_case.case_id}`);
		}
	}
};
