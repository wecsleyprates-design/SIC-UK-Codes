// @ts-nocheck

import { ERROR_CODES } from "#constants";
import { getCustomerWithPermissions, sqlQuery } from "#helpers/index";
import { StatusCodes } from "http-status-codes";
import { RiskAlertApiError } from "../error";
import { riskAlert } from "../risk-alerts";

require("kafkajs");

jest.mock("jsonwebtoken");
jest.mock("#helpers/index");
jest.mock("#lib/index");
jest.mock("#utils/index");
jest.mock("uuid");
jest.mock("#configs/index");
jest.mock("kafkajs");
jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
		//   ... other mocked configuration properties
	},
	tokenConfig: {
		TOKEN_LIFE: "3h",
		REFRESH_TOKEN_LIFE: "30d",
		REFRESH_TOKEN_LIFE_SECONDS: 2592000, // 30*24*60*60
		FORGOT_PASSWORD_TOKEN_LIFE_SECONDS: 10 * 60, // 10 minutes
		VERIFY_EMAIL_TOKEN_LIFE_SECONDS: 10 * 60 // 10 minutes
	}
}));

describe("risk-alerts", () => {
	beforeEach(() => {
		jest.resetAllMocks();
		getCustomerWithPermissions.mockImplementation(async () => {
			return Promise.resolve({
				"risk_monitoring_module:write": ["customerID"]
			});
		});
	});

	describe("updateBusinessesCustomerMonitoring", () => {
		const params = {
			customerID: "customerID",
			businessID: "businessID"
		};

		const body = {
			risk_monitoring: true
		};

		const userInfo = {
			user_id: "userID"
		};

		it("should update business customer monitoring", async () => {
			sqlQuery.mockResolvedValueOnce({
				rows: [
					{
						is_monitoring_enabled: false
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({});

			await riskAlert.updateBusinessesCustomerMonitoring(params, body, userInfo);
		});

		it("should throw an error if the customer is not linked to business", async () => {
			sqlQuery.mockResolvedValueOnce({
				rows: []
			});

			try {
				await riskAlert.updateBusinessesCustomerMonitoring(params, body, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(RiskAlertApiError);
				expect(error.status).toEqual(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toEqual(ERROR_CODES.INVALID);
			}
		});

		it("should throw an error if current status and status to update both are same", async () => {
			sqlQuery.mockResolvedValueOnce({
				rows: [
					{
						is_monitoring_enabled: true
					}
				]
			});

			try {
				await riskAlert.updateBusinessesCustomerMonitoring(params, body, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(RiskAlertApiError);
				expect(error.status).toEqual(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toEqual(ERROR_CODES.INVALID);
			}
		});
	});
});
