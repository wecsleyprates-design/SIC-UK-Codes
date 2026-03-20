import { ERROR_CODES, FEATURE_FLAGS, kafkaEvents, kafkaTopics, OWNER_FIELDS_TO_ENCRYPT } from "#constants/index";
import { getFlagValue, logger, producer, sqlQuery, sqlTransaction } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { StatusCodes } from "http-status-codes";
import { KafkaHandlerError } from "./error";
import { schema } from "./schema";
import { I360Report, ICompanyOverviewResponse } from "./types";
import { relatedBusinesses } from "../../../../api/v1/modules/businesses/relatedBusinesses";
import { encryptFields } from "#utils/index";

class ReportEventsHandler {
	async handleEvent(message: any) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.FETCH_REPORT_DATA:
					validateMessage(schema.fetchReportData, payload);
					await this.fetchReportData(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	async fetchReportData(body: I360Report) {
		try {
			const [companyOverview, kybKycData] = await Promise.all([
				this._getCompanyOverview(body).catch(e => {
					logger.error({ error: e }, "_getCompanyOverview error");
				}),
				this._getKycKyb(body).catch(e => {
					logger.error({ error: e }, "_getKycKyb error");
				})
			]);

			const data = {
				company_overview: companyOverview,
				kyc_kyb: kybKycData
			};

			// TODO: In progress functionality
			const message = {
				business_id: body.business_id,
				source: "case",
				report_id: body.report_id,
				data: data
			};

		const payload = {
			topic: kafkaTopics.REPORTS,
			messages: [{
				key: body.report_id || body.business_id, // Fallback to business ID if report ID is not provided for whatever reason
				value: {
					event: kafkaEvents.UPDATE_REPORT_DATA,
					...message
				}
			}]
		};

		await producer.send(payload);
		} catch (error) {
			throw error;
		}
	}

	async _getCompanyOverview(body: I360Report): Promise<ICompanyOverviewResponse | null> {
		try {
			const businessID = body.business_id;
			let customerID = body.customer_id || "";
			let response: ICompanyOverviewResponse | null = null;
			if (businessID) {
				const getBusinessDetailQuery = `
											SELECT
											DB.*,		
											json_build_object('rel_business_owners', RBO) as owners_percentage_json,
											json_build_object('data_owners', DOW) as owners_json
											FROM data_businesses AS DB
											LEFT JOIN rel_business_owners AS RBO ON DB.id = RBO.business_id
											LEFT JOIN data_owners AS DOW ON DOW.id = RBO.owner_id
											WHERE DB.id = $1 AND DB.is_deleted = false;
										`;

				if (!customerID) {
					const getCustomerIDsQuery = `SELECT rel_business_customer_monitoring.customer_id
					FROM rel_business_customer_monitoring
					LEFT JOIN data_businesses db ON rel_business_customer_monitoring.business_id = db.id
					WHERE rel_business_customer_monitoring.business_id = $1 AND db.is_deleted = false`;
					const resultCustomerIDs = await sqlQuery({ sql: getCustomerIDsQuery, values: [businessID] });
					if (resultCustomerIDs.rows.length) {
						customerID = resultCustomerIDs.rows[0].customer_id;
					}
				}
				const [getBusinessDetailResult] = await sqlTransaction([getBusinessDetailQuery], [[businessID]]);

				if (!getBusinessDetailResult.rowCount) {
					throw new KafkaHandlerError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
				}

				const checkSSNFlag = await getFlagValue(
					FEATURE_FLAGS.BEST_87_SSN_ENCRYPTION,
					customerID && {
						key: "customer",
						kind: "customer",
						customer_id: customerID
					}
				);

				const ownerDetails = getBusinessDetailResult.rows
					.filter(item => item.owners_json?.data_owners)
					.map(item => {
						const owner = encryptFields(item.owners_json.data_owners, OWNER_FIELDS_TO_ENCRYPT) as any;
						const ownershipPercentage =
							item.owners_percentage_json?.rel_business_owners?.ownership_percentage?.toString() ?? null;

						return {
							id: owner.id,
							first_name: owner.first_name,
							last_name: owner.last_name,
							ownership_percentage: ownershipPercentage,
							last_four_of_ssn: owner.last_four_of_ssn ? (checkSSNFlag ? owner.last_four_of_ssn : "XXXX") : null
						};
					});

				response = {
					ownership: ownerDetails
				};
			}
			return response;
		} catch (error) {
			throw error;
		}
	}
	async _getKycKyb(body: I360Report) {
		const businessID = body.business_id;
		const data = await relatedBusinesses.getRelatedBusinesses(
			{ businessID, customerID: body.customer_id },
			{
				pagination: false
			}
		);
		const results = data.records;
		return { related_businesses: results };
	}
}

export const reportEventsHandler = new ReportEventsHandler();
