// @ts-nocheck

import { randomUUID } from "crypto";
import { customerIntegrationSettings } from "../customer-integration-settings";
import { customerIntegrationSettingsRepository } from "../repository";
import { CustomerIntegrationSettingsApiError } from "../error";
import { INTEGRATION_ENABLE_STATUS } from "#constants";
import { getOnboardingCustomerSettings } from "#helpers/index";
import { getFlagValue } from "#helpers";

jest.mock("#helpers/index");
jest.mock("#utils/index");
jest.mock("#configs/index");
jest.mock("kafkajs");
jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
		//   ... other mocked configuration properties
	}
}));

jest.mock("#helpers/LaunchDarkly", () => ({
	getFlagValue: jest.fn()
}));

describe("CustomerIntegrationSettings", () => {
	const customerID = randomUUID();
	describe("createOrUpdate", () => {
		it("when customerSettings exist createOrUpdate should update user", async () => {
			jest.spyOn(customerIntegrationSettingsRepository, "findById").mockResolvedValueOnce({});
			jest.spyOn(customerIntegrationSettingsRepository, "findById").mockResolvedValueOnce({
				customerID,
				settings: {
					isBJLEnabled: true
				}
			});

			const spyUpdate = jest.spyOn(customerIntegrationSettingsRepository, "update").mockResolvedValueOnce({});

			const response = await customerIntegrationSettings.createOrUpdate(customerID, { isBJLEnabled: true });
			expect("Customer Integration Settings was successfully updated.").toStrictEqual(response.message);
			expect(spyUpdate).toHaveBeenCalledTimes(1);
		});
		it("when customerSettings exist createOrUpdate should create user", async () => {
			jest.spyOn(customerIntegrationSettingsRepository, "findById").mockResolvedValueOnce(null);
			jest.spyOn(customerIntegrationSettingsRepository, "findById").mockResolvedValueOnce({
				customerID,
				settings: {
					isBJLEnabled: true
				}
			});

			const spyCreate = jest.spyOn(customerIntegrationSettingsRepository, "create").mockResolvedValueOnce({});

			const response = await customerIntegrationSettings.createOrUpdate(customerID, { isBJLEnabled: true });
			expect("Customer Integration Settings was successfully created.").toStrictEqual(response.message);
			expect(spyCreate).toHaveBeenCalledTimes(1);
		});

		it("should automatically set gauthenticate to INACTIVE when gverify is INACTIVE and gauthenticate is being set to ACTIVE", async () => {
			jest.spyOn(customerIntegrationSettingsRepository, "findById").mockResolvedValueOnce({
				customerID,
				settings: {
					gverify: { status: INTEGRATION_ENABLE_STATUS.INACTIVE }
				}
			});
			jest.spyOn(customerIntegrationSettingsRepository, "findById").mockResolvedValueOnce({
				customerID,
				settings: {}
			});

			const spyUpdate = jest.spyOn(customerIntegrationSettingsRepository, "update").mockResolvedValueOnce({});

			const settings = {
				gauthenticate: { status: INTEGRATION_ENABLE_STATUS.ACTIVE }
			};

			const response = await customerIntegrationSettings.createOrUpdate(customerID, settings);
			expect(response.message).toBe("Customer Integration Settings was successfully updated.");
			expect(spyUpdate).toHaveBeenCalledTimes(1);

			// Verify that gauthenticate was automatically set to INACTIVE
			expect(spyUpdate).toHaveBeenCalledWith(
				customerID,
				expect.objectContaining({
					gauthenticate: expect.objectContaining({
						status: INTEGRATION_ENABLE_STATUS.INACTIVE
					})
				})
			);
		});

		it("should allow gauthenticate to be ACTIVE when gverify is ACTIVE", async () => {
			jest.spyOn(customerIntegrationSettingsRepository, "findById").mockResolvedValueOnce({
				customerID,
				settings: {}
			});
			jest.spyOn(customerIntegrationSettingsRepository, "findById").mockResolvedValueOnce({
				customerID,
				settings: {}
			});

			// Mock getOnboardingCustomerSettings to return empty array
			(getOnboardingCustomerSettings as jest.Mock).mockResolvedValueOnce([]);

			const spyUpdate = jest.spyOn(customerIntegrationSettingsRepository, "update").mockResolvedValueOnce({});

			const settings = {
				gauthenticate: { status: INTEGRATION_ENABLE_STATUS.ACTIVE },
				gverify: { status: INTEGRATION_ENABLE_STATUS.ACTIVE }
			};

			const response = await customerIntegrationSettings.createOrUpdate(customerID, settings);
			expect(response.message).toBe("Customer Integration Settings was successfully updated.");
			expect(spyUpdate).toHaveBeenCalledTimes(1);
		});

		it("should automatically set gauthenticate to INACTIVE when gverify becomes INACTIVE", async () => {
			jest.spyOn(customerIntegrationSettingsRepository, "findById").mockResolvedValueOnce({
				customerID,
				settings: {
					gauthenticate: { status: INTEGRATION_ENABLE_STATUS.ACTIVE },
					gverify: { status: INTEGRATION_ENABLE_STATUS.ACTIVE }
				}
			});
			jest.spyOn(customerIntegrationSettingsRepository, "findById").mockResolvedValueOnce({
				customerID,
				settings: {}
			});

			const spyUpdate = jest.spyOn(customerIntegrationSettingsRepository, "update").mockResolvedValueOnce({});

			const settings = {
				gverify: { status: INTEGRATION_ENABLE_STATUS.INACTIVE }
			};

			const response = await customerIntegrationSettings.createOrUpdate(customerID, settings);
			expect(response.message).toBe("Customer Integration Settings was successfully updated.");
			expect(spyUpdate).toHaveBeenCalledTimes(1);

			// Verify that gauthenticate was automatically set to INACTIVE
			expect(spyUpdate).toHaveBeenCalledWith(
				customerID,
				expect.objectContaining({
					gauthenticate: expect.objectContaining({
						status: INTEGRATION_ENABLE_STATUS.INACTIVE
					}),
					gverify: expect.objectContaining({
						status: INTEGRATION_ENABLE_STATUS.INACTIVE
					})
				})
			);
		});
	});
});
