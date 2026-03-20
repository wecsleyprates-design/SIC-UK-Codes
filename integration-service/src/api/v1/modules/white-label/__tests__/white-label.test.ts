// @ts-nocheck
import { whiteLabelService } from "../whiteLabelService";
import { WhiteLabelError } from "../error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { getCustomerData, sqlQuery } from "#helpers/index";

jest.mock("#helpers/index");

jest.mock("#configs/env.config", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id",
		KAFKA_GROUP_ID: "mocked_group_id",
		PLAID_IDV_TEMPLATE_ID: "1"
		//   ... other mocked configuration properties
	}
}));

describe("White label", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	const params = {
		customerId: "sampleCustomerId"
	};

	const body = {
		primaryCompanyLogo: "https://example.com/images/logo1.png",
		secondaryCompanyLogo: "https://example.com/images/logo2.png",
		welcomeBackgroudImage: "https://example.com/images/welcome.png",
		primaryBackgroundColor: "#FFFFFF",
		secondaryBackgroundColor: "#F0F0F0",
		buttonColor: "#FF5733",
		buttonTextColor: "#000000",
		progressBarColor: "#00FF00",
		termsAndConditions: "https://example.com/terms-and-conditions",
		companySupportEmailAddress: "support@example.com",
		customURL: "https://custom.example.com",
		thankYouMessageTitle: "Thank You!",
		thankYouMessageBodyText: "Thank you for your purchase. We appreciate your business.",
		domain: "x.joinworth.com"
	};

	const response = {
		customer_id: params.customerId,
		domain: body.domain,
		settings: body
	};

	const customer = {
		first_name: "EE LLC",
		email: "test@ee.com"
	};

	describe("createCustomerSettings", () => {
		it("should throw error if customer already exists ", async () => {
			whiteLabelService.getCustomerSettingsById = jest.fn().mockResolvedValueOnce({});
			getCustomerData.mockResolvedValueOnce(customer);
			await expect(whiteLabelService.createCustomerSettings({ customerId: params.customerId }, body)).rejects.toThrow(
				new WhiteLabelError(`Settings for this customer already exist.`, StatusCodes.BAD_REQUEST, ERROR_CODES.DUPLICATE)
			);
		});

		it("should throw error if domain already exists ", async () => {
			whiteLabelService.getCustomerSettingsById = jest.fn().mockResolvedValueOnce(undefined);
			whiteLabelService.getCustomerSettingsByDomain = jest.fn().mockResolvedValueOnce({});
			getCustomerData.mockResolvedValueOnce(customer);
			await expect(whiteLabelService.createCustomerSettings({ customerId: params.customerId }, body)).rejects.toThrow(
				new WhiteLabelError(`The specified domain already exists.`, StatusCodes.BAD_REQUEST, ERROR_CODES.DUPLICATE)
			);
		});

		it("should create custom settings", async () => {
			whiteLabelService.getCustomerSettingsById = jest.fn().mockResolvedValueOnce(undefined);
			whiteLabelService.getCustomerSettingsByDomain = jest.fn().mockResolvedValueOnce(undefined);
			getCustomerData.mockResolvedValueOnce(customer);
			sqlQuery.mockResolvedValueOnce({ rows: [response] });
			const data = await whiteLabelService.createCustomerSettings({ customerId: params.customerId }, body);
			expect(data).toStrictEqual(response);
		});
	});

	describe("updatePartialCustomerSettings", () => {
		it("should throw error if customer not found", async () => {
			whiteLabelService.getCustomerSettingsById = jest.fn().mockResolvedValueOnce(undefined);
			getCustomerData.mockResolvedValueOnce(customer);
			await expect(whiteLabelService.updatePartialCustomerSettings({ customerId: params.customerId }, body)).rejects.toThrow(
				new WhiteLabelError(`Settings for this customer not found. domain: ${body.domain}, customerId: ${params.customerId}`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND)
			);
		});

		it("should update partial customer", async () => {
			whiteLabelService.getCustomerSettingsById = jest.fn().mockResolvedValueOnce(body);
			whiteLabelService.updatePartialCustomerSettingsAction = jest.fn().mockResolvedValueOnce({ rows: [response] });
			getCustomerData.mockResolvedValueOnce(customer);
			const data = await whiteLabelService.updatePartialCustomerSettings({ customerId: params.customerId }, body);
			expect(data).toStrictEqual(response);
		});
	});

	describe("getCustomerSettingsDomain", () => {
		it("should throw error if customer not found", async () => {
			whiteLabelService.getCustomerSettingsByDomain = jest.fn().mockResolvedValueOnce(undefined);
			await expect(whiteLabelService.getCustomerSettingsDomain("x.joinworth.com")).rejects.toThrow(new WhiteLabelError(`Customer Settings not found`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND));
		});
	});
});
