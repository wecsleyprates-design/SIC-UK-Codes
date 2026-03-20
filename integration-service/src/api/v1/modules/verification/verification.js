import { ERROR_CODES, INTEGRATION_CATEGORIES, INTEGRATION_ID, INTEGRATION_STATUS } from "#constants/index";
import { Persona } from "#lib/index";
import { StatusCodes } from "http-status-codes";
import { VerificationApiError } from "./error";
import { db, logger, sqlQuery } from "#helpers/index";
import { envConfig } from "#configs/index";

class VerificationService {
	constructor() {
		this.persona = new Persona(envConfig.PERSONA_API_KEY);
	}

	async createInquiry({ businessID }, userInfo) {
		try {
			const { user_id: userID } = userInfo;

			// check if email already has inquiryId assigned
			const getVerificationStatusQuery = "SELECT * FROM data_integrations WHERE business_id = $1 and integration_id = $2";
			const getVerificationStatusResult = await sqlQuery({ sql: getVerificationStatusQuery, values: [businessID, INTEGRATION_ID.PERSONA] });

			if (getVerificationStatusResult.rowCount) {
				const { inquiry_status: inquiryStatus, inquiry_id: inquiryID } = getVerificationStatusResult.rows[0].data;

				if (inquiryStatus === "completed") {
					return { data: { is_persona_linked: true }, message: "A connected persona account has been located." };
				}

				// this means that the user has already got an inquiryId assigned, delete the inquiry and create a new one
				const deleteInquiryResponse = await this.persona.deleteInquiry(inquiryID);

				if (deleteInquiryResponse.success !== true) {
					const { title } = deleteInquiryResponse.error.causes[0];
					throw new VerificationApiError(title, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
				}

				// userID is being used as reference id to create inquiry
				const createInquiryResponse = await this.persona.createInquiry(userID);

				if (createInquiryResponse.success !== true) {
					const title = createInquiryResponse.error.message;
					throw new VerificationApiError(title, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
				}

				const data = {
					request_id: createInquiryResponse.details.requestId,
					inquiry_status: createInquiryResponse.inquiry.attributes.status,
					inquiry_id: createInquiryResponse.inquiry.id,
					reference_id: createInquiryResponse.inquiry.attributes.reference_id
				};
				const updateDataQuery = `UPDATE data_integrations SET data = $1, status = $2 WHERE business_id = $3 AND integration_id = $4`;
				await sqlQuery({
					sql: updateDataQuery,
					values: [data, INTEGRATION_STATUS.INITIATED, businessID, INTEGRATION_ID.PERSONA]
				});

				return { data: { ...data, is_persona_linked: false }, message: "Persona verification process has been started." };
			}

			// userID is being used as reference id to create inquiry
			const response = await this.persona.createInquiry(userID);

			if (response.success !== true) {
				const title = response.error.message;
				throw new VerificationApiError(title, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const data = {
				request_id: response.details.requestId,
				inquiry_status: response.inquiry.attributes.status,
				inquiry_id: response.inquiry.id,
				reference_id: response.inquiry.attributes.reference_id
			};
			const insertDataQuery = `INSERT INTO data_integrations (integration_id, data, status, business_id, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6)`;
			await sqlQuery({ sql: insertDataQuery, values: [INTEGRATION_ID.PERSONA, data, INTEGRATION_STATUS.INITIATED, businessID, userID, userID] });

			return { data: { ...data, is_persona_linked: false }, message: "Persona verification process has been started." };
		} catch (error) {
			throw error;
		}
	}

	async completeInquiry({ businessID }) {
		try {
			const getVerificationStatusQuery = "SELECT * FROM data_integrations WHERE business_id = $1 and integration_id = $2";
			const getVerificationStatusResult = await sqlQuery({ sql: getVerificationStatusQuery, values: [businessID, INTEGRATION_ID.PERSONA] });

			let data = getVerificationStatusResult.rows[0];

			data = { ...data, inquiry_status: "completed" };

			const updateDataQuery = `UPDATE data_integrations SET data = $1, status = $2 WHERE business_id = $3 AND integration_id = $4 `;
			await sqlQuery({
				sql: updateDataQuery,
				values: [data, INTEGRATION_STATUS.COMPLETED, businessID, INTEGRATION_ID.PERSONA]
			});
		} catch (error) {
			throw error;
		}
	}

	/**
	 *
	 * @param {object} businessID
	 */
	async getPersonaDetails({ businessID }) {
		try {
			// check if integrations with given businessID exists or not
			const getIntegrationQuery = "SELECT * FROM data_integrations WHERE business_id = $1 AND integration_id = $2";
			const getIntegrationQueryResult = await sqlQuery({ sql: getIntegrationQuery, values: [businessID, INTEGRATION_ID.PERSONA] });

			if (!getIntegrationQueryResult.rowCount) {
				// this means integration does not exists
				throw new VerificationApiError("No integrations found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const inquiryID = getIntegrationQueryResult.rows[0].data.data.inquiry_id;

			const response = await this.persona.getInquiry(inquiryID);
			const personaStatus = response.inquiry.attributes.status;

			if (personaStatus === "expired") {
				return {
					message: "Inquiry is expired"
				};
			} else if (personaStatus === "failed") {
				return {
					message: "Inquiry is failed"
				};
			} else if (personaStatus === "created" || personaStatus === "pending") {
				return {
					data: {
						inquiry_id: inquiryID,
						persona_status: personaStatus
					},
					message: "Verification pending"
				};
			}

			const verificationsInformation = response.inquiry.relationships.verifications.data;

			if (!verificationsInformation) {
				throw new VerificationApiError("Verification data not found.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const verificationIDs = {};

			verificationsInformation.forEach(item => {
				verificationIDs[item.type] = item.id;
			});

			const govData = {};
			const selfieData = {};

			const targetArrayObject = {
				"verification/government-id": govData,
				"verification/selfie": selfieData
			};

			for (const type in verificationIDs) {
				const id = verificationIDs[type];

				const verificationResponse = await this.persona.retrieveVerificationDetails(id);

				const verificationCreatedAt = new Date(verificationResponse.verification.attributes.created_at);
				const photoUrls = verificationResponse.verification.attributes.photo_urls;

				const targetObject = targetArrayObject[type];
				targetObject.verification_created_at = verificationCreatedAt;

				photoUrls.forEach(photo => {
					const { page, url } = photo;
					targetObject[page] = { url };
				});
			}

			return {
				message: "Persona details fetched successfully.",
				data: {
					inquiry_id: inquiryID,
					persona_status: personaStatus,
					government_data: govData,
					selfie_data: selfieData
				}
			};
		} catch (error) {
			throw error;
		}
	}

	async getAllVerificationIntegrations({ businessID }) {
		try {
			const getBankingDetailsQuery = `SELECT data_integrations.data as integration_data, data_integrations.status as status, data_integrations.business_id, data_integrations.id as integration_id,
				core_integrations.label as integration_label, core_integration_categories.label as category_label
				FROM data_integrations
				LEFT JOIN core_integrations ON core_integrations.id = data_integrations.integration_id
				LEFT JOIN core_integration_categories ON core_integration_categories.id = core_integrations.category_id
				WHERE core_integration_categories.id = $1 AND data_integrations.business_id = $2`;

			const getBankingDetailsQueryResult = await sqlQuery({ sql: getBankingDetailsQuery, values: [INTEGRATION_CATEGORIES.VERIFICATION, businessID] });

			if (!getBankingDetailsQueryResult.rowCount) {
				// this means integration does not exists
				throw new VerificationApiError("No integrations found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const records = getBankingDetailsQueryResult.rows.map(user => {
				const { integration_id, integration_data, status, business_id, integration_label: integrationLabel } = user;

				return {
					[integrationLabel]: {
						business_id,
						integration_id,
						status,
						integration_data
					}
				};
			});

			return {
				records
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {{ business_id?: string, case_id?: string, score_trigger_id?: string }} body
	 * @param {{ doctor_licenses?: boolean, reviews?: boolean }} query
	 */
	async fetchDoctorsDetails(body, query) {
		try {
			const businessId = body.business_id;
			const caseId = body.case_id;
			const scoreTriggerId = body.score_trigger_id;

			const doctorLicenses = query.doctor_licenses;
			const reviews = query.reviews;

			let doctorsArray = [];
			let dbQuery = null;

			if (caseId) {
				dbQuery = db({ dc: "public.data_cases" })
					.join("integrations.data_business_integrations_tasks as dbit", "dc.score_trigger_id", "dbit.business_score_trigger_id")
					.join("integration_data.request_response as rr", "dbit.id", "rr.request_id")
					.where("dc.id", caseId);
			} else if (scoreTriggerId) {
				dbQuery = db({ dbit: "integrations.data_business_integrations_tasks" })
					.join("integration_data.request_response as rr", "dbit.id", "rr.request_id")
					.where("dbit.business_score_trigger_id", scoreTriggerId);
			} else if (businessId) {
				dbQuery = db({ rr: "integration_data.request_response" }).where("rr.business_id", businessId);
			}

			if (dbQuery) {
				dbQuery.select(db.raw("rr.response->'doctors' as doctors")).where("rr.platform_id", INTEGRATION_ID.VERDATA).orderBy("rr.requested_at", "desc").limit(1);

				const result = await dbQuery.first();
				if (result && result.doctors) {
					try {
						doctorsArray = typeof result.doctors === "string" ? JSON.parse(result.doctors || "[]") : result.doctors;
					} catch (parseError) {
						logger.error(parseError, "Error parsing doctors JSON data:");
						doctorsArray = [];
					}
				}
			}

			const finalDoctorsArray = doctorsArray.map(doctor => {
				const result = {
					name: doctor.name || null,
					npi_id: doctor.npi_id || null,
					specialty: doctor.specialty || null,
					years_of_experience: doctor.years_of_experience || null
				};
				if (doctorLicenses) result.doctor_licenses = doctor.doctor_licenses || [];
				if (reviews) result.reviews = doctor.reviews || [];
				return result;
			});

			return finalDoctorsArray;
		} catch (error) {
			throw error;
		}
	}
}

export const verification = new VerificationService();
