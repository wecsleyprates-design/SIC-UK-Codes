import { banking } from "../banking";
import { CONNECTION_STATUS, ERROR_CODES } from "#constants/index";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { BankingApiError } from "../error";
import { getBusinessDetails, getInvitationDetails } from "#helpers/api";
import { getFlagValue, sqlQuery, sqlTransaction } from "#helpers/index";
import { StatusCodes } from "http-status-codes";
import { Plaid } from "#lib/index";
import { v4 as uuidv4 } from "uuid";
import { IDBConnection } from "#types";
import { UUID } from "crypto";
dayjs.extend(utc);
require("kafkajs");
jest.mock("kafkajs");
jest.mock("#configs/index", () => {
	const originalModule = jest.requireActual("#configs/index");
	return {
		...originalModule,
		envConfig: {
			KAFKA_BROKERS: "mocked_brokers",
			KAFKA_SSL_ENABLED: false,
			KAFKA_CLIENT_ID: "mocked_client_id"
			//   ... other mocked configuration properties
		}
	};
});
jest.mock("#helpers/api", () => {
	const originalModule = jest.requireActual("#helpers/api");
	return {
		...originalModule,
		getBusinessDetails: jest.fn(),
		getInvitationDetails: jest.fn()
	};
});
jest.mock("#helpers/index", () => {
	const originalModule = jest.requireActual("#helpers/index");
	return {
		...originalModule,
		sqlQuery: jest.fn(),
		sqlTransaction: jest.fn(),
		getFlagValue: jest.fn(),
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		}
	};
});
jest.mock("#lib/index", () => {
	const originalModule = jest.requireActual("#lib/index");
	return {
		...originalModule,
		Plaid: {
			getPlaidConnection: jest.fn()
		}
	};
});
describe("In banking APIs or functions", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});
	describe("plaid link creation function", () => {
		it("should return plaid account has already been linked with exiting link token response.", async () => {
			const params = { invitation_id: "invitation_id" };
			const businessID: UUID = "09ccbf49-196a-493e-858c-0e3600317956";
			const authorization = "authorization";
			const connection: IDBConnection = {
				id: "66106573-40a9-4385-8d31-306fcbec4bbd",
				business_id: "09ccbf49-196a-493e-858c-0e3600317956",
				platform_id: 1,
				configuration: {
					user_token_response: {
						request_id: "5bQv8A31ju1xi7H",
						user_id: "cffde5c8c20d305f2e3c9f6e8751370d996ea608687508c91e883cbb85cb25a5",
						user_token: "user-sandbox-b9a10d03-52cb-4ec6-a26b-4b2c335b529c"
					},
					link_token_response: {
						expiration: "2025-01-07T09:45:51Z",
						link_token: "link-sandbox-52643057-9f9a-4011-813d-e7493e87a158",
						request_id: "y3XunIFXfcTS1PP",
						environment: "default"
					},
					access_token_responses: [
						{
							access_token: "access-sandbox-6b97cdfa-584f-4246-aa5c-4089edef4547",
							item_id: "XkyrkVK1ekFjeApnp7qyhKBwRdEgEgsdPowNP",
							request_id: "nODf9Stzow4hAKV",
							environment: "default",
							institution_id: "ins_56",
							institution_name: "Chase"
						},
						{
							access_token: "access-sandbox-2313290f-e406-46aa-b23d-15e087953c8c",
							item_id: "ekZVPqbGwnfb1l1wMgbvf6bmbDwbmacL7391Q",
							request_id: "QEHUxrtfOpqArE9",
							environment: "default",
							institution_id: "ins_127989",
							institution_name: "Bank of America"
						}
					],
					asset_report_response: {
						asset_report_id: "f5851890-38e2-4350-ae34-bb6eadd45232",
						asset_report_token: "assets-sandbox-59b94efa-c8b5-4900-bf02-098a3a3129c9",
						request_id: "V5rBZVcDYdW34Bk"
					}
				},
				connection_status: "SUCCESS",
				created_at: "2025-01-02T04:38:18.838Z",
				updated_at: "2025-01-02T04:38:18.838Z"
			};
			const mockResult = {
				data: {
					response: {
						expiration: "2025-01-07T09:45:51Z",
						link_token: "link-sandbox-52643057-9f9a-4011-813d-e7493e87a158",
						request_id: "y3XunIFXfcTS1PP",
						environment: "default"
					},
					is_plaid_linked: true
				},
				message: "A plaid account has already been linked."
			};
			(getInvitationDetails as jest.Mock).mockResolvedValueOnce({ customer_id: "customer_id" });
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			jest.spyOn(banking, "checkAndCreateNewPlaidInstance").mockResolvedValueOnce({ plaid: {} as Plaid, plaidEnv: "default" });
			(Plaid.getPlaidConnection as jest.Mock).mockResolvedValueOnce(connection);
			const firstMockTime = Date.parse(connection.configuration.link_token_response.expiration); // 1736243151000
			const secondMockTime = Date.parse("2025-01-02T04:00:18.838Z"); // 1735771218838
			jest
				.spyOn(global.Date.prototype, "getTime")
				.mockImplementationOnce(() => firstMockTime)
				.mockImplementationOnce(() => secondMockTime);
			const result = await banking.plaidLinkInit({ businessID }, { authorization }, params);
			expect(result).toEqual(mockResult);
		});
		it("should return plaid account has already been linked new link token response using existing user token.", async () => {
			const params = { invitation_id: "invitation_id" };
			const businessID: UUID = "09ccbf49-196a-493e-858c-0e3600317956";
			const authorization = "authorization";
			const connection: IDBConnection = {
				id: "66106573-40a9-4385-8d31-306fcbec4bbd",
				business_id: "09ccbf49-196a-493e-858c-0e3600317956",
				platform_id: 1,
				configuration: {
					user_token_response: {
						request_id: "5bQv8A31ju1xi7H",
						user_id: "cffde5c8c20d305f2e3c9f6e8751370d996ea608687508c91e883cbb85cb25a5",
						user_token: "user-sandbox-b9a10d03-52cb-4ec6-a26b-4b2c335b529c"
					}
				},
				connection_status: "INITIALIZED",
				created_at: "2025-01-02T04:38:18.838Z",
				updated_at: "2025-01-02T04:38:18.838Z"
			};
			const getBusinessDetailsMock = {
				status: "success",
				message: "Business fetched successfully",
				data: {
					id: "09ccbf49-196a-493e-858c-0e3600317956",
					name: "Barrows - Beatty",
					tin: "XXXXX8477",
					address_line_1: "29692 S Oak Street",
					address_line_2: "Suite 633",
					address_city: "New Salma",
					address_state: "Ohio",
					address_postal_code: "60129",
					address_country: "USA",
					created_at: "2025-01-02T04:33:58.424Z",
					created_by: "077c3fc4-fccd-4a89-bca1-9df89fa15735",
					updated_at: "2025-01-02T04:38:30.471Z",
					updated_by: "077c3fc4-fccd-4a89-bca1-9df89fa15735",
					mobile: "+12348982851",
					official_website: "https://shocked-bridge.com/",
					public_website: null,
					social_account: null,
					status: "VERIFIED",
					industry: {
						id: 9,
						name: "Information",
						code: "information",
						sector_code: "51",
						created_at: "2024-04-24T17:56:46.034418",
						updated_at: "2024-04-24T17:56:46.034418"
					},
					mcc_id: null,
					naics_id: null,
					naics_code: null,
					naics_title: null,
					mcc_code: null,
					mcc_title: null,
					is_monitoring_enabled: null,
					subscription: {
						status: null,
						created_at: null,
						updated_at: null
					},
					owners: [
						{
							id: "9d31da8f-fadc-4792-9ab2-2a137a6df647",
							title: {
								id: 2,
								title: "Limited Partner"
							},
							first_name: "Fabiola",
							last_name: "Reilly",
							ssn: "873960028",
							email: "deondre36@hotmail.com",
							mobile: "+12346003640",
							date_of_birth: "2003-02-07",
							address_apartment: "Suite 185",
							address_line_1: "3378 Keely Square",
							address_line_2: null,
							address_city: "West Melany",
							address_state: "Montana",
							address_postal_code: "62677",
							address_country: "USA",
							created_at: "2025-01-02T11:11:28.098489",
							created_by: "077c3fc4-fccd-4a89-bca1-9df89fa15735",
							updated_at: "2025-01-02T11:11:28.098489",
							updated_by: "077c3fc4-fccd-4a89-bca1-9df89fa15735",
							ownership_percentage: 25,
							owner_type: "CONTROL"
						}
					],
					business_names: [
						{
							name: "Daugherty - Dooley",
							is_primary: false
						},
						{
							name: "Barrows - Beatty",
							is_primary: true
						}
					],
					business_addresses: [
						{
							line_1: "29692 S Oak Street",
							apartment: "Suite 633",
							city: "New Salma",
							state: "Ohio",
							country: "USA",
							postal_code: "60129",
							mobile: "+12348982851",
							is_primary: true
						}
					]
				}
			};
			const mockLinkTokenResponse = {
				expiration: "2025-01-07T09:45:51Z",
				link_token: "link-sandbox-52643057-9f9a-4011-813d-e7493e87a158",
				request_id: "y3XunIFXfcTS1PP",
				environment: "default"
			};
			const connectionHistory = {
				connection_id: connection.id,
				log: JSON.stringify(connection?.configuration),
				connection_status: CONNECTION_STATUS.INITIALIZED
			};
			const updateConnectionQuery = `UPDATE integrations.data_connections SET connection_status = $1, configuration = $2 WHERE id = $3`;
			const insertConnectionHistory = `INSERT INTO integrations.data_connections_history SELECT * FROM json_populate_recordset(null::integrations.data_connections_history, $1)`;
			const mockResult = {
				data: {
					response: {
						expiration: "2025-01-07T09:45:51Z",
						link_token: "link-sandbox-52643057-9f9a-4011-813d-e7493e87a158",
						request_id: "y3XunIFXfcTS1PP",
						environment: "default"
					},
					is_plaid_linked: false
				},
				message: "Plaid link flow has been initiated."
			};
			(getInvitationDetails as jest.Mock).mockResolvedValueOnce({ customer_id: "customer_id" });
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			jest.spyOn(banking, "checkAndCreateNewPlaidInstance").mockResolvedValueOnce({
				plaid: {
					createLinkToken: jest.fn().mockResolvedValue(mockLinkTokenResponse)
				} as unknown as Plaid,
				plaidEnv: "default"
			});
			(Plaid.getPlaidConnection as jest.Mock).mockResolvedValueOnce(connection);
			(getBusinessDetails as jest.Mock).mockResolvedValueOnce(getBusinessDetailsMock);
			const result = await banking.plaidLinkInit({ businessID }, { authorization }, params);
			expect(sqlTransaction).toHaveBeenCalledTimes(1);
			expect(sqlTransaction).toHaveBeenCalledWith(
				[updateConnectionQuery, insertConnectionHistory],
				[[connectionHistory.connection_status, JSON.stringify(connection?.configuration), connection.id], [expect.any(String)]]
			);
			expect(result).toEqual(mockResult);
		});
		it("should return plaid account has already been linked new link token response by creating creating user token.", async () => {
			const params = { invitation_id: "invitation_id" };
			const businessID: UUID = "09ccbf49-196a-493e-858c-0e3600317956";
			const authorization = "authorization";
			const connection: IDBConnection = {
				id: "66106573-40a9-4385-8d31-306fcbec4bbd",
				business_id: "09ccbf49-196a-493e-858c-0e3600317956",
				platform_id: 1,
				configuration: {},
				connection_status: "INITIALIZED",
				created_at: "2025-01-02T04:38:18.838Z",
				updated_at: "2025-01-02T04:38:18.838Z"
			};
			const getBusinessDetailsMock = {
				status: "success",
				message: "Business fetched successfully",
				data: {
					id: "09ccbf49-196a-493e-858c-0e3600317956",
					name: "Barrows - Beatty",
					tin: "XXXXX8477",
					address_line_1: "29692 S Oak Street",
					address_line_2: "Suite 633",
					address_city: "New Salma",
					address_state: "Ohio",
					address_postal_code: "60129",
					address_country: "USA",
					created_at: "2025-01-02T04:33:58.424Z",
					created_by: "077c3fc4-fccd-4a89-bca1-9df89fa15735",
					updated_at: "2025-01-02T04:38:30.471Z",
					updated_by: "077c3fc4-fccd-4a89-bca1-9df89fa15735",
					mobile: "+12348982851",
					official_website: "https://shocked-bridge.com/",
					public_website: null,
					social_account: null,
					status: "VERIFIED",
					industry: {
						id: 9,
						name: "Information",
						code: "information",
						sector_code: "51",
						created_at: "2024-04-24T17:56:46.034418",
						updated_at: "2024-04-24T17:56:46.034418"
					},
					mcc_id: null,
					naics_id: null,
					naics_code: null,
					naics_title: null,
					mcc_code: null,
					mcc_title: null,
					is_monitoring_enabled: null,
					subscription: {
						status: null,
						created_at: null,
						updated_at: null
					},
					owners: [
						{
							id: "9d31da8f-fadc-4792-9ab2-2a137a6df647",
							title: {
								id: 2,
								title: "Limited Partner"
							},
							first_name: "Fabiola",
							last_name: "Reilly",
							ssn: "873960028",
							email: "deondre36@hotmail.com",
							mobile: "+12346003640",
							date_of_birth: "2003-02-07",
							address_apartment: "Suite 185",
							address_line_1: "3378 Keely Square",
							address_line_2: null,
							address_city: "West Melany",
							address_state: "Montana",
							address_postal_code: "62677",
							address_country: "USA",
							created_at: "2025-01-02T11:11:28.098489",
							created_by: "077c3fc4-fccd-4a89-bca1-9df89fa15735",
							updated_at: "2025-01-02T11:11:28.098489",
							updated_by: "077c3fc4-fccd-4a89-bca1-9df89fa15735",
							ownership_percentage: 25,
							owner_type: "CONTROL"
						}
					],
					business_names: [
						{
							name: "Daugherty - Dooley",
							is_primary: false
						},
						{
							name: "Barrows - Beatty",
							is_primary: true
						}
					],
					business_addresses: [
						{
							line_1: "29692 S Oak Street",
							apartment: "Suite 633",
							city: "New Salma",
							state: "Ohio",
							country: "USA",
							postal_code: "60129",
							mobile: "+12348982851",
							is_primary: true
						}
					]
				}
			};
			const moakUserTokenResponse = {
				request_id: "5bQv8A31ju1xi7H",
				user_id: "cffde5c8c20d305f2e3c9f6e8751370d996ea608687508c91e883cbb85cb25a5",
				user_token: "user-sandbox-b9a10d03-52cb-4ec6-a26b-4b2c335b529c"
			};
			const mockLinkTokenResponse = {
				expiration: "2025-01-07T09:45:51Z",
				link_token: "link-sandbox-52643057-9f9a-4011-813d-e7493e87a158",
				request_id: "y3XunIFXfcTS1PP",
				environment: "default"
			};
			const connectionHistory = {
				connection_id: connection.id,
				log: JSON.stringify(connection?.configuration),
				connection_status: CONNECTION_STATUS.INITIALIZED
			};
			const updateConnectionQuery = `UPDATE integrations.data_connections SET connection_status = $1, configuration = $2 WHERE id = $3`;
			const insertConnectionHistory = `INSERT INTO integrations.data_connections_history SELECT * FROM json_populate_recordset(null::integrations.data_connections_history, $1)`;
			const mockResult = {
				data: {
					response: {
						expiration: "2025-01-07T09:45:51Z",
						link_token: "link-sandbox-52643057-9f9a-4011-813d-e7493e87a158",
						request_id: "y3XunIFXfcTS1PP",
						environment: "default"
					},
					is_plaid_linked: false
				},
				message: "Plaid link flow has been initiated."
			};
			(getInvitationDetails as jest.Mock).mockResolvedValueOnce({ customer_id: "customer_id" });
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			jest.spyOn(banking, "checkAndCreateNewPlaidInstance").mockResolvedValueOnce({
				plaid: {
					createUserToken: jest.fn().mockResolvedValue(moakUserTokenResponse),
					createLinkToken: jest.fn().mockResolvedValue(mockLinkTokenResponse)
				} as unknown as Plaid,
				plaidEnv: "default"
			});
			(Plaid.getPlaidConnection as jest.Mock).mockResolvedValueOnce(connection);
			(sqlQuery as jest.Mock).mockResolvedValueOnce({});
			(getBusinessDetails as jest.Mock).mockResolvedValueOnce(getBusinessDetailsMock);
			const result = await banking.plaidLinkInit({ businessID }, { authorization }, params);
			expect(sqlTransaction).toHaveBeenCalledTimes(1);
			expect(sqlTransaction).toHaveBeenCalledWith(
				[updateConnectionQuery, insertConnectionHistory],
				[[connectionHistory.connection_status, JSON.stringify(connection?.configuration), connection.id], [expect.any(String)]]
			);
			expect(result).toEqual(mockResult);
		});
	});
	describe("get plaid connection function", () => {
		it("should throw an error if plaid connection does not exist for business_id and platform_id.", async () => {
			const businessID = "businessID";
			(getInvitationDetails as jest.Mock).mockResolvedValueOnce({ customer_id: "customer_id" });
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			jest.spyOn(banking, "checkAndCreateNewPlaidInstance").mockResolvedValueOnce({ plaid: {} as Plaid, plaidEnv: "default" });
			(Plaid.getPlaidConnection as jest.Mock).mockRejectedValueOnce(new Error("Connection does not exist for business_id and platform_id"));
			await expect(Plaid.getPlaidConnection(businessID)).rejects.toThrow(new Error("Connection does not exist for business_id and platform_id"));
		});
	});
});
