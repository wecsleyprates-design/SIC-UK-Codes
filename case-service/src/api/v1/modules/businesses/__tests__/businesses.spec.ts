// TODO: Remove the @ts-nocheck and fix whatever problems it is masking
// @ts-nocheck

import { tokenConfig } from "#configs/index";
import {
	BUSINESS_STATUS,
	CASE_STATUS,
	CASE_STATUS_ENUM,
	CUSTOM_ONBOARDING_SETUP,
	ERROR_CODES,
	INVITE_STATUS,
	INVITE_STATUS_ENUM
} from "#constants/index";
import {
	db,
	emailExists,
	getApplicantByID,
	getApplicants,
	getBusinessApplicants,
	getBusinessIntegrationConnections,
	getCustomers,
	getCustomersInternal,
	getCustomerWithPermissions,
	inviteBusinessApplicants,
	producer,
	sqlQuery,
	sqlTransaction,
	getReportStatusForCase,
	getBusinessesRevenueAndAge,
	getBusinessApplicantByApplicantId,
	fetchNPIDetails,
	getCustomerAndBusinessUsers,
	hasDataPermission
} from "#helpers/index";
import { convertToObject, decodeInvitationToken, decryptEin, encryptEin, maskString, paginate } from "#utils/index";
import { invitationStatusQueue } from "#workers/invitationStatus";
import { StatusCodes } from "http-status-codes";
import { v4 as uuid } from "uuid";
import { businesses } from "../businesses";
import { BusinessApiError } from "../error";
import { riskAlert } from "../../risk-alerts/risk-alerts";
import { getFlagValue, getFlagValueByToken } from "#helpers/LaunchDarkly";
import { caseManagementService } from "../../case-management/case-management";
import { customerLimits } from "../../onboarding/customer-limits";
import { BusinessInvites } from "../businessInvites";
import { onboarding } from "../../onboarding/onboarding";
import { GetCustomerBusinessesRequestParams, GetCustomerBusinessesRequestQuery } from "../types";
import { Owners } from "../owners";
require("kafkajs");

jest.mock("jsonwebtoken");
jest.mock("#helpers/index");
jest.mock("#common/index");
jest.mock("#lib/index");
jest.mock("#utils/index");
jest.mock("#core");
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

jest.mock("#messaging/kafka/producers/custom-fields", () => ({
	sendCustomFieldUpdateEvents: jest.fn()
}));

