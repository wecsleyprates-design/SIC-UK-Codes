// @ts-nocheck

import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import { getBusinessApplicants, sqlQuery, sqlTransaction } from "#helpers/index";
import { getBankingDetails } from "../getBankingDetails";
import { core } from "../core";

jest.mock("../getBankingDetails");
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
describe("Core", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("internalGetConnectedIntegrations", () => {
		const params = {
			businessID: "sampleBusinessID"
		};

		const response = {
			data: {
				category: {
					is_connected: true,
					is_connecting: false,
					category_label: "category_label",
					connections: [
						{
							id: "connection_id",
							is_connected: false,
							is_connecting: false,

							connection_status: "FAILED",
							platform_id: "platform_id",
							platform: "code",
							configuration: "configuration",
							platform_label: "platform_label"
						},
						{
							id: "connection_id",
							is_connected: true,
							is_connecting: false,

							connection_status: "SUCCESS",
							platform_id: "platform_id",
							platform: "code",
							configuration: "configuration",
							platform_label: "platform_label"
						}
					]
				},
				banking: {
					is_connected: true,
					is_connecting: false,

					category_label: "category_label",
					connections: [
						{
							id: "connection_id",
							is_connected: true,
							is_connecting: false,

							connection_status: "SUCCESS",
							platform_id: INTEGRATION_ID.PLAID,
							platform: "code",
							configuration: "configuration",
							platform_label: "platform_label",
							institutions: [
								{
									name: "bank_name"
								}
							],
							task: {
								id: "task_id",
								task_status: "task_status"
							}
						}
					]
				},
				owner_verification: {
					is_connected: true,
					platform: "plaid_idv",
					owners: [
						{
							owner_id: "applicantID",
							business_id: "businessID",
							status: "SUCCESS"
						}
					],
					connections: [
						{
							id: "connectionID",
							is_connected: true,
							connection_status: "SUCCESS",
							platform_id: "platformID",
							platform: "code",
							configuration: "configuration",
							platform_label: "platform_label"
						}
					]
				},
				scoring_required_integrations_connected: true
			},
			message: "Integrations data fetch successfully."
		};

		it("should return the connections for a business", async () => {
			getBankingDetails.mockResolvedValueOnce({
				plaidTask: { task_status: "SUCCESS", id: "abc" },
				institutions: [{ name: "bank_name" }],
				tasks: [
					{
						id: "task_id",
						task_status: "task_status"
					}
				]
			});

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							category: "category",
							connection_status: "FAILED",
							category_label: "category_label",
							connection_id: "connection_id",
							platform_id: "platform_id",
							code: "code",
							configuration: "configuration",
							platform_label: "platform_label"
						},
						{
							category: "category",
							connection_status: "SUCCESS",
							category_label: "category_label",
							connection_id: "connection_id",
							platform_id: "platform_id",
							code: "code",
							configuration: "configuration",
							platform_label: "platform_label"
						},
						{
							category: "banking",
							connection_status: "SUCCESS",
							category_label: "category_label",
							connection_id: "connection_id",
							platform_id: INTEGRATION_ID.PLAID,
							code: "code",
							configuration: "configuration",
							platform_label: "platform_label"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							applicant_id: "applicantID",
							business_id: "businessID",
							status: 1,
							connection_status: CONNECTION_STATUS.SUCCESS,
							connection_id: "connectionID",
							platform_id: "platformID",
							code: "code",
							configuration: "configuration",
							platform_label: "platform_label"
						}
					]
				},
				{
					rowCount: 0,
					rows: []
				}
				// {
				// 	rowCount: 1,
				// 	rows: [
				// 		{
				// 			applicant_id: "applicantID",
				// 			business_id: "businessID",
				// 			status: 1,
				// 			connection_status: CONNECTION_STATUS.SUCCESS,
				// 			connection_id: "connectionID",
				// 			platform_id: "platformID",
				// 			code: "code",
				// 			configuration: "configuration",
				// 			platform_label: "platform_label",
				// 			institutions: [
				// 				{
				// 					name: "bank_name"
				// 				}
				// 			],
				// 			task: {
				// 				id: "task_id",
				// 				task_status: "task_status"
				// 			}
				// 		}
				// 	]
				// }
			]);

			const result = await core.internalGetConnectedIntegrations(params);
			expect(result).toEqual(response);
		});

		it("should return empty response if there are no integration connectiosn found", async () => {
			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 0,
					rows: []
				},
				{}
			]);

			const result = await core.internalGetConnectedIntegrations(params);
			expect(result).toEqual({
				data: { scoring_required_integrations_connected: false },
				message: "No integration data found."
			});
		});

		it("should throw an error if there is an issue with db connection", async () => {
			sqlTransaction.mockRejectedValueOnce(new Error("Error occurred while executing query"));

			try {
				await core.internalGetConnectedIntegrations(params);
			} catch (error) {
				expect(error).toEqual(Error("Error occurred while executing query"));
			}
		});
	});

	describe("getConnectedIntegrations", () => {
		const params = {
			businessID: "sampleBusinessID"
		};

		const userInfo = {
			user_id: 1
		};
		const authorization = "authorization";

		const response = {
			integrations: [
				{
					is_connected: false,
					is_connecting: false,
					category_label: "category_label",
					connections: [
						{
							id: "connection_id",
							is_connected: false,
							is_connecting: false,
							connection_status: "FAILED",
							platform_id: "platform_id",
							platform: "code",
							platform_label: "platform_label"
						}
					]
				},
				{
					is_connected: true,
					is_connecting: false,
					category_label: "banking",
					connections: [
						{
							id: "connection_id",
							is_connected: true,
							is_connecting: false,

							connection_status: "SUCCESS",
							platform_id: INTEGRATION_ID.PLAID,
							platform: "code",
							platform_label: "platform_label",
							last_synced_at: "updated_at",
							needs_attention: true,
							task: {
								id: "task_id",
								task_status: "task_status"
							},
							institutions: [
								{
									institution_name: "institution_name_1",
									accounts: [
										{
											name: "bank_name",
											official_name: "official_name"
										},
										{
											name: "bank_name",
											official_name: "official_name"
										}
									]
								},
								{
									institution_name: "institution_name_2",
									accounts: [
										{
											name: "bank_name",
											official_name: "official_name"
										}
									]
								}
							],
							task_status: undefined
						}
					]
				},
				{
					is_connected: true,
					is_connecting: false,

					category_label: "accounting",
					connections: [
						{
							id: "connection_id",
							is_connected: true,
							is_connecting: false,

							connection_status: "SUCCESS",
							platform_id: "platform_id",
							platform: "code",
							last_synced_at: "updated_at",
							needs_attention: true,
							platform_label: "platform_label",
							task_status: undefined
						}
					]
				},
				{
					is_connected: true,
					is_connecting: false,

					category_label: "taxation",
					connections: [
						{
							id: "connection_id",
							is_connected: true,
							is_connecting: false,

							irs_status: "COMPLETED",
							is_consent_given: true,
							connection_status: "SUCCESS",
							platform_id: "platform_id",
							platform: "code",
							last_synced_at: "updated_at",
							needs_attention: true,
							platform_label: "platform_label",
							task_status: undefined
						}
					],
					manual_tax_filing: {
						data: undefined,
						upload_details: undefined
					},
					electronic_signature: {
						timestamp: "2025-02-07T07:43:05.622Z"
					}
				}
				// {
				// 	is_connected: true,
				// 	platform: "plaid_idv",
				// 	owners: [
				// 		{
				// 			owner_id: "applicantID",
				// 			business_id: "businessID",
				// 			status: "SUCCESS"
				// 		}
				// 	],
				// 	connections: [
				// 		{
				// 			id: "connectionID",
				// 			is_connected: true,
				// 			connection_status: "SUCCESS",
				// 			platform_id: "platformID",
				// 			platform: "code",
				// 			platform_label: "platform_label"
				// 		}
				// 	]
				// }
			],
			scoring_required_integrations_connected: true
		};

		it("should return the connections for a business", async () => {
			getBankingDetails.mockResolvedValueOnce({
				plaidTask: { task_status: "SUCCESS", id: "abc" },
				institutions: [{ name: "bank_name", bank_account: "abcd" }],
				tasks: [{ id: "task_id", task_status: "task_status" }]
			});

			getBusinessApplicants.mockResolvedValueOnce([{ id: 1 }]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							category: "category",
							connection_status: "FAILED",
							category_label: "category_label",
							connection_id: "connection_id",
							platform_id: "platform_id",
							code: "code",
							configuration: "configuration",
							platform_label: "platform_label"
						},
						{
							category: "banking",
							connection_status: "SUCCESS",
							category_label: "banking",
							connection_id: "connection_id",
							platform_id: INTEGRATION_ID.PLAID,
							code: "code",
							configuration: "configuration",
							platform_label: "platform_label",
							institution: [
								{
									name: "bank_name"
								}
							],
							task: {
								id: "task_id",
								task_status: "task_status"
							}
						},
						{
							category: "accounting",
							connection_status: "SUCCESS",
							category_label: "accounting",
							connection_id: "connection_id",
							platform_id: "platform_id",
							code: "code",
							configuration: "configuration",
							platform_label: "platform_label"
						},
						{
							category: "taxation",
							connection_status: "SUCCESS",
							category_label: "taxation",
							connection_id: "connection_id",
							platform_id: "platform_id",
							code: "code",
							configuration: {
								timestamp: "2025-02-07T07:43:05.622Z"
							},
							platform_label: "platform_label"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							applicant_id: "applicantID",
							business_id: "businessID",
							status: 1,
							connection_status: CONNECTION_STATUS.SUCCESS,
							connection_id: "connectionID",
							platform_id: "platformID",
							code: "code",
							configuration: "configuration",
							platform_label: "platform_label"
						}
					]
				},
				{
					rowCount: 1,
					rows: {
						task: [
							{
								institutions: [
									{
										name: "bank_name"
									}
								]
							}
						]
					}
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						connection_id: "connection_id",
						updated_at: "updated_at"
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						bank_name: "bank_name",
						institution_name: "institution_name_1",
						official_name: "official_name",
						integration_task_id: "integration_task_id",
						connection_id: "connection_id"
					},
					{
						bank_name: "bank_name",
						institution_name: "institution_name_2",
						official_name: "official_name",
						integration_task_id: "integration_task_id",
						connection_id: "connection_id"
					},
					{
						bank_name: "bank_name",
						institution_name: "institution_name_2",
						official_name: "official_name",
						integration_task_id: "integration_task_id_2",
						connection_id: "connection_id"
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						task: {
							id: "task_id",
							task_status: "task_status"
						}
					}
				]
			});

			const result = await core.getConnectedIntegrations(params, userInfo, { authorization });
			expect(result).toEqual(response);
		});

		it("should return empty response if there are no integration connections found", async () => {
			getBusinessApplicants.mockResolvedValueOnce([{ id: 1 }]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 0,
					rows: []
				},
				{}
			]);

			const integrations = {
				integrations: [
					{
						category_label: "Banking",
						is_connected: false,
						is_connecting: false,
						connections: []
					},
					{
						category_label: "Accounting",
						is_connected: false,
						connections: []
					},
					{
						category_label: "Taxation",
						is_connected: false,
						connections: []
					},
					{
						category_label: "Public Records",
						is_connected: false,
						connections: []
					}
				],
				scoring_required_integrations_connected: false
			};

			const result = await core.getConnectedIntegrations(params, userInfo, { authorization });
			expect(result).toEqual(integrations);
		});

		it("should throw an error if applicant calling the api doesnt belong to the business", async () => {
			getBusinessApplicants.mockResolvedValueOnce([{ id: 2 }]);

			try {
				await core.getConnectedIntegrations(params, userInfo, { authorization });
			} catch (error) {
				expect(error.message).toEqual("Applicant is not related to business");
			}
		});
	});
});
