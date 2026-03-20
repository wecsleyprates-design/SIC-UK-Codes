import { fetchRiskAlerts, fetchRiskAlertScoreIDs, getCustomerWithPermissions, sqlQuery, sqlTransaction } from "#helpers/index";
import { SqlQueryResult, UserInfo } from "#types/index";
import { StatusCodes } from "http-status-codes";
import { RiskAlertApiError } from "./error";
import { BusinessesCustomerMonitoringBody, BusinessesCustomerMonitoringParams, CustomerBusinessesMonitoring, GetScoreTriggerIDBody, ICaseBody, IEnrichedCaseBody } from "./types";
import { CASE_STATUS, ERROR_CODES, WEBHOOK_EVENTS } from "#constants/index";
import { sendEventToGatherWebhookData } from "#common/index";

class RiskAlert {
	/**
	 * This function is responsible for updating(enable/disable) the customer business monitoring status
	 * @param params {businessID, customerID}
	 * @param body {risk_monitoring: boolean}
	 * @param userInfo
	 */
	async updateBusinessesCustomerMonitoring(params: BusinessesCustomerMonitoringParams, body: BusinessesCustomerMonitoringBody, userInfo: UserInfo) {
		try {
			// call to AUTH svc for permissions check
			const result = await getCustomerWithPermissions({ permissions: ["risk_monitoring_module:write"] });
			const monitoringAllowedCustomers = Object.hasOwn(result, "risk_monitoring_module:write") ? result["risk_monitoring_module:write"] : [];
			const isMonitoringAllowed = monitoringAllowedCustomers?.includes(params.customerID);

			if (!isMonitoringAllowed) {
				throw new RiskAlertApiError("Risk monitoring is disabled. Contact Worth Admin", StatusCodes.FORBIDDEN, ERROR_CODES.INVALID);
			}

			// check for customer business
			const customerBusinessQuery = `SELECT * FROM rel_business_customer_monitoring WHERE customer_id = $1 AND business_id = $2`;
			const customerBusinessResult: SqlQueryResult<CustomerBusinessesMonitoring> = await sqlQuery({ sql: customerBusinessQuery, values: [params.customerID, params.businessID] });

			if (!customerBusinessResult.rows.length) {
				throw new RiskAlertApiError("Selected business is not associated with the current customer.", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			if (customerBusinessResult.rows[0].is_monitoring_enabled === body.risk_monitoring) {
				throw new RiskAlertApiError("Risk monitoring status is already updated", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const updateQuery = `UPDATE rel_business_customer_monitoring 
                SET is_monitoring_enabled = $1, created_by = $2
                WHERE customer_id = $3 AND business_id = $4`;
			await sqlQuery({ sql: updateQuery, values: [body.risk_monitoring, userInfo.user_id, params.customerID, params.businessID] });

			// TODO: logging into db if updates made is pending

			await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: params.businessID });
		} catch (error) {
			throw error;
		}
	}

	async getRiskAlertsByBusiness(params: { customerID: string; businessID: string }, query: any) {
		try {
			// TODO: check if business is associated with the customer
			// get all risk alert ids for the business which are monitored by the customer
			const getRiskAlertIDsQuery = `SELECT risk_alert_id FROM rel_risk_cases
			LEFT JOIN data_cases ON data_cases.id = rel_risk_cases.case_id
			WHERE data_cases.customer_id = $1 AND data_cases.business_id = $2 AND data_cases.status != $3
			ORDER BY data_cases.created_at DESC`;

			const riskAlertIDsResult = await sqlQuery({ sql: getRiskAlertIDsQuery, values: [params.customerID, params.businessID, CASE_STATUS.DISMISSED] });

			// if no risk alerts found
			if (!riskAlertIDsResult.rows.length) {
				return {
					records: [],
					total_items: 0,
					total_pages: 0
				};
			}

			// extract all risk alert ids
			const riskAlertIDs = riskAlertIDsResult.rows.map((row: any) => row.risk_alert_id);

			// internal api call to integration-svc to fetch the risk alerts with ids
			const riskAlerts = await fetchRiskAlerts({
				...query,
				filter: {
					...query.filter,
					...(riskAlertIDs.length && { "data_risk_alerts.id": riskAlertIDs })
				}
			});

			return riskAlerts;
		} catch (error) {
			throw error;
		}
	}

	// TODO: remove after executing on PROD
	async triggerDataFill() {
		try {
			// call to integration-svc to fetch all the risk-id and score-trigger-ids
			const data = await fetchRiskAlertScoreIDs();

			const queries: string[] = [];
			const values: any[] = [];
			const updateQuery = `UPDATE rel_risk_cases SET score_trigger_id = $1 WHERE risk_alert_id = $2`;
			const keys = Object.keys(data);

			for (const key of keys) {
				queries.push(updateQuery);
				values.push([data[key], key]);
			}

			await sqlTransaction(queries, values);
		} catch (error) {
			throw error;
		}
	}

	async getScoreTriggerID(body: GetScoreTriggerIDBody) {
		try {
			const query = `SELECT score_trigger_id FROM rel_risk_cases WHERE case_id = $1`;
			const result = await sqlQuery({ sql: query, values: [body.case_id] });

			return result.rows;
		} catch (error) {
			throw error;
		}
	}

	async _enrichRiskCases(body: ICaseBody[]): Promise<IEnrichedCaseBody[] | ICaseBody[]> {
		try {
			const caseIDs = body.map(caseItem => `'${caseItem.id}'`).join(",");

			const riskCasesQuery = `SELECT * FROM rel_risk_cases WHERE case_id IN (${caseIDs})`;
			const riskCasesResult = await sqlQuery({ sql: riskCasesQuery });

			// if no risk cases found return the body as it is
			if (!riskCasesResult.rows.length) {
				return body;
			}

			// extract all risk alert ids
			const mappedRiskAlertCases = riskCasesResult.rows.reduce((acc: any, row: any) => {
				acc[row.risk_alert_id] = row.case_id;
				return acc;
			}, {});

			// get risk alert data
			const riskAlerts = await fetchRiskAlerts({ filter: { "data_risk_alerts.id": Object.keys(mappedRiskAlertCases) } });
			const riskAlertsMap = riskAlerts.records.reduce((acc: any, riskAlert: any) => {
				const caseID = mappedRiskAlertCases[riskAlert.id];
				if (!Object.hasOwn(acc, caseID)) {
					acc[caseID] = [];
				}
				acc[caseID].push(riskAlert);
				return acc;
			}, {});

			// map the risk cases with the body
			const enrichedCases = body.map((caseItem: IEnrichedCaseBody) => {
				caseItem.risk_alerts = riskAlertsMap[caseItem.id] || [];
				return caseItem;
			});

			return enrichedCases;
		} catch (error) {
			throw error;
		}
	}

	async getRiskAlertCases() {
		try {
			const riskCasesQuery = `SELECT dc.id, dc.business_id, dc.created_at, rrc.risk_alert_id, rrc.score_trigger_id FROM data_cases dc 
			INNER JOIN rel_risk_cases rrc ON rrc.case_id = dc.id
			LEFT JOIN data_businesses db ON db.id = data_cases.business_id
			WHERE db.is_deleted = false`;
			const riskCasesResult = await sqlQuery({ sql: riskCasesQuery });

			return riskCasesResult.rows;
		} catch (error) {
			throw error;
		}
	}
	//this function call only singal time for remove duplicate records only
	async deleteDuplicateRiskCases(riskIds) {
		try {
			let deleteActionItems;
			let riskId = riskIds.join(",");
			deleteActionItems = `DELETE FROM public.rel_risk_cases WHERE risk_alert_id IN(${riskId})`;
			let deleteQueryRes = await sqlQuery({ sql: deleteActionItems });
			return { Deletedrecords: deleteQueryRes.rowCount };
		} catch (error) {
			throw error;
		}
	}
}

export const riskAlert = new RiskAlert();