jest.mock("../../../../../helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

jest.mock("../../../../../helpers/logger", () => {
	return {
		logger: {
			debug: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn()
		}
	};
});

jest.mock("#workers/invitationStatus", () => ({
	invitationStatusQueue: {
		addJob: jest.fn(),
		getJobByID: jest.fn(),
		removeJobByID: jest.fn()
	}
}));

jest.mock("../../risk-alerts/risk-alerts", () => {
	return {
		riskAlert: {
			_enrichRiskCases: jest.fn()
		}
	};
});

jest.mock("../../case-management/case-management");
jest.mock("../../onboarding/customer-limits", () => {
	return {
		customerLimits: {
			addBusinessCount: jest.fn(),
			isCustomerMonthlyLimitExhaused: jest.fn()
		}
	};
});
jest.mock("../../businesses/businessInvites");

const mockSqlQuery = sqlQuery as jest.MockedFunction<typeof sqlQuery>;
const mockPaginate = paginate as jest.MockedFunction<typeof paginate>;

describe("Businesses", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("getBusinessByID", () => {
		const params = {
			businessID: "businessID"
		};

		const query = {};

		const userInfo = {
			user_id: "user_id"
		};

		it("should add business details", async () => {
			jest.resetAllMocks();
			hasDataPermission.mockResolvedValueOnce(true);
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "businessID",
						industry_json: {
							industry_data: {
								id: 1,
								name: "industryName",
								code: "industryCode"
							}
						},
						subscription_status: "ACTIVE",
						subscription_created_at: "date",
						subscription_updated_at: "date"
					}
				]
			});
			const response = {
				id: "businessID",
				deleted_at: null,
				deleted_by: null,
				industry: {
					id: 1,
					name: "industryName",
					code: "industryCode"
				},
				subscription: {
					status: "ACTIVE",
					created_at: "date",
					updated_at: "date"
				},
				business_names: [
					{
						name: "business_name",
						is_primary: true
					}
				],
				business_addresses: [
					{
						line_1: "address line 1",
						apartment: null,
						city: "city",
						state: "state",
						country: "USA",
						postal_code: "00000",
						is_primary: true
					}
				]
			};

			sqlTransaction.mockResolvedValueOnce([
				{
					rows: [
						{
							name: "business_name",
							is_primary: true
						}
					]
				},
				{
					rows: [
						{
							line_1: "address line 1",
							apartment: null,
							city: "city",
							state: "state",
							country: "USA",
							postal_code: "00000",
							is_primary: true
						}
					]
				}
			]);

			const mockWhere = jest.fn().mockReturnThis();
			const mockModify = jest.fn().mockResolvedValueOnce([]);

			(db as jest.Mock).mockReturnValue({
				where: mockWhere,
				modify: mockModify
			});

			const result = await businesses.getBusinessByID(params, query, userInfo);
			expect(result).toEqual(response);
		});

		it("should throw an error when business it not found", async () => {
			jest.resetAllMocks();
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: [
					{
						id: "businessID",
						subscription_status: "ACTIVE",
						subscription_created_at: "date",
						subscription_updated_at: "date"
					}
				]
			});

			try {
				await businesses.getBusinessByID(params, query, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});
	});

	describe("updateBusinessDetails", () => {
		const body = {
			tin: 123456789,
			name: "Business"
		};
		const params = {
			caseID: "caseID"
		};
		const userInfo = {
			user_id: "customerUserID"
		};

		it("should add business details", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: []
			});
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockResolvedValue([{}])
			}));

			await businesses.updateBusinessDetails(body, params, userInfo);
		});

		it("should throw an error when no business is found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			try {
				await businesses.updateBusinessDetails(body, params, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});
	});

	describe("getBusinessCustomers", () => {
		jest.resetAllMocks();
		const query = {
			pagination: "true",
			items_per_page: 10,
			page: 1
		};
		const params = {
			businessID: "businessID"
		};
		const headers = {
			authorization: "authorization"
		};

		it("should return customers associated with business", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						customer_id: 1
					}
				]
			});

			const expectedResponse = {
				records: [
					{
						id: "sampleUserID",
						customer_details: {
							id: "sampleCustomerID",
							name: "sampleCustomerName"
						}
					}
				]
			};
			getCustomers.mockResolvedValueOnce(expectedResponse);

			const response = await businesses.getBusinessCustomers(params, query, headers);
			expect(response).toEqual(expectedResponse);
		});

		it("should return empty records if no customers are associated with business", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});
			const expectedResponse = {
				records: [],
				totalItems: 0,
				totalPages: 0
			};
			const response = await businesses.getBusinessCustomers(params, query, headers);
			expect(response).toEqual(expectedResponse);
		});
	});

	describe("internalBusinessCustomers", () => {
		it("should return ids of customers associated with business", async () => {
			const params = {
				businessID: "businessID"
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 4,
				rows: [
					{ customer_id: "customerID1" },
					{ customer_id: "customerID2" },
					{ customer_id: "customerID3" },
					{ customer_id: "customerID4" }
				]
			});

			const response = await businesses.internalBusinessCustomers(params);
			expect(response).toEqual({ customer_ids: ["customerID1", "customerID2", "customerID3", "customerID4"] });
		});
		it("should return only customer with monitoring enabled", async () => {
			const params = {
				businessID: "businessID"
			};

			const body = {
				is_monitoring_enabled: true
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 4,
				rows: [{ customer_id: "customerID1" }, { customer_id: "customerID2" }]
			});

			const response = await businesses.internalBusinessCustomers(params, body);
			expect(response).toEqual({ customer_ids: ["customerID1", "customerID2"] });
		});
	});

	describe("getCustomerBusinesses", () => {
		jest.resetAllMocks();
		const createMockQuery = (): GetCustomerBusinessesRequestQuery => ({
			pagination: "true",
			items_per_page: 10,
			page: 1,
			sort: { "data_businesses.name": "asc" },
			filter: { "data_businesses.status": ["VERIFIED", "UNVERIFIED"] },
			search: { "data_businesses.id": "1" },
			search_filter: { "data_businesses.id": ["1", "2"] },
			filter_date: { "data_businesses.created_at": "1-2-24" }
		});
		const createMockParams = (): GetCustomerBusinessesRequestParams => ({
			customerID: "customerID"
		});
		const userInfo = {
			user_id: "user_id"
		};

		it("should return businesses associated with a customer", async () => {
			/** Arrange */
			const params = createMockParams();
			const query = createMockQuery();

			hasDataPermission.mockResolvedValueOnce(true);

			/** Count query */
			mockSqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						totalcount: 1
					}
				]
			});
			/** Business query */
			mockSqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: 1,
						name: "business"
					}
				]
			});
			mockPaginate.mockReturnValueOnce({
				totalPages: 1,
				totalItems: 1
			});
			const expectedResponse = {
				records: [
					{
						id: 1,
						name: "business"
					}
				],
				total_items: 1,
				total_pages: 1
			};

			/** Act */
			const response = await businesses.getCustomerBusinesses(params, query, userInfo);

			/** Assert */
			expect(response).toEqual(expectedResponse);
		});

		it("should support filtering by data_business.id", async () => {
			/** Arrange */
			const params = createMockParams();
			const customerID = "MOCK_CUSTOMER_ID";
			params.customerID = customerID;

			const query = createMockQuery();
			const businessID = "MOCK_BUSINESS_ID";
			query.search_filter = { "data_businesses.id": businessID };

			/** Count query */
			mockSqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						totalcount: 1
					}
				]
			});
			/** Business query */
			mockSqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: 1,
						name: "business"
					}
				]
			});
			mockPaginate.mockReturnValueOnce({
				totalPages: 1,
				totalItems: 1
			});

			/** Act */
			await businesses.getCustomerBusinesses(params, query, userInfo);

			/** Assert */
			expect(sqlQuery).toHaveBeenCalledTimes(2);
			expect(sqlQuery).toHaveBeenNthCalledWith(1, {
				sql: expect.stringContaining("data_businesses.id IN ('MOCK_BUSINESS_ID')"),
				values: expect.arrayContaining([customerID])
			});
			expect(sqlQuery).toHaveBeenNthCalledWith(2, {
				sql: expect.stringContaining("data_businesses.id IN ('MOCK_BUSINESS_ID')"),
				values: expect.arrayContaining([customerID])
			});
		});

		it("should support filtering by external_id", async () => {
			/** Arrange */
			const params = createMockParams();
			const customerID = "MOCK_CUSTOMER_ID";
			params.customerID = customerID;

			const query = createMockQuery();
			const externalID = "MOCK_EXTERNAL_ID";
			query.search_filter = { external_id: externalID };

			/** Count query */
			mockSqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						totalcount: 1
					}
				]
			});
			/** Business query */
			mockSqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: 1,
						name: "business"
					}
				]
			});
			mockPaginate.mockReturnValueOnce({
				totalPages: 1,
				totalItems: 1
			});

			/** Act */
			await businesses.getCustomerBusinesses(params, query, userInfo);

			/** Assert */
			expect(sqlQuery).toHaveBeenCalledTimes(2);
			expect(sqlQuery).toHaveBeenNthCalledWith(1, {
				sql: expect.stringContaining("rel_business_customer_monitoring.external_id IN ('MOCK_EXTERNAL_ID')"),
				values: expect.arrayContaining([customerID])
			});
			expect(sqlQuery).toHaveBeenNthCalledWith(2, {
				sql: expect.stringContaining("rel_business_customer_monitoring.external_id IN ('MOCK_EXTERNAL_ID')"),
				values: expect.arrayContaining([customerID])
			});
		});
	});

	describe("getCasesByBusinessID", () => {
		jest.resetAllMocks();
		const query = {
			search: {
				first_name: "first_name",
				last_name: "last_name"
			},
			pagination: true,
			items_per_page: 10,
			page: 1,
			sort: { "data_businesses.name": "asc" },
			filter: {
				"data_cases.status": "ONBOARDING",
				"data_cases.id": ["1"],
				"data_cases.case_type": "true",
				is_standalone: "true"
			},
			search: { "data_cases.id": "1", first_name: "John" },
			search_filter: { applicant_id: ["1", "2"] },
			filter_date: { "data_cases.created_at": "1-2-24" }
		};
		const params = {
			businessID: "businessID"
		};
		const headers = {
			authorization: "authorization"
		};

		it("should return all cases given a business ID", async () => {
			getApplicants.mockResolvedValueOnce([{ id: "1" }]);
			getApplicants.mockResolvedValueOnce([{ id: "1" }]);
			convertToObject.mockReturnValueOnce({ 1: { first_name: "first_name", last_name: "last_name" } });

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						totalcount: 1
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "uuid",
						business_id: "businessID",
						applicant_id: 1,
						status_id: 1,
						status_code: "ONBOARDING",
						status_label: "ONBOARDING",
						naics_code: "naics",
						naics_title: "naics_title",
						mcc_code: "mcc",
						mcc_title: "mcc_title"
					}
				]
			});
			paginate.mockReturnValueOnce({
				totalPages: 1,
				totalItems: 1
			});
			const expectedResponse = {
				records: [
					{
						id: "uuid",
						business_id: "businessID",
						report_created_at: "2021-10-17T00:00:00.000Z",
						report_id: "uuid",
						report_status: "REQUESTED",
						applicant: {
							first_name: "first_name",
							last_name: "last_name"
						},
						applicant_id: 1,
						assignee: {},
						status: {
							code: "ONBOARDING",
							id: 1,
							label: "ONBOARDING"
						},
						status_label: "ONBOARDING",
						naics_code: "naics",
						naics_title: "naics_title",
						mcc_code: "mcc",
						mcc_title: "mcc_title",
						metadata: {
							formation_date: "date",
							age: 4,
							revenue: 10000,
							naics_code: "naics",
							naics_title: "naics_title",
							mcc_code: "mcc",
							mcc_title: "mcc_title"
						}
					}
				],
				total_items: 1,
				total_pages: 1
			};
			getReportStatusForCase.mockResolvedValueOnce([
				{
					id: "uuid",
					report_id: "uuid",
					status: "REQUESTED",
					created_at: "2021-10-17T00:00:00.000Z"
				}
			]);

			const riskAlertEnrichedCases = [
				{
					id: "uuid",
					business_id: "businessID",
					applicant: {
						first_name: "first_name",
						last_name: "last_name"
					},
					applicant_id: 1,
					assignee: {},
					status: {
						code: "ONBOARDING",
						id: 1,
						label: "ONBOARDING"
					},
					status_label: "ONBOARDING",
					naics_code: "naics",
					naics_title: "naics_title",
					mcc_code: "mcc",
					mcc_title: "mcc_title",
					metadata: {
						formation_date: "date",
						age: 4,
						revenue: 10000,
						naics_code: "naics",
						naics_title: "naics_title",
						mcc_code: "mcc",
						mcc_title: "mcc_title"
					}
				}
			];

			caseManagementService._enrichReportStatus.mockResolvedValueOnce([
				{
					...riskAlertEnrichedCases[0],
					...{
						report_created_at: "2021-10-17T00:00:00.000Z",
						report_id: "uuid",
						report_status: "REQUESTED"
					}
				}
			]);
			riskAlert._enrichRiskCases.mockResolvedValueOnce(riskAlertEnrichedCases);

			getBusinessesRevenueAndAge.mockResolvedValueOnce({
				businessID: {
					formation_date: "date",
					age: 4,
					revenue: 10000
				}
			});

			const response = await businesses.getCasesByBusinessID(params, query, headers);
			expect(response).toEqual(expectedResponse);
		});
	});

	describe("getApplicantBusinessInvites", () => {
		const params = {
			applicantID: "sampleApplicantID"
		};

		const query = {
			sort: {
				"data_invites.created_at": "ASC"
			}
		};

		const userInfo = {
			user_id: "sampleApplicantID"
		};

		const response = {
			records: [
				{
					invitation_id: "sampleInvitationID",
					created_at: "2015-01-01T00:00:00.000Z",
					status: "INVITED",
					customer_name: "sampleCustomerName"
				}
			],
			total_items: 1
		};

		test("list of customer business invites for applicant should be return", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "sampleInvitationID",
						created_at: "2015-01-01T00:00:00.000Z",
						status: "INVITED",
						customer_id: "sampleCustomerID"
					}
				]
			});

			getCustomersInternal.mockResolvedValueOnce({
				records: [
					{
						id: "sampleUserID",
						customer_details: {
							id: "sampleCustomerID",
							name: "sampleCustomerName"
						}
					}
				],
				total_items: 1,
				total_pages: 1
			});

			const result = await businesses.getApplicantBusinessInvites(params, query, userInfo);

			expect(result).toEqual(response);
		});

		it("should return empty array when applicant does not get any business invites", async () => {
			const params = {
				applicantID: "sampleApplicantID"
			};

			const query = {};

			const userInfo = {
				user_id: "sampleApplicantID"
			};

			const sampleResponse = {
				records: [],
				total_items: 0
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			const sampleResult = await businesses.getApplicantBusinessInvites(params, query, userInfo);

			expect(sampleResult).toEqual(sampleResponse);
		});

		it("should throw an error when another user tries to access the invite details", async () => {
			const params = {
				applicantID: "sampleApplicantID"
			};

			const query = {};

			const userInfo = {
				user_id: "anotherSampleUserID"
			};

			try {
				await businesses.getApplicantBusinessInvites(params, query, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.UNAUTHORIZED);
				expect(error.errorCode).toBe(ERROR_CODES.UNAUTHORIZED);
			}
		});
	});

	describe("getBusinesses", () => {
		const query = {
			pagination: true,
			items_per_page: 10,
			page: 1,
			search: {
				"data_businesses.name": "John Doe",
				"data_customers.name": "Customer Name"
			},
			sort: {
				"data_businesses.name": "DESC",
				"data_businesses.created_at": "DESC"
			},
			filter: {
				"data_businesses.status": "INVITED",
				"data_businesses.id": ["id1", "id2", "id3"],
				"data_subscriptions.status": ["SUBSCRIBED", "NOT_SUBSCRIBED"],
				"rel_business_customer_monitoring.customer_id": ["uuid1", "uuid2", "uuid3"],
				business_type: ["type1", "type2"]
			},
			filter_date: {
				"data_businesses.created_at": ["17-10-2000", "17-10-2000"]
			},
			search_filter: {
				"data_businesses.id": ["id1", "id2", "id3"]
			}
		};

		const headers = {
			authorization: "Bearer token"
		};

		const response = {
			records: [
				{
					id: "businessID",
					name: "businessName",
					customer_id: "customerID",
					subscription: {}
				}
			],
			total_pages: 1,
			total_items: 1
		};

		const userInfo = {
			user_id: "user_id"
		};

		it("should return all the businesses", async () => {
			hasDataPermission.mockResolvedValueOnce(true);

			getCustomers.mockResolvedValueOnce({
				customersData: {
					records: []
				}
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						totalcount: 1
					}
				]
			});

			paginate.mockReturnValueOnce({
				totalItems: 1,
				totalPages: 1
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "businessID",
						name: "businessName",
						customer_id: "customerID"
					}
				]
			});

			const result = await businesses.getBusinesses(query, headers, userInfo);

			expect(result).toEqual(response);
		});
	});

	describe("getBusinessesInternal", () => {
		const query = {
			pagination: true,
			items_per_page: 10,
			page: 1,
			search: {
				"data_businesses.name": "John Doe"
			},
			sort: {
				"data_businesses.name": "DESC",
				"data_businesses.created_at": "DESC"
			},
			filter: {
				"data_businesses.status": "INVITED",
				"data_businesses.id": ["id1", "id2", "id3"],
				"data_subscriptions.status": ["SUBSCRIBED", "NOT_SUBSCRIBED"],
				"rel_business_customer_monitoring.customer_id": ["uuid1", "uuid2", "uuid3"],
				business_type: ["type1", "type2"]
			},
			filter_date: {
				"data_businesses.created_at": ["17-10-2000", "17-10-2000"]
			},
			search_filter: {
				"data_businesses.id": ["id1", "id2", "id3"]
			}
		};

		const headers = {
			authorization: "Bearer token"
		};

		const response = {
			records: [
				{
					id: "businessID",
					name: "businessName",
					customer_id: "customerID",
					subscription: {}
				}
			],
			total_pages: 1,
			total_items: 1
		};

		it("should return all the businesses", async () => {
			getCustomers.mockResolvedValueOnce({
				customersData: {
					records: []
				}
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						totalcount: 1
					}
				]
			});

			paginate.mockReturnValueOnce({
				totalItems: 1,
				totalPages: 1
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "businessID",
						name: "businessName",
						customer_id: "customerID"
					}
				]
			});

			const result = await businesses.getBusinessesInternal(query, headers);

			expect(result).toEqual(response);
		});
	});

	describe("getBusinessByID", () => {
		const params = {
			businessID: "businessID"
		};

		const response = {
			id: "businessID",
			name: "businessName",
			deleted_at: null,
			deleted_by: null,
			industry: {
				id: 1,
				name: "industryName",
				code: "industryCode"
			},
			subscription: {
				status: "SUBSCRIBED",
				created_at: "createdAt",
				updated_at: "updatedAt"
			},
			business_names: [
				{
					name: "business_name",
					is_primary: true
				}
			],
			business_addresses: [
				{
					line_1: "address line 1",
					apartment: null,
					city: "city",
					state: "state",
					country: "USA",
					postal_code: "00000",
					is_primary: true
				}
			]
		};

		it("should return the business details", async () => {
			hasDataPermission.mockResolvedValueOnce(true);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "businessID",
						name: "businessName",
						industry_json: {
							industry_data: {
								id: 1,
								name: "industryName",
								code: "industryCode"
							}
						},
						subscription_status: "SUBSCRIBED",
						subscription_created_at: "createdAt",
						subscription_updated_at: "updatedAt"
					}
				]
			});

			sqlTransaction.mockResolvedValueOnce([
				{
					rows: [
						{
							name: "business_name",
							is_primary: true
						}
					]
				},
				{
					rows: [
						{
							line_1: "address line 1",
							apartment: null,
							city: "city",
							state: "state",
							country: "USA",
							postal_code: "00000",
							is_primary: true
						}
					]
				}
			]);

			const mockWhere = jest.fn().mockReturnThis();
			const mockModify = jest.fn().mockResolvedValueOnce([]);
			(db as jest.Mock).mockReturnValue({
				where: mockWhere,
				modify: mockModify
			});

			const result = await businesses.getBusinessByID(params);

			expect(result).toEqual(response);
		});

		it("should throw an error when business not found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			try {
				await businesses.getBusinessByID(params);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});
	});

	describe("getBusinessApplicants", () => {
		const params = {
			businessID: "businessID",
			customerID: "customerID"
		};

		const headers = {
			authorization: "Bearer token"
		};

		const response = {
			records: [
				{
					id: "applicantID",
					first_name: "John",
					last_name: "Doe",
					status: "PENDING"
				}
			],
			total_items: 1,
			total_pages: 1
		};

		it("should return business applicants", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1
			});

			getBusinessApplicants.mockResolvedValueOnce({
				records: [
					{
						id: "applicantID",
						first_name: "John",
						last_name: "Doe",
						status: "PENDING"
					}
				],
				total_items: 1,
				total_pages: 1
			});

			const result = await businesses.getBusinessApplicantsForCustomer(params, headers);

			expect(result).toEqual(response);
		});

		it("should throw an error when the business is not onboarded by the given customer", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			try {
				await businesses.getBusinessApplicantsForCustomer(params, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.FORBIDDEN);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});

	describe("inviteBusiness", () => {
		const params = {
			customerID: "customerID"
		};

		const body = {
			new_business: {
				name: "busienssName"
			},
			new_applicants: [
				{
					first_name: "abc",
					last_name: "def",
					email: "email@abc.com"
				}
			]
		};

		const userInfo = {
			user_id: "user_id"
		};

		it("should invite a new business", async () => {
			// flag for lightning verification
			getFlagValue.mockResolvedValueOnce(false);

			getCustomerWithPermissions.mockResolvedValueOnce({
				"onboarding_module:write": true
			});

			uuid.mockReturnValueOnce("invitationID");

			emailExists.mockResolvedValueOnce({
				email_exists: false
			});

			sqlTransaction.mockResolvedValueOnce({});

			getFlagValue.mockResolvedValueOnce(true);

			producer.send.mockResolvedValueOnce({});

			invitationStatusQueue.addJob.mockResolvedValueOnce({});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);
			await BusinessInvites.inviteBusiness(params, body, userInfo);
		});

		it("should invite a new business & return invitation link. for body with applicant & business and isSyncBusinessInvitation flag true", async () => {
			const body = {
				business: {
					name: "busienssName"
				},
				applicants: [
					{
						first_name: "abc",
						last_name: "def",
						email: "email@abc.com"
					}
				]
			};

			// flag for lightning verification
			getFlagValue.mockResolvedValueOnce(false);

			// easyflow flag
			getFlagValue.mockResolvedValueOnce(false);
			customerLimits.isCustomerMonthlyLimitExhaused.mockReturnValueOnce(false);

			// no-login flag
			getFlagValue.mockResolvedValueOnce(true);

			getCustomerWithPermissions.mockResolvedValueOnce({
				"onboarding_module:write": true
			});

			uuid.mockReturnValueOnce("invitationID");

			emailExists.mockResolvedValueOnce({
				email_exists: false
			});

			sqlTransaction.mockResolvedValueOnce({});

			getFlagValue.mockResolvedValueOnce(true);

			getFlagValue.mockResolvedValueOnce(true);

			inviteBusinessApplicants.mockResolvedValueOnce({ invitation_links: { "email@abc.com": "invitationLink" } });

			invitationStatusQueue.addJob.mockResolvedValueOnce({});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			// Use a non-mocked version of BusinessInvites
			jest.unmock("../businessInvites");
			const businessInviteModule = require("../businessInvites");
			// Reset the mock after requiring the real module

			const response = await businessInviteModule.BusinessInvites.inviteBusiness(params.customerID, body, userInfo);
			jest.resetModules();
			expect(response).toMatchObject({
				applicant_email: "email@abc.com",
				invitation_id: "invitationID",
				customer_id: "customerID"
			});
		});

		it("should send invite with existing business", async () => {
			// flag for lightning verification
			getFlagValue.mockResolvedValueOnce(false);

			getCustomerWithPermissions.mockResolvedValueOnce({
				"onboarding_module:write": true
			});

			const sampleBody = {
				existing_business: {
					business_id: "uuid",
					name: "busienssName"
				},
				new_applicants: [
					{
						first_name: "abc",
						last_name: "def",
						email: "email@abc.com"
					}
				]
			};

			uuid.mockReturnValueOnce("invitationID");

			emailExists.mockResolvedValueOnce({
				email_exists: false
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "uuid",
						name: "businessName",
						status: BUSINESS_STATUS.VERIFIED
					}
				]
			});

			sqlTransaction.mockResolvedValueOnce({});

			producer.send.mockResolvedValueOnce({});

			invitationStatusQueue.addJob.mockResolvedValueOnce({});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			await BusinessInvites.inviteBusiness(params, sampleBody, userInfo);
		});

		it("should throw an error when email already exists", async () => {
			// flag for lightning verification
			getFlagValue.mockResolvedValueOnce(false);

			getCustomerWithPermissions.mockResolvedValueOnce({
				"onboarding_module:write": true
			});
			uuid.mockReturnValueOnce("invitationID");

			emailExists.mockResolvedValueOnce({
				email_exists: true
			});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			try {
				await BusinessInvites.inviteBusiness(params, body, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should throw an error when business is not onboarded by the current customer", async () => {
			// flag for lightning verification
			getFlagValue.mockResolvedValueOnce(false);

			getCustomerWithPermissions.mockResolvedValueOnce({
				"onboarding_module:write": true
			});
			const sampleBody = {
				existing_business: {
					business_id: "uuid",
					name: "busienssName"
				},
				new_applicants: [
					{
						first_name: "abc",
						last_name: "def",
						email: "email@abc.com"
					}
				]
			};

			uuid.mockReturnValueOnce("invitationID");

			emailExists.mockResolvedValueOnce({
				email_exists: false
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			try {
				await BusinessInvites.inviteBusiness(params, sampleBody, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
			}
		});
	});

	describe("verifyInvitationToken", () => {
		const params = {
			invitationToken: "invitationToken"
		};

		const response = {
			business_id: "businessID",
			applicant_id: "applicantID",
			invitation_id: "invitationID",
			email: "abc@email.com"
		};

		it("should verify the invitation token", async () => {
			decodeInvitationToken.mockReturnValueOnce({
				case: "onboard_applicant_by_customer",
				business_id: "businessID",
				applicant_id: "applicantID",
				invitation_id: "invitationID",
				email: "abc@email.com",
				exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: "invited"
					}
				]
			});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			const result = await businesses.verifyInvitationToken(params);

			expect(result).toEqual(response);
		});

		it("should throw an error when token case is not onboard_applicant_by_customer", async () => {
			decodeInvitationToken.mockReturnValueOnce({
				case: "case",
				business_id: "businessID",
				applicant_id: "applicantID",
				invitation_id: "invitationID",
				email: "abc@email.com",
				exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS
			});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			try {
				await businesses.verifyInvitationToken(params);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should throw an error when data in db not found", async () => {
			decodeInvitationToken.mockReturnValueOnce({
				case: "onboard_applicant_by_customer",
				business_id: "businessID",
				applicant_id: "applicantID",
				invitation_id: "invitationID",
				email: "abc@email.com",
				exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			try {
				await businesses.verifyInvitationToken(params);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should throw an error when invitation is rejected", async () => {
			decodeInvitationToken.mockReturnValueOnce({
				case: "onboard_applicant_by_customer",
				business_id: "businessID",
				applicant_id: "applicantID",
				invitation_id: "invitationID",
				email: "abc@email.com",
				exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: "rejected"
					}
				]
			});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			try {
				await businesses.verifyInvitationToken(params);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should throw an error when token is expired", async () => {
			decodeInvitationToken.mockReturnValueOnce({
				case: "onboard_applicant_by_customer",
				business_id: "businessID",
				applicant_id: "applicantID",
				invitation_id: "invitationID",
				email: "abc@email.com",
				exp: Date.now() - tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: "invited"
					}
				]
			});

			invitationStatusQueue.getJobByID.mockResolvedValueOnce({
				data: {}
			});

			sqlTransaction.mockResolvedValueOnce({});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			try {
				await businesses.verifyInvitationToken(params);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should throw an error when invitation status is not in allowed statuses array", async () => {
			decodeInvitationToken.mockReturnValueOnce({
				case: "onboard_applicant_by_customer",
				business_id: "businessID",
				applicant_id: "applicantID",
				invitation_id: "invitationID",
				email: "abc@email.com",
				exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: "status",
						customer_id: "customerID",
						case_id: "caseID"
					}
				]
			});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			try {
				await businesses.verifyInvitationToken(params);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});

	describe("updateInvitationStatus", () => {
		const body = {
			invitation_token: "invitationToken",
			invitation_id: "invitationID",
			action: "ACCEPT"
		};

		const userInfo = {
			user_id: "userID",
			email: "abc@email.com"
		};

		const response = {
			message: "Invitation Accepted"
		};

		it("should accept the invitation status if action is accept", async () => {
			decodeInvitationToken.mockReturnValueOnce({
				case: "onboard_applicant_by_customer",
				business_id: "businessID",
				applicant_id: "applicantID",
				invitation_id: "invitationID",
				email: "abc@email.com",
				exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: "invited"
					}
				]
			});

			sqlTransaction.mockResolvedValueOnce({});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			const result = await businesses.updateInvitationStatus(body, userInfo);

			expect(result).toEqual(response);
		});

		it("should complete the invitation status if action is complete", async () => {
			const body = {
				invitation_token: "invitationToken",
				invitation_id: "invitationID",
				action: "COMPLETE"
			};

			const sampleResponse = {
				message: "Invitation completed"
			};

			decodeInvitationToken.mockReturnValueOnce({
				case: "onboard_applicant_by_customer",
				business_id: "businessID",
				applicant_id: "applicantID",
				invitation_id: "invitationID",
				email: "abc@email.com",
				exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: "accepted"
					}
				]
			});

			sqlTransaction.mockResolvedValueOnce({});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			const result = await businesses.updateInvitationStatus(body, userInfo);

			expect(result).toEqual(sampleResponse);
		});

		it("should return message as success if action is neither accept not complete", async () => {
			const body = {
				invitation_id: "invitationID",
				action: "action"
			};

			const sampleResponse = {
				message: "Success"
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						status: "accepted",
						business_id: "businessID"
					}
				]
			});

			sqlTransaction.mockResolvedValueOnce({});

			const result = await businesses.updateInvitationStatus(body, userInfo);

			expect(result).toEqual(sampleResponse);
		});

		it("shoud throw an error when invitation does not exists", async () => {
			const body = {
				invitation_id: "invitationID",
				action: "action"
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			try {
				await businesses.updateInvitationStatus(body, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should throw an error when email in userInfo and in token does not match", async () => {
			decodeInvitationToken.mockReturnValueOnce({
				case: "onboard_applicant_by_customer",
				business_id: "businessID",
				applicant_id: "applicantID",
				invitation_id: "invitationID",
				email: "xyz@email.com",
				exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: "accepted"
					}
				]
			});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			try {
				await businesses.updateInvitationStatus(body, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});

	describe("getBusinessDetails", () => {
		const params = {
			businessID: "businessID"
		};

		const response = {
			business_name: "businessName",
			tin: "tin",
			ssn: "ssn",
			rel_business_customer_monitoring: null
			// business_names: [],
			// business_addresses: []
		};

		const userInfo = {
			user_id: "user_id"
		};

		it("should return the business details", async () => {
			hasDataPermission.mockResolvedValueOnce(true);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						business_name: "businessName",
						tin: "encryptedTin",
						ssn: "encryptedSsn",
						rel_business_customer_monitoring_json: {
							rel_business_customer_monitoring: null
						}
					}
				]
			});

			decryptEin.mockReturnValueOnce("tin");
			decryptEin.mockReturnValueOnce("ssn");

			const result = await businesses.getBusinessDetails(params, userInfo);

			expect(result).toEqual(response);
		});

		it("should throw an error when business not found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			try {
				await businesses.getBusinessDetails(params, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});
	});

	describe("setBusinessMonitoring", () => {
		const body = {
			business_id: "businessID",
			customer_id: "customerID",
			enable_monitoring: true
		};

		it("should set the business monitoring", async () => {
			sqlQuery.mockResolvedValueOnce({});

			await businesses.setBusinessMonitoring(body);
		});
	});

	// TODO: pending as we are not using this anymore
	// covering only to increase the coverage
	describe("startApplication", () => {
		const params = {
			businessID: "businessID"
		};

		const body = {
			invitation_id: "invitationID"
		};

		const userInfo = {
			user_id: "userID"
		};

		const response = {
			case_id: "caseID",
			business_id: "businessID",
			case_status: CASE_STATUS_ENUM.ONBOARDING
		};

		it("should start the application for invited flow", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						status: BUSINESS_STATUS.VERIFIED
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						status: "ACCEPTED",
						business_id: "businessID"
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rows: [
					{
						id: "id"
					}
				]
			});

			uuid.mockReturnValueOnce("caseID");

			sqlTransaction.mockResolvedValueOnce({});

			// updateInvitationStatus mock
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						status: "invited",
						business_id: "businessID"
					}
				]
			});
			sqlTransaction.mockResolvedValueOnce({});

			producer.send.mockResolvedValueOnce({});

			const result = await businesses.startApplication(body, params, userInfo);

			expect(result).toEqual(response);
		});

		it("should start the application for standalone flow", async () => {
			const sampleBody = {};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						status: BUSINESS_STATUS.VERIFIED
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			sqlQuery.mockResolvedValueOnce({
				rows: [
					{
						id: "id"
					}
				]
			});

			uuid.mockReturnValueOnce("caseID");

			sqlTransaction.mockResolvedValueOnce({});

			producer.send.mockResolvedValueOnce({});

			const result = await businesses.startApplication(sampleBody, params, userInfo);

			expect(result).toEqual(response);
		});

		it("should throw an error when business not found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			try {
				await businesses.startApplication(body, params, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});

		it("should throw an error when business is not verified", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "some-business-id",
						status: BUSINESS_STATUS.UNVERIFIED,
						invitation_status: "INVITED", // important
						address_country: "USA", // needed if `isUSBusiness` is called
						customer_id: "customer-id", // required for getProgressionConfig
						case_id: null, // triggers createCase flow
						owner_applicant_id: "applicant-id" // maybe used later
					}
				]
			});

			await expect(businesses.startApplication(body, params, userInfo)).rejects.toMatchObject({
				status: StatusCodes.BAD_REQUEST,
				errorCode: ERROR_CODES.INVALID
			});
		});

		it("should throw an error when invitation not found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						status: BUSINESS_STATUS.VERIFIED
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			try {
				await businesses.startApplication(body, params, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});

	describe("submitCase", () => {
		beforeEach(() => {
			//jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
		});
		const params = {
			businessID: "businessID",
			caseID: "caseID"
		};

		const userInfo = {
			user_id: "userID"
		};

		const headers = {
			authorization: "token"
		};

		it("should submit the invited case", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 0,
					rows: []
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "inviteID",
							status: INVITE_STATUS.ACCEPTED
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: CASE_STATUS.ONBOARDING,
							business_id: "businessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: BUSINESS_STATUS.VERIFIED
						}
					]
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			uuid.mockReturnValueOnce("standaloneCaseID");

			sqlTransaction.mockResolvedValueOnce([]);

			producer.send.mockResolvedValueOnce({});

			producer.send.mockResolvedValueOnce({});

			jest.spyOn(businesses, "purgeFirstIntegrationKeys").mockResolvedValueOnce();

			const result = await businesses.submitCase(params, userInfo, headers);

			expect(result).toEqual({ message: "Case submitted successfully." });
		});

		it("should submit the standalone case", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							id: "caseID",
							business_id: "businessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "inviteID",
							status: INVITE_STATUS.ACCEPTED
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: CASE_STATUS.ONBOARDING,
							business_id: "businessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: BUSINESS_STATUS.VERIFIED
						}
					]
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			producer.send.mockResolvedValueOnce({});

			jest.spyOn(businesses, "purgeFirstIntegrationKeys").mockResolvedValueOnce();

			const result = await businesses.submitCase(params, userInfo, { authorization: "token" });

			expect(result).toEqual({ message: "Case submitted successfully." });
		});

		it("should throw an error when case is submitted by co-applicant", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{},
				{},
				{
					rowCount: 0
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "user" }]);

			try {
				await businesses.submitCase(params, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.FORBIDDEN);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should throw an error when business not found", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{},
				{},
				{},
				{
					rowCount: 0
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			try {
				await businesses.submitCase(params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});

		it("should throw an error when business is not verified", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{},
				{},
				{},
				{
					rowCount: 1,
					rows: [
						{
							status: BUSINESS_STATUS.UNVERIFIED,
							address_country: "CAN"
						}
					]
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			try {
				await businesses.submitCase(params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});

		it("should not throw an error when business is not verified and TIN is not required", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([
				{
					stage: "company",
					config: { fields: [{ name: "Tax ID Number/Employer Identification Number", status: "optional" }] }
				}
			]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(false);

			sqlTransaction.mockResolvedValueOnce([
				{},
				{},
				{},
				{
					rowCount: 1,
					rows: [
						{
							status: BUSINESS_STATUS.UNVERIFIED,
							address_country: "USA"
						}
					]
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			try {
				await businesses.submitCase(params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.message).toBe("Case not found");
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
			}
		});

		it("should throw an error when case not found", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{},
				{},
				{
					rowCount: 0
				},
				{
					rowCount: 1,
					rows: [
						{
							status: BUSINESS_STATUS.VERIFIED
						}
					]
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			try {
				await businesses.submitCase(params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});

		it("should throw an error when case does not belong to business", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{},
				{},
				{
					rowCount: 1,
					rows: [
						{
							id: "caseID",
							business_id: "anotherBusinessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: BUSINESS_STATUS.VERIFIED
						}
					]
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			try {
				await businesses.submitCase(params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should return message when case status is submitted", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{},
				{},
				{
					rowCount: 1,
					rows: [
						{
							status: CASE_STATUS.SUBMITTED,
							business_id: "businessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: BUSINESS_STATUS.VERIFIED
						}
					]
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			const result = await businesses.submitCase(params, userInfo, headers);

			expect(result).toEqual({ message: "This case has already been submitted." });
		});

		it("should throw an error when case status is not in allowed statuses array", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{},
				{},
				{
					rowCount: 1,
					rows: [
						{
							status: "status",
							business_id: "businessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: BUSINESS_STATUS.VERIFIED
						}
					]
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			try {
				await businesses.submitCase(params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should return message when invitation status is completed", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							id: "caseID",
							business_id: "businessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "inviteID",
							status: INVITE_STATUS.COMPLETED
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: CASE_STATUS.ONBOARDING,
							business_id: "businessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: BUSINESS_STATUS.VERIFIED
						}
					]
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			const result = await businesses.submitCase(params, userInfo, headers);

			expect(result).toEqual({ message: "This case has already been submitted." });
		});

		it("should throw an error if invite status is neither completed not accepted", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(businesses, "getTinRequirementStatus").mockResolvedValueOnce(true);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							id: "caseID",
							business_id: "businessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "inviteID",
							status: "status"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: CASE_STATUS.ONBOARDING,
							business_id: "businessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							status: BUSINESS_STATUS.VERIFIED
						}
					]
				}
			]);

			getBusinessApplicantByApplicantId.mockResolvedValueOnce([{ code: "owner" }]);

			try {
				await businesses.submitCase(params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});

	describe("createApplicantBusiness", () => {
		const userInfo = {
			user_id: "userID"
		};

		const response = {
			business_id: "businessID"
		};

		it("should create an applicant business", async () => {
			uuid.mockReturnValueOnce("businessID");

			sqlQuery.mockResolvedValueOnce({});

			const result = await businesses.createApplicantBusiness(userInfo);

			expect(result).toEqual(response);
		});
	});

	describe("getBusinessStatus", () => {
		const response = [
			{
				id: 1,
				code: "status"
			}
		];

		it("should return the business status", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: 1,
						code: "status"
					}
				]
			});

			const result = await businesses.getBusinessStatus();

			expect(result).toEqual(response);
		});
	});

	describe("getBusinessInvites", () => {
		const params = {
			businessID: "businessID",
			customerID: "customerID"
		};

		const query = {
			pagination: true,
			items_per_page: 10,
			page: 1,
			search: {
				first_name: "John Doe",
				last_name: "Customer Name"
			},
			sort: {
				created_at: "DESC"
			},
			filter: {
				id: ["id1", "id2", "id3"],
				status: "INVITED"
			},
			filter_date: {
				created_at: ["17-10-2000", "17-10-2000"]
			}
		};

		const headers = {
			authorization: "Bearer token"
		};

		const response = {
			records: [
				{
					id: "id",
					created_by: "customerID",
					invited: {
						id: "id",
						first_name: "John",
						last_name: "Doe"
					}
				}
			],
			total_pages: 1,
			total_items: 1
		};

		it("should return all the business invites", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						totalcount: 1
					}
				]
			});

			paginate.mockReturnValueOnce({
				totalItems: 1,
				totalPages: 1
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "id",
						created_by: "customerID"
					}
				]
			});

			getCustomerAndBusinessUsers.mockResolvedValueOnce([{ id: "customerID", first_name: "John", last_name: "Doe" }]);

			const result = await businesses.getBusinessInvites(params, query, headers);

			expect(result).toEqual(response);
		});

		it("should throw an error when records not found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			try {
				await businesses.getBusinessInvites(params, query, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});
	});

	describe("getInvitationByID", () => {
		const params = {
			invitationID: "invitationID"
		};

		const response = {
			id: "invitationID",
			status: "status",
			business_id: "businessID"
		};

		it("should return the invitation details by id", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						status: "status",
						business_id: "businessID"
					}
				]
			});

			const result = await businesses.getInvitationByID(params);

			expect(result).toEqual(response);
		});
	});

	describe("getInvitationDetails", () => {
		const query = {
			customer_id: "customerID",
			business_id: "businessID",
			invitation_id: "invitationID"
		};

		const headers = {
			authorization: "Bearer token"
		};

		it("should return the invitation details by id", async () => {
			const params = {
				invitationID: "invitationID"
			};

			const response = {
				id: "invitationID",
				status: "status",
				business_id: "businessID"
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						status: "status",
						business_id: "businessID"
					}
				]
			});

			const result = await businesses.getInvitationByID(params);

			expect(result).toEqual(response);
		});

		it("should throw an error when invitation not found", async () => {
			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 0
				},
				{},
				{}
			]);

			try {
				await businesses.getInvitationDetails(query, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});
	});

	describe("resendCustomerBusinessInvite", () => {
		const params = {
			businessID: "businessID",
			customerID: "customerID",
			invitationID: "invitationID"
		};

		const userInfo = {
			user_id: "userID"
		};

		const body = {};

		it("should resend customer business invite", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						status: "INVITED"
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						applicant_id: "applicantID"
					}
				]
			});

			sqlTransaction.mockResolvedValueOnce({});

			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				// join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(undefined)
			}));

			producer.send.mockResolvedValueOnce({});

			invitationStatusQueue.getJobByID.mockResolvedValueOnce({});

			invitationStatusQueue.addJob.mockResolvedValueOnce({});

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			await businesses.resendCustomerBusinessInvite(params, body, userInfo);
		});

		it("shold throw an error when invitation not found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			try {
				await businesses.resendCustomerBusinessInvite(params, body, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});

		it("should throw an error if invite is already accepted", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						status: INVITE_STATUS.ACCEPTED
					}
				]
			});

			try {
				await businesses.resendCustomerBusinessInvite(params, body, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
			}
		});

		it("should throw an error when no applicants found for the business", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						status: "INVITED"
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			try {
				await businesses.resendCustomerBusinessInvite(params, body, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});
	});

	describe("getProgression", () => {
		const params = {
			businessID: "businessID"
		};

		const query = {
			invitation_id: "invitationID"
		};

		const userInfo = {
			user_id: "applicantID"
		};

		const headers = {
			authorization: "Bearer token"
		};

		const response = {
			are_all_required_stages_completed: true,
			business_country: "US",
			esign_template_id: undefined,
			integration_configs: {
				pii_prefill_enabled: false,
				processor_orchestration_enabled: false
			},
			case_id: "caseID",
			case_status: CASE_STATUS.ONBOARDING,
			customer_id: "customerID",
			invitation_id: "invitationID",
			is_submitted: false,
			is_partial_submission_allowed: false,
			progression_type: "regular",
			completed_stages: [
				{
					label: "company",
					completion_weightage: 15,
					config: {
						fields: [
							{
								name: "Primary Provider’s NPI Number*",
								status: "Required"
							}
						]
					},
					is_stage_truly_completed: true,
					max_retries_reached: false,
					retries: NaN,
					id: 1,
					is_skippable: true,
					next_stage: {
						label: null,
						id: "company additional info",
						stage: null
					},
					pre_filled_data: {
						business_details: {
							address_city: "address_city",
							address_line_1: "address_line_1",
							address_postal_code: "address_postal_code",
							address_state: "address_state",
							id: "businessID",
							name: "businessName",
							npi: "npiID",
							tin: "XXXXX1234",
							business_addresses: [],
							business_names: [],
							industry: undefined,
							mcc_code: undefined,
							mcc_title: undefined,
							naics_code: undefined,
							naics_title: undefined,
							has_dba: false,
							same_mailing_address: false
						}
					},
					prev_stage: {
						id: null,
						label: null,
						stage: null
					},
					priority_order: 1,
					stage: "company"
				}
			],
			current_stage: {
				current_progression_percentage: 15
			},
			custom_field_template_id: undefined,
			customer_onboarding_setups: [
				{
					code: CUSTOM_ONBOARDING_SETUP.POST_SUBMISSION_EDITING_SETUP,
					is_enabled: false
				},
				{
					code: CUSTOM_ONBOARDING_SETUP.INTERNATIONAL_BUSINESS_SETUP,
					is_enabled: false
				}
			],
			stages: [
				{
					id: 1,
					priority_order: 1,
					stage: "company",
					label: "company"
				}
			]
		};

		it("should throw error if invitation is not linked with business", async () => {
			try {
				sqlQuery.mockResolvedValueOnce({ rowCount: 0 });
				await businesses.getProgression(params, query, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should return the progression details for company stage", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(undefined)
			}));
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([
				{
					id: 1,
					stage: "company",
					label: "company",
					prev_stage: null,
					next_stage: "company additional info",
					completion_weightage: 15,
					priority_order: 1,
					is_skippable: true,
					config: {
						fields: [
							{
								name: "Primary Provider’s NPI Number*",
								status: "Required"
							}
						]
					}
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						business_id: "businessID",
						customer_id: "customerID",
						status: "INVITED",
						action_taken_by: "applicantID",
						case_id: "caseID",
						created_at: "date",
						created_by: "userID",
						updated_at: "date",
						updated_by: "userID"
					}
				]
			});
			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID"
				}
			]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							business_json: {
								data_businesses: {
									id: "businessID",
									name: "businessName",
									tin: "encryptedTin",
									address_line_1: "address_line_1",
									address_city: "address_city",
									address_state: "address_state",
									address_postal_code: "address_postal_code"
								}
							},
							owners_json: {
								data_owners: {
									id: "ownerID",
									name: "ownerName"
								}
							},
							owners_percentage_json: {
								rel_business_owners: {
									business_id: "businessID",
									owner_id: "ownerID"
								}
							}
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "caseID",
							status_code: CASE_STATUS.ONBOARDING
						}
					]
				},
				{
					rowCount: 0,
					rows: []
				},
				{
					rowCount: 0,
					rows: []
				}
			]);
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						status_submitted_exists: false
					}
				]
			});
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "sampleTemplateID"
					}
				]
			});

			jest.spyOn(Owners, "getOwnerTitles").mockResolvedValueOnce({ 1: { id: 1, title: "title" } } as any);

			decryptEin.mockReturnValueOnce("123121234");
			maskString.mockReturnValueOnce("XXXXX1234");
			fetchNPIDetails.mockResolvedValueOnce({
				submitted_npi: "npiID"
			});
			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([
				{
					stage_id: "787373e1-997f-4ca6-bf9a-f13593a2debd",
					stage: "Login",
					stage_code: "login",
					config: {
						fields: [
							{
								name: "Login with Email & Password",
								status: false,
								description:
									"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
								status_data_type: "Boolean"
							}
						],
						integrations: [],
						additional_settings: []
					}
				}
			]);

			convertToObject.mockReturnValueOnce({
				progressionConfigObject: {
					progressionID: {
						stage: "stage"
					}
				}
			});

			getBusinessIntegrationConnections.mockResolvedValueOnce({});
			getFlagValueByToken.mockResolvedValueOnce(false);
			const result = await businesses.getProgression(params, query, userInfo, headers);
			expect(result).toEqual(response);
		});

		it("should throw an error when another applicant tried to get the progression details of another applicant", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						business_id: "businessID",
						customer_id: "customerID",
						status: "INVITED",
						action_taken_by: "applicantID",
						case_id: "caseID",
						created_at: "date",
						created_by: "userID",
						updated_at: "date",
						updated_by: "userID"
					}
				]
			});
			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID1"
				}
			]);

			try {
				await businesses.getProgression(params, query, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.UNAUTHORIZED);
				expect(error.errorCode).toBe(ERROR_CODES.UNAUTHENTICATED);
			}
		});

		it("should throw an error when business details not found", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(undefined)
			}));
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						business_id: "businessID",
						customer_id: "customerID",
						is_submitted: false,
						status: "INVITED",
						action_taken_by: "applicantID",
						case_id: "caseID",
						created_at: "date",
						created_by: "userID",
						updated_at: "date",
						updated_by: "userID"
					}
				]
			});
			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID"
				}
			]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 0,
					rows: []
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "caseID",
							status_code: CASE_STATUS.ONBOARDING
						}
					]
				}
			]);
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						status_submitted_exists: false
					}
				]
			});
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "sampleTemplateID"
					}
				]
			});

			try {
				await businesses.getProgression(params, query, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should return ownership stage as completed when idv not enabled + all required owner details present", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(undefined)
			}));

			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([
				{
					id: 6,
					stage: "ownership",
					label: "ownership",
					prev_stage: 1,
					next_stage: 7,
					completion_weightage: 20,
					priority_order: 2,
					is_skippable: false,
					config: {
						fields: [
							{
								name: "Enable Identity Verification",
								section_name: "Identity Verification",
								status: false, // IDV disabled
								sub_fields: [
									{
										name: "Submit with Unverified Identity",
										status: false // Submit with unverified identity disabled
									}
								]
							},
							{
								name: "Full Name",
								status: "Required"
							},
							{
								name: "Email Address",
								status: "Required"
							}
						]
					}
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						business_id: "businessID",
						customer_id: "customerID",
						status: "INVITED",
						case_id: "caseID"
					}
				]
			});

			getBusinessApplicants.mockResolvedValueOnce([{ id: "applicantID" }]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							business_json: {
								data_businesses: {
									id: "businessID",
									name: "businessName",
									tin: "encryptedTin"
								}
							},
							owners_json: {
								data_owners: {
									id: "ownerID1",
									first_name: "John",
									last_name: "Doe",
									email: "john@example.com"
								}
							},
							owners_percentage_json: {
								rel_business_owners: {
									owner_type: "CONTROL",
									ownership_percentage: 100,
									external_id: "owner-external-id-123"
								}
							}
						}
					]
				},
				{
					rowCount: 1,
					rows: [{ id: "caseID", status_code: CASE_STATUS.ONBOARDING }]
				},
				{ rowCount: 0, rows: [] },
				{ rowCount: 0, rows: [] }
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ status_submitted_exists: false }]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ id: "sampleTemplateID" }]
			});

			jest.spyOn(Owners, "getOwnerTitles").mockResolvedValueOnce({ 1: { id: 1, title: "title" } } as any);

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([]);
			convertToObject.mockReturnValueOnce({});
			getBusinessIntegrationConnections.mockResolvedValueOnce({});

			const result = await businesses.getProgression(params, query, userInfo, headers);

			const ownershipStage = result.completed_stages?.find(stage => stage.stage === "ownership");
			expect(ownershipStage?.is_stage_truly_completed).toBe(true);
			expect(ownershipStage?.pre_filled_data?.owners?.[0]?.external_id).toBe("owner-external-id-123");
		});

		it("should return ownership stage as completed when idv enabled + all owners verified", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(undefined)
			}));

			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([
				{
					id: 6,
					stage: "ownership",
					label: "ownership",
					prev_stage: 1,
					next_stage: 7,
					completion_weightage: 20,
					priority_order: 2,
					is_skippable: false,
					config: {
						fields: [
							{
								name: "Enable Identity Verification",
								section_name: "Identity Verification",
								status: true, // IDV enabled
								sub_fields: [
									{
										name: "Submit with Unverified Identity",
										status: false // Submit with unverified identity disabled
									}
								]
							},
							{
								name: "Full Name",
								status: "Required"
							},
							{
								name: "Email Address",
								status: "Required"
							}
						]
					}
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						business_id: "businessID",
						customer_id: "customerID",
						status: "INVITED",
						case_id: "caseID"
					}
				]
			});

			getBusinessApplicants.mockResolvedValueOnce([{ id: "applicantID" }]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							business_json: {
								data_businesses: {
									id: "businessID",
									name: "businessName"
								}
							},
							owners_json: {
								data_owners: {
									id: "ownerID1",
									first_name: "John",
									last_name: "Doe",
									email: "john@example.com"
								}
							},
							owners_percentage_json: {
								rel_business_owners: {
									owner_type: "CONTROL",
									ownership_percentage: 100,
									external_id: "owner-external-id-123"
								}
							}
						}
					]
				},
				{
					rowCount: 1,
					rows: [{ id: "caseID", status_code: CASE_STATUS.ONBOARDING }]
				},
				{ rowCount: 0, rows: [] },
				{ rowCount: 0, rows: [] }
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ status_submitted_exists: false }]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ id: "sampleTemplateID" }]
			});

			jest.spyOn(Owners, "getOwnerTitles").mockResolvedValueOnce({ 1: { id: 1, title: "title" } } as any);

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([]);
			convertToObject.mockReturnValueOnce({});
			getBusinessIntegrationConnections.mockResolvedValueOnce({
				owner_verification: {
					is_connected: true,
					owners: [
						{ owner_id: "ownerID1", status: "SUCCESS" } // Owner is verified
					],
					connections: [{ connection_status: "SUCCESS", id: "conn1", platform_id: "plaid", platform: "plaid" }]
				}
			});

			const result = await businesses.getProgression(params, query, userInfo, headers);

			const ownershipStage = result.completed_stages?.find(stage => stage.stage === "ownership");
			expect(ownershipStage?.is_stage_truly_completed).toBe(true);
			expect(ownershipStage?.pre_filled_data?.owners?.[0]?.external_id).toBe("owner-external-id-123");
		});

		it("should add verification_status and is_owner_verified to each owner when owner_verification is connected", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(undefined)
			}));

			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([
				{
					id: 6,
					stage: "ownership",
					label: "ownership",
					prev_stage: 1,
					next_stage: 7,
					completion_weightage: 20,
					priority_order: 2,
					is_skippable: false,
					config: {
						fields: [
							{
								name: "Enable Identity Verification",
								section_name: "Identity Verification",
								status: true,
								sub_fields: [
									{
										name: "Submit with Unverified Identity",
										status: true // so stage is completed despite one owner FAILED
									}
								]
							},
							{ name: "Full Name", status: "Required" },
							{ name: "Email Address", status: "Required" }
						]
					}
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						business_id: "businessID",
						customer_id: "customerID",
						status: "INVITED",
						case_id: "caseID"
					}
				]
			});

			getBusinessApplicants.mockResolvedValueOnce([{ id: "applicantID" }]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 2,
					rows: [
						{
							business_json: {
								data_businesses: {
									id: "businessID",
									name: "businessName"
								}
							},
							owners_json: {
								data_owners: {
									id: "ownerID1",
									first_name: "John",
									last_name: "Doe",
									email: "john@example.com"
								}
							},
							owners_percentage_json: {
								rel_business_owners: {
									owner_type: "CONTROL",
									ownership_percentage: 50
								}
							}
						},
						{
							business_json: {
								data_businesses: {
									id: "businessID",
									name: "businessName"
								}
							},
							owners_json: {
								data_owners: {
									id: "ownerID2",
									first_name: "Jane",
									last_name: "Doe",
									email: "jane@example.com"
								}
							},
							owners_percentage_json: {
								rel_business_owners: {
									owner_type: "BENEFICIARY",
									ownership_percentage: 50
								}
							}
						}
					]
				},
				{
					rowCount: 1,
					rows: [{ id: "caseID", status_code: CASE_STATUS.ONBOARDING }]
				},
				{ rowCount: 0, rows: [] },
				{ rowCount: 0, rows: [] }
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ status_submitted_exists: false }]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ id: "sampleTemplateID" }]
			});

			jest.spyOn(Owners, "getOwnerTitles").mockResolvedValueOnce({ 1: { id: 1, title: "title" } } as any);

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([]);
			convertToObject.mockReturnValueOnce({});
			getBusinessIntegrationConnections.mockResolvedValueOnce({
				owner_verification: {
					is_connected: true,
					owners: [
						{ owner_id: "ownerID1", status: "SUCCESS" },
						{ owner_id: "ownerID2", status: "FAILED" }
					],
					connections: [{ connection_status: "SUCCESS", id: "conn1", platform_id: "plaid", platform: "plaid" }]
				}
			});

			const result = await businesses.getProgression(params, query, userInfo, headers);

			const ownershipStage = result.completed_stages?.find(stage => stage.stage === "ownership");
			expect(ownershipStage?.pre_filled_data?.owners).toHaveLength(2);

			const owner1 = ownershipStage?.pre_filled_data?.owners?.find((o: { id: string }) => o.id === "ownerID1");
			expect(owner1).toMatchObject({
				id: "ownerID1",
				verification_status: "SUCCESS",
				is_owner_verified: true
			});

			const owner2 = ownershipStage?.pre_filled_data?.owners?.find((o: { id: string }) => o.id === "ownerID2");
			expect(owner2).toMatchObject({
				id: "ownerID2",
				verification_status: "FAILED",
				is_owner_verified: false
			});
		});

		it("should return ownership stage as completed when idv enabled + not all owners verified + submit with unverified identity enabled", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(undefined)
			}));

			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([
				{
					id: 6,
					stage: "ownership",
					label: "ownership",
					prev_stage: 1,
					next_stage: 7,
					completion_weightage: 20,
					priority_order: 2,
					is_skippable: false,
					config: {
						fields: [
							{
								name: "Enable Identity Verification",
								section_name: "Identity Verification",
								status: true, // IDV enabled
								sub_fields: [
									{
										name: "Submit with Unverified Identity",
										status: true // Submit with unverified identity enabled
									}
								]
							},
							{
								name: "Full Name",
								status: "Required"
							},
							{
								name: "Email Address",
								status: "Required"
							}
						]
					}
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						business_id: "businessID",
						customer_id: "customerID",
						status: "INVITED",
						case_id: "caseID"
					}
				]
			});

			getBusinessApplicants.mockResolvedValueOnce([{ id: "applicantID" }]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							business_json: {
								data_businesses: {
									id: "businessID",
									name: "businessName"
								}
							},
							owners_json: {
								data_owners: {
									id: "ownerID1",
									first_name: "John",
									last_name: "Doe",
									email: "john@example.com"
								}
							},
							owners_percentage_json: {
								rel_business_owners: {
									owner_type: "CONTROL",
									ownership_percentage: 100
								}
							}
						}
					]
				},
				{
					rowCount: 1,
					rows: [{ id: "caseID", status_code: CASE_STATUS.ONBOARDING }]
				},
				{ rowCount: 0, rows: [] },
				{ rowCount: 0, rows: [] }
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ status_submitted_exists: false }]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ id: "sampleTemplateID" }]
			});

			jest.spyOn(Owners, "getOwnerTitles").mockResolvedValueOnce({ 1: { id: 1, title: "title" } } as any);

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([]);
			convertToObject.mockReturnValueOnce({});
			getBusinessIntegrationConnections.mockResolvedValueOnce({
				owner_verification: {
					is_connected: true,
					owners: [
						{ owner_id: "ownerID1", status: "FAILED" } // Owner is NOT verified
					],
					connections: [{ connection_status: "SUCCESS", id: "conn1", platform_id: "plaid", platform: "plaid" }]
				}
			});

			const result = await businesses.getProgression(params, query, userInfo, headers);

			const ownershipStage = result.completed_stages?.find(stage => stage.stage === "ownership");
			expect(ownershipStage?.is_stage_truly_completed).toBe(true);
		});

		it("should return ownership stage as not completed when idv enabled + not all owners verified + submit with unverified identity not enabled", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(undefined)
			}));

			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([
				{
					id: 6,
					stage: "ownership",
					label: "ownership",
					prev_stage: 1,
					next_stage: 7,
					completion_weightage: 20,
					priority_order: 2,
					is_skippable: false,
					config: {
						fields: [
							{
								name: "Enable Identity Verification",
								section_name: "Identity Verification",
								status: true, // IDV enabled
								sub_fields: [
									{
										name: "Submit with Unverified Identity",
										status: false // Submit with unverified identity disabled
									}
								]
							},
							{
								name: "Full Name",
								status: "Required"
							},
							{
								name: "Email Address",
								status: "Required"
							}
						]
					}
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "invitationID",
						business_id: "businessID",
						customer_id: "customerID",
						status: "INVITED",
						case_id: "caseID"
					}
				]
			});

			getBusinessApplicants.mockResolvedValueOnce([{ id: "applicantID" }]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							business_json: {
								data_businesses: {
									id: "businessID",
									name: "businessName"
								}
							},
							owners_json: {
								data_owners: {
									id: "ownerID1",
									first_name: "John",
									last_name: "Doe",
									email: "john@example.com"
								}
							},
							owners_percentage_json: {
								rel_business_owners: {
									owner_type: "CONTROL",
									ownership_percentage: 100
								}
							}
						}
					]
				},
				{
					rowCount: 1,
					rows: [{ id: "caseID", status_code: CASE_STATUS.ONBOARDING }]
				},
				{ rowCount: 0, rows: [] },
				{ rowCount: 0, rows: [] }
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ status_submitted_exists: false }]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ id: "sampleTemplateID" }]
			});

			jest.spyOn(Owners, "getOwnerTitles").mockResolvedValueOnce({ 1: { id: 1, title: "title" } } as any);

			jest.spyOn(onboarding, "getCustomerOnboardingStages").mockResolvedValue([]);
			convertToObject.mockReturnValueOnce({
				6: {
					stage: "ownership",
					label: "ownership",
					prev_stage: 1,
					next_stage: 7,
					completion_weightage: 20,
					priority_order: 2
				}
			});
			getBusinessIntegrationConnections.mockResolvedValueOnce({
				owner_verification: {
					is_connected: true,
					owners: [
						{ owner_id: "ownerID1", status: "FAILED" } // Owner is NOT verified
					],
					connections: [{ connection_status: "SUCCESS", id: "conn1", platform_id: "plaid", platform: "plaid" }]
				}
			});

			const result = await businesses.getProgression(params, query, userInfo, headers);

			// Verify ownership stage is not added to completed_stages
			const ownershipStage = result.completed_stages?.find(stage => stage.stage === "ownership");
			expect(ownershipStage).toBeUndefined();

			// If ownership is current_stage, it should not be marked as completed
			// Since current_stage is the only stage in the progressionConfig, it will be the current stage
			// This is a test hack to verify is_stage_truly_completed is false
			if (result?.current_stage?.stage === "ownership") {
				expect(result?.current_stage?.is_stage_truly_completed).toBe(false);
			}
		});

		// TODO: pending for other switch cases
	});

	describe("addOrUpdateCustomFields", () => {
		const params = {
			caseID: "businessID"
		};

		const body = {
			businessId: "businessID",
			templateId: "templateID",
			fields: [
				{
					custom_field_id: "customFieldID",
					value: "sampleValue",
					type: "sampleType"
				}
			]
		};

		const files = [];

		const userInfo = {
			user_id: "userID"
		};

		it("should not throw an error when database connection is successful", async () => {
			sqlQuery
				.mockResolvedValueOnce({
					rowCount: 0,
					rows: []
				})
				.mockResolvedValueOnce({
					rowCount: 0,
					rows: []
				})
				.mockResolvedValueOnce({
					rowCount: 1,
					rows: [{}]
				});

			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				leftJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ customer_id: "mocked_customer_id" })
			}));
			await expect(businesses.addOrUpdateCustomFields(params, body, files, userInfo)).resolves.not.toThrow();
		});

		it.skip("should handle missing or invalid file uploads", async () => {
			const invalidFileUploadBody = {
				businessId: "businessID",
				templateId: "templateID",
				fields: [
					{
						customer_field_id: "customFieldID",
						value: "file1.jpg",
						type: "upload"
					}
				]
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ section_name: "test-section" }]
			});

			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ customer_id: "mocked_customer_id" })
			}));

			sqlQuery.mockResolvedValueOnce({ rowCount: 0 });
			sqlTransaction.mockResolvedValueOnce({});

			await expect(
				businesses.addOrUpdateCustomFields(params, invalidFileUploadBody, files, userInfo)
			).resolves.not.toThrow();
		});

		it.skip("should handle valid file uploads", async () => {
			const validFileUploadBody = {
				businessId: "businessID",
				templateId: "templateID",
				fields: [
					{
						customer_field_id: "customFieldID",
						value: "",
						type: "upload"
					}
				]
			};

			const files = [
				{
					fieldname: "fields[0][value]",
					buffer: Buffer.from("test file content"),
					originalname: "testfile.txt"
				}
			];

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ section_name: "test-section" }]
			});

			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ customer_id: "mocked_customer_id" })
			}));

			sqlQuery.mockResolvedValueOnce({ rowCount: 0 });
			sqlTransaction.mockResolvedValueOnce({});

			await expect(
				businesses.addOrUpdateCustomFields(params, validFileUploadBody, files, userInfo)
			).resolves.not.toThrow();
		});

		it("should handle SQL errors gracefully", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ customer_id: "mocked_customer_id" })
			}));

			sqlQuery.mockRejectedValueOnce(new Error("SQL error"));

			await expect(businesses.addOrUpdateCustomFields(params, body, files, userInfo)).rejects.toThrow("SQL error");
		});

		it.skip("should update existing custom fields", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ customer_id: "mocked_customer_id" })
			}));

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ section_name: "test-section" }]
			});

			sqlQuery.mockResolvedValueOnce({ rowCount: 1 });
			sqlTransaction.mockResolvedValueOnce({});

			await expect(businesses.addOrUpdateCustomFields(params, body, files, userInfo)).resolves.not.toThrow();
		});

		it.skip("should insert new custom fields", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ customer_id: "mocked_customer_id" })
			}));

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ section_name: "test-section" }]
			});

			sqlQuery.mockResolvedValueOnce({ rowCount: 0 });
			sqlTransaction.mockResolvedValueOnce({});

			await expect(businesses.addOrUpdateCustomFields(params, body, files, userInfo)).resolves.not.toThrow();
		});
	});

	// TODO: pending as we are not using it anymore
	// covering only to increase the coverage
	describe("updateOrLinkBusiness", () => {
		const params = {
			businessID: "businessID"
		};

		const body = {
			tin: "tin",
			name: "businessName"
		};

		const userInfo = {
			user_id: "userID"
		};

		const headers = {
			authorization: "Bearer token"
		};

		const response = {
			data: {
				business_id: "businessID"
			},
			message: "Your business is now verified."
		};

		it("should mark the new business as verified", async () => {
			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 0,
					rows: []
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "businessID",
							status: BUSINESS_STATUS.UNVERIFIED
						}
					]
				}
			]);

			sqlQuery.mockResolvedValueOnce({});

			producer.send.mockResolvedValueOnce({});

			const result = await businesses.updateOrLinkBusiness(body, params, userInfo, headers);

			expect(result).toEqual(response);
		});

		it("should update business-id and return it for the applicant lined to business with existing TIN", async () => {
			const sampleResponse = {
				data: {
					business_id: "existingBusinessID",
					is_business_applicant: true
				},
				message: "Your business was linked with an existing business with the matching TIN number"
			};

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							id: "existingBusinessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "businessID",
							status: BUSINESS_STATUS.UNVERIFIED
						}
					]
				}
			]);

			getApplicantByID.mockResolvedValueOnce({
				subroles: [
					{
						business_id: "existingBusinessID",
						code: "owner",
						status: "ACTIVE"
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						customer_id: "customerID"
					}
				]
			});

			sqlTransaction.mockResolvedValueOnce();

			const result = await businesses.updateOrLinkBusiness(body, params, userInfo, headers);

			expect(result).toEqual(sampleResponse);
		});

		it("should return authentication required if applicant is not linked to business with existing TIN", async () => {
			const sampleResponse = {
				data: {
					business_id: "existingBusinessID",
					is_business_applicant: false,
					customer_id: "customerID",
					owner_email: "email@applicant.com",
					owner_id: "applicantID",
					requestee_id: "userID"
				},
				message: "Authentication reuired"
			};

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [
						{
							id: "existingBusinessID"
						}
					]
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "businessID",
							status: BUSINESS_STATUS.UNVERIFIED
						}
					]
				}
			]);

			getApplicantByID.mockResolvedValueOnce({
				subroles: [
					{
						business_id: "businessID",
						code: "owner",
						status: "ACTIVE"
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						customer_id: "customerID"
					}
				]
			});

			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID",
					code: "owner",
					email: "email@applicant.com"
				}
			]);

			const result = await businesses.updateOrLinkBusiness(body, params, userInfo, headers);

			expect(result).toEqual(sampleResponse);
		});

		it("should throw an error if current business not found", async () => {
			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 0,
					rows: []
				},
				{
					rowCount: 0,
					rows: []
				}
			]);

			try {
				await businesses.updateOrLinkBusiness(body, params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});

		it("should throw an error when current business is already verified", async () => {
			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 0,
					rows: []
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "businessID",
							status: BUSINESS_STATUS.VERIFIED
						}
					]
				}
			]);

			try {
				await businesses.updateOrLinkBusiness(body, params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});

	describe("acceptInvitation", () => {
		const params = {
			invitationID: "invitationID"
		};

		const userInfo = {
			user_id: "userID"
		};

		const response = {
			message: "Invite accepted successfully"
		};

		it("should accept the invitation for verified business", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			jest.spyOn(caseManagementService, "createCaseFromEgg").mockResolvedValue({
				id: "caseID"
			});
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: INVITE_STATUS_ENUM.INVITED,
						customer_id: "customerID",
						status: BUSINESS_STATUS.VERIFIED,
						case_id: null
					}
				]
			});

			const result = await businesses.acceptInvitation(params, userInfo);

			expect(result).toEqual(response);
		});

		it("should accept the invitation for unverified business", async () => {
			jest.spyOn(businesses, "getProgressionConfig").mockResolvedValueOnce([]);
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: INVITE_STATUS_ENUM.INVITED,
						customer_id: "customerID",
						status: BUSINESS_STATUS.UNVERIFIED,
						case_id: null,
						address_country: "USA"
					}
				]
			});

			jest.spyOn(caseManagementService, "createCaseFromEgg").mockResolvedValueOnce({ id: "mock-case-id" });

			const sampleResponse = {
				message: "Invite accepted successfully"
			};

			const result = await businesses.acceptInvitation(params, userInfo);

			expect(result).toEqual(sampleResponse);
		});

		it("should throw an error when invitation not found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			try {
				await businesses.acceptInvitation(params, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});

		it("should throw an error when invitation is expired", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: INVITE_STATUS_ENUM.EXPIRED,
						customer_id: "customerID",
						status: BUSINESS_STATUS.VERIFIED,
						case_id: null
					}
				]
			});

			try {
				await businesses.acceptInvitation(params, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should return invitation already accepted if status is accepted", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						invitation_status: INVITE_STATUS_ENUM.ACCEPTED,
						customer_id: "customerID",
						status: BUSINESS_STATUS.VERIFIED,
						case_id: null
					}
				]
			});

			const sampleResponse = {
				message: "Invitation is already accepted"
			};

			const result = await businesses.acceptInvitation(params, userInfo);

			expect(result).toEqual(sampleResponse);
		});
	});

	describe("singleBusinessEncryption", () => {
		const body = {
			table_name: "tableName",
			column_name: "columnName"
		};

		const params = {
			businessID: "businessID"
		};

		it("should decrypt the existing data", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "ID",
						data: "data"
					}
				]
			});

			encryptEin.mockReturnValueOnce("encryptedData");

			sqlQuery.mockResolvedValueOnce({});

			await businesses.singleBusinessEncryption(params, body);
		});

		it("should throw an error when data not found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			try {
				await businesses.singleBusinessEncryption(params, body);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});
	});

	describe("triggerEventToRefreshScore", () => {
		const userInfo = { user_id: "user_id" };
		const body = {
			businessID: "businessID",
			customerID: "customerID"
		};

		it("shoud throw an error when no business found", async () => {
			getCustomersInternal.mockResolvedValueOnce({
				records: [
					{
						id: "sampleUserID",
						customer_details: {
							id: "customerID",
							name: "sampleCustomerName"
						}
					}
				],
				total_items: 1,
				total_pages: 1
			});

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 0
				},
				{
					rowCount: 0
				}
			]);
			try {
				await businesses.triggerEventToRefreshScore(body, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});

		it("should send REFRESH_BUSINESS_SCORE event to refresh score", async () => {
			getCustomersInternal.mockResolvedValueOnce({
				records: [
					{
						id: "sampleUserID",
						customer_details: {
							id: "customerID",
							name: "sampleCustomerName"
						}
					}
				],
				total_items: 1,
				total_pages: 1
			});

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1
				},
				{
					rowCount: 0
				}
			]);

			producer.send.mockResolvedValueOnce({});

			await businesses.triggerEventToRefreshScore("businessID", "customerID");
			const payload = producer.send.mock.calls[0][0];

			expect(payload.topic).toBe("scores.v1");
			expect(payload.messages).toStrictEqual([
				{
					key: "businessID",
					value: {
						event: "refresh_business_score_event",
						business_id: "businessID",
						customer_id: "customerID",
						trigger_type: "MANUAL_REFRESH"
					}
				}
			]);
		});
	});

	describe("getBusinessByExternalId", () => {
		const response = {
			customer_id: "customerID",
			external_id: "externalID",
			metadata: "",
			is_monitoring_enabled: "true"
		};
		it("should return the data", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				leftJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockResolvedValue({
					customer_id: "customerID",
					external_id: "externalID",
					metadata: "",
					is_monitoring_enabled: "true"
				})
			}));

			const result = await businesses.getBusinessByExternalId({ external_id: "externalID" });
			expect(result).toEqual(response);
		});
	});

	describe("getCustomersByBusinessId", () => {
		it("should return the data when present", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockResolvedValue([
					{
						customer_id: "customerID"
					}
				])
			}));

			const result = await businesses.getCustomersByBusinessId("businessID");
			expect(result).toEqual([{ customer_id: "customerID" }]);
		});

		it("should return empty array when no data is present", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockResolvedValue([{}])
			}));

			const result = await businesses.getCustomersByBusinessId("businessID");
			expect(result).toEqual([{}]);
		});
	});

	describe("getCustomerByCaseId", () => {
		it("should return the customer_id when present", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				leftJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockResolvedValue([
					{
						customer_id: "customerID"
					}
				])
			}));

			const result = await businesses.getCustomerByCaseId("caseID");
			expect(result).toEqual("customerID");
		});

		it("should return null when customer_id is not present", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				leftJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockResolvedValue([{}])
			}));

			const result = await businesses.getCustomerByCaseId("caseID");
			expect(result).toEqual(null);
		});
	});

	describe("getCaseDetailsById", () => {
		it("should return object with data when present", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				leftJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockResolvedValue([
					{
						customer_id: "customerID"
					}
				])
			}));

			const result = await businesses.getCaseDetailsById("caseID");
			expect(result).toEqual({ customer_id: "customerID" });
		});

		it("should return empty object when data is not present", async () => {
			db.mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				join: jest.fn().mockReturnThis(),
				leftJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockResolvedValue([{}])
			}));

			const result = await businesses.getCaseDetailsById("caseID");
			expect(result).toEqual({});
		});
	});
});
