import { sqlQuery } from "#helpers/index";
import { BusinessEntityVerificationService } from "../businessEntityVerification";
import { getDummyMiddeskResponse } from "#utils/faker";
import type { IBusinessEntityAddressSource, IBusinessEntityRegistration, IBusinessEntityReviewTask } from "#types/db";
import type {
	BusinessEntityAddress,
	BusinessEntityRegistration,
	BusinessEntityReviewTask,
	BusinessEntityWebsiteResponse
} from "#lib/middesk";
import { CONNECTION_STATUS, INTEGRATION_ID, TASK_STATUS } from "#constants";
import { verification } from "../verification";

require("kafkajs");

jest.mock("jsonwebtoken");
jest.mock("#helpers/index");
jest.mock("#helpers/api", () => ({
	getBusinessDetails: jest.fn()
}));
jest.mock("#common/common");
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

jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

describe("Verification Module", () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("getBusinessEntityVerificationResponse", () => {
		it("Properly detect a mocked middesk response", async () => {
			const fakeBusinessEntityVerification = getDummyMiddeskResponse({
				unique_external_id: "00000000-0000-0000-0000-000000000000",
				business_id: "99999999-9999-9999-9999-999999999999",
				business_name: "Test Business",
				tin: "123456789"
			});

			const businessEntityVerificationId = "00000000-0000-1111-0000-000000000000";

			const reviewTasks: IBusinessEntityReviewTask[] = (
				(fakeBusinessEntityVerification.data.object as any).review.tasks as BusinessEntityReviewTask[]
			).map(
				(task: BusinessEntityReviewTask) =>
					task &&
					({
						id: "00000000-0000-0000-0000-000000000000",
						created_at: "2024-01-01T12:00:00.000Z",
						updated_at: "2024-01-01T12:00:00.000Z",
						category: task.category,
						key: task.key,
						status: task.status,
						message: task.message,
						label: task.label,
						sublabel: task.sub_label,
						metadata: task.sources,
						business_entity_verification_id: businessEntityVerificationId
					} as IBusinessEntityReviewTask)
			);
			const addressSources: IBusinessEntityAddressSource[] = (
				(fakeBusinessEntityVerification.data.object as any).addresses as BusinessEntityAddress[]
			).map(
				address =>
					address &&
					({
						id: "00000000-0000-0000-0000-000000000000",
						created_at: "2024-01-01T12:00:00.000Z",
						updated_at: "2024-01-01T12:00:00.000Z",
						vendor_registration_id: "a-b-c-d-e",
						address: address.full_address,
						business_entity_verification_id: businessEntityVerificationId,
						external_id: address.id,
						full_address: address.full_address,
						address_line_1: address.address_line1,
						address_line_2: address.address_line2,
						city: address.city,
						state: address.state,
						postal_code: address.postal_code,
						country: "United States", // Add country property with default value
						lat: address.latitude,
						long: address.longitude,
						submitted: address.submitted,
						deliverable: address.deliverable,
						cmra: address.cmra,
						address_property_type: address.property_type
					} as IBusinessEntityAddressSource)
			);
			const registrations: IBusinessEntityRegistration[] = (
				(fakeBusinessEntityVerification.data.object as any).registrations as BusinessEntityRegistration[]
			).map(
				registration =>
					registration &&
					({
						id: "00000000-0000-0000-0000-000000000000",
						created_at: "2024-01-01T12:00:00.000Z",
						updated_at: "2024-01-01T12:00:00.000Z",
						business_entity_verification_id: businessEntityVerificationId,
						registration: registration.entity_type,
						external_id: registration.id,
						name: registration.name,
						status: registration.status,
						sub_status: registration.sub_status,
						status_details: registration.status_details,
						jurisdiction: registration.jurisdiction,
						entity_type: registration.entity_type,
						file_number: registration.file_number,
						full_addresses: registration.addresses,
						registration_date: registration.registration_date,
						registration_state: registration.state,
						source: registration.source
					} as IBusinessEntityRegistration)
			);

			const service = new BusinessEntityVerificationService({
				id: "00000000-0000-0000-0000-000000000000",
				created_at: "2024-01-01T12:00:00.000Z",
				updated_at: "2024-01-01T12:00:00.000Z",
				business_id: "00000000-0000-0000-0000-000000000000",
				platform_id: 1,
				connection_status: CONNECTION_STATUS.SUCCESS,
				configuration: {}
			});
			// Spy on service to mock responses
			const taskSpy = jest.spyOn(service as any, "getReviewTasks");
			const addressSourceSpy = jest.spyOn(service as any, "getAddressSources");
			const registrationSpy = jest.spyOn(service as any, "getRegistrations");
			taskSpy.mockResolvedValueOnce(reviewTasks);
			addressSourceSpy.mockResolvedValueOnce(addressSources);
			registrationSpy.mockResolvedValueOnce(registrations);

			const result = await (service as any).getBusinessEntityVerificationComponents({ businessEntityVerificationId });
			expect(taskSpy).toHaveBeenCalled();
			expect(addressSourceSpy).toHaveBeenCalled();
			expect(registrationSpy).toHaveBeenCalled();
			const isMockedWithFlag = BusinessEntityVerificationService.isMockedResponse(result);
			expect(isMockedWithFlag).toEqual(true);

			// mutate 'result' to remove the is_mock flag
			result.reviewTasks.forEach(task => (task.metadata[0].metadata.is_mock = false));
			const isMockedWithoutFlag = BusinessEntityVerificationService.isMockedResponse(result);
			expect(isMockedWithoutFlag).toEqual(true);
		});
	});

	describe("website verification", () => {
		const businessID = "00000000-0000-0000-0000-000000000000";
		const id = "00000000-0000-0000-1111-000000000000";

		const mockWebsiteResponse = {
			object: "website",
			id,
			business_id: businessID,
			url: "https://www.example.com",
			status: "active",
			title: "Google",
			description: "google",
			domain: {
				domain: "google.com",
				creation_date: null,
				expiration_date: null,
				registrar: "my registration"
			},
			pages: [
				{
					category: "home",
					url: "https://www.google.com",
					text: "random page",
					screenshot_url: "https://www.google.com/image.png"
				}
			],
			parked: false,
			business_name_match: true,
			addresses: [],
			phone_numbers: []
		} as BusinessEntityWebsiteResponse;

		it("should handle empty creation and expiration dates", async () => {
			const connectionID = "00000000-0000-0000-1111-000000000000";
			const taskID = "00000000-2222-0000-0000-000000000000";
			const service = new BusinessEntityVerificationService({
				id: connectionID,
				created_at: "2024-01-01T12:00:00.000Z",
				updated_at: "2024-01-01T12:00:00.000Z",
				business_id: businessID,
				platform_id: INTEGRATION_ID.MIDDESK,
				connection_status: CONNECTION_STATUS.SUCCESS,
				configuration: {}
			});
			await service.insertBusinessEntityWebsiteDetails(businessID, mockWebsiteResponse, {
				id: taskID,
				created_at: "2024-01-01T12:00:00.000Z",
				updated_at: "2024-01-01T12:00:00.000Z",
				business_id: businessID,
				platform_id: INTEGRATION_ID.MIDDESK,
				platform_code: "middesk",
				task_code: "fetch_business_entity_website_details",
				connection_id: connectionID,
				task_status: TASK_STATUS.IN_PROGRESS,
				platform_category_code: "VERIFICATION",
				task_label: "fetch",
				integration_task_id: 40
			});
			// Mock sqlQuery
			(sqlQuery as jest.Mock).mockResolvedValueOnce({});
			expect(sqlQuery).toHaveBeenCalled();
			expect(sqlQuery).toHaveBeenCalledWith({
				sql: expect.any(String),
				values: [
					taskID,
					businessID,
					mockWebsiteResponse.url,
					mockWebsiteResponse.domain.creation_date,
					mockWebsiteResponse.domain.expiration_date,
					mockWebsiteResponse.pages[0].category,
					mockWebsiteResponse.pages[0].url,
					mockWebsiteResponse.pages[0].text,
					mockWebsiteResponse.pages[0].screenshot_url,
					mockWebsiteResponse
				]
			});

			expect(mockWebsiteResponse.domain.creation_date).toBeNull();
			expect(mockWebsiteResponse.domain.expiration_date).toBeNull();
		});
	});

	describe("fetchDoctorsDetails", () => {
		const mockDoctorsData = [
			{
				name: "Dr. John Smith",
				npi_id: "1234567890",
				specialty: "Cardiology",
				years_of_experience: 15,
				doctor_licenses: [
					{
						id: "f884774e-18c6-4989-bde0-db4624dbe6bf",
						name: "DONALD T TRIMBLE D.O.",
						lender: "51154836-38bb-4398-bbe1-58076eb6aef5",
						npi_id: "1043216864",
						created_at: "2025-05-10T00:20:56.104220Z",
						updated_at: "2025-08-01T03:16:46.667582Z",
						verifications: [],
						license_number: "OS7179",
						license_taxonomy_code: "207X00000X",
						primary_taxonomy_switch: "Y",
						license_number_state_code: "FL"
					}
				],
				reviews: {
					WebMD: {
						source_url: "https://doctor.webmd.com/doctor/donald-trimble-420c5f40-61f9-43ec-a767-2d68b1393b4c-overview",
						doctor_reviews: []
					},
					Vitals: {
						source_url: "https://doctor.webmd.com/doctor/donald-trimble-420c5f40-61f9-43ec-a767-2d68b1393b4c-overview",
						doctor_reviews: []
					}
				}
			},
			{
				name: "Dr. Jane Doe",
				npi_id: "0987654321",
				specialty: "Pediatrics",
				years_of_experience: 8,
				doctor_licenses: [
					{
						id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
						name: "JANE DOE M.D.",
						lender: "98765432-1234-5678-9abc-def123456789",
						npi_id: "0987654321",
						created_at: "2025-03-15T08:30:22.456789Z",
						updated_at: "2025-07-20T14:25:18.123456Z",
						verifications: [],
						license_number: "MD67890",
						license_taxonomy_code: "208000000X",
						primary_taxonomy_switch: "Y",
						license_number_state_code: "NY"
					}
				],
				reviews: {
					WebMD: {
						source_url: "https://doctor.webmd.com/doctor/jane-doe-987c4d21-34f6-48ec-b123-5e89f2567890-overview",
						doctor_reviews: []
					},
					Vitals: {
						source_url: "https://doctor.webmd.com/doctor/jane-doe-987c4d21-34f6-48ec-b123-5e89f2567890-overview",
						doctor_reviews: []
					}
				}
			}
		];

		beforeEach(() => {
			jest.resetAllMocks();
		});

		it("should fetch doctors details by case_id", async () => {
			const mockResult = { doctors: JSON.stringify(mockDoctorsData) };
			const mockDbQuery = {
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockResult)
			};

			// Mock the db function from helpers
			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = { case_id: "test-case-id" };
			const query = { doctor_licenses: true, reviews: true };

			const result = await verification.fetchDoctorsDetails(body, query);

			expect(db).toHaveBeenCalledWith({ dc: "public.data_cases" });
			expect(mockDbQuery.join).toHaveBeenCalledWith(
				"integrations.data_business_integrations_tasks as dbit",
				"dc.score_trigger_id",
				"dbit.business_score_trigger_id"
			);
			expect(mockDbQuery.join).toHaveBeenCalledWith(
				"integration_data.request_response as rr",
				"dbit.id",
				"rr.request_id"
			);
			expect(mockDbQuery.where).toHaveBeenCalledWith("dc.id", "test-case-id");
			expect(mockDbQuery.where).toHaveBeenCalledWith("rr.platform_id", 4); // INTEGRATION_ID.VERDATA
			expect(result).toEqual([
				{
					name: "Dr. John Smith",
					npi_id: "1234567890",
					specialty: "Cardiology",
					years_of_experience: 15,
					doctor_licenses: [
						{
							id: "f884774e-18c6-4989-bde0-db4624dbe6bf",
							name: "DONALD T TRIMBLE D.O.",
							lender: "51154836-38bb-4398-bbe1-58076eb6aef5",
							npi_id: "1043216864",
							created_at: "2025-05-10T00:20:56.104220Z",
							updated_at: "2025-08-01T03:16:46.667582Z",
							verifications: [],
							license_number: "OS7179",
							license_taxonomy_code: "207X00000X",
							primary_taxonomy_switch: "Y",
							license_number_state_code: "FL"
						}
					],
					reviews: {
						WebMD: {
							source_url:
								"https://doctor.webmd.com/doctor/donald-trimble-420c5f40-61f9-43ec-a767-2d68b1393b4c-overview",
							doctor_reviews: []
						},
						Vitals: {
							source_url:
								"https://doctor.webmd.com/doctor/donald-trimble-420c5f40-61f9-43ec-a767-2d68b1393b4c-overview",
							doctor_reviews: []
						}
					}
				},
				{
					name: "Dr. Jane Doe",
					npi_id: "0987654321",
					specialty: "Pediatrics",
					years_of_experience: 8,
					doctor_licenses: [
						{
							id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
							name: "JANE DOE M.D.",
							lender: "98765432-1234-5678-9abc-def123456789",
							npi_id: "0987654321",
							created_at: "2025-03-15T08:30:22.456789Z",
							updated_at: "2025-07-20T14:25:18.123456Z",
							verifications: [],
							license_number: "MD67890",
							license_taxonomy_code: "208000000X",
							primary_taxonomy_switch: "Y",
							license_number_state_code: "NY"
						}
					],
					reviews: {
						WebMD: {
							source_url: "https://doctor.webmd.com/doctor/jane-doe-987c4d21-34f6-48ec-b123-5e89f2567890-overview",
							doctor_reviews: []
						},
						Vitals: {
							source_url: "https://doctor.webmd.com/doctor/jane-doe-987c4d21-34f6-48ec-b123-5e89f2567890-overview",
							doctor_reviews: []
						}
					}
				}
			]);
		});

		it("should fetch doctors details by score_trigger_id", async () => {
			const mockResult = { doctors: mockDoctorsData };
			const mockDbQuery = {
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockResult)
			};

			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = { score_trigger_id: "test-score-trigger-id" };
			const query = { doctor_licenses: false, reviews: false };

			const result = await verification.fetchDoctorsDetails(body, query);

			expect(db).toHaveBeenCalledWith({ dbit: "integrations.data_business_integrations_tasks" });
			expect(mockDbQuery.join).toHaveBeenCalledWith(
				"integration_data.request_response as rr",
				"dbit.id",
				"rr.request_id"
			);
			expect(mockDbQuery.where).toHaveBeenCalledWith("dbit.business_score_trigger_id", "test-score-trigger-id");
			expect(result).toEqual([
				{
					name: "Dr. John Smith",
					npi_id: "1234567890",
					specialty: "Cardiology",
					years_of_experience: 15
				},
				{
					name: "Dr. Jane Doe",
					npi_id: "0987654321",
					specialty: "Pediatrics",
					years_of_experience: 8
				}
			]);
		});

		it("should fetch doctors details by business_id", async () => {
			const mockResult = { doctors: mockDoctorsData };
			const mockDbQuery = {
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockResult)
			};

			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = { business_id: "test-business-id" };
			const query = { doctor_licenses: true, reviews: false };

			const result = await verification.fetchDoctorsDetails(body, query);

			expect(db).toHaveBeenCalledWith({ rr: "integration_data.request_response" });
			expect(mockDbQuery.where).toHaveBeenCalledWith("rr.business_id", "test-business-id");
			expect(result).toEqual([
				{
					name: "Dr. John Smith",
					npi_id: "1234567890",
					specialty: "Cardiology",
					years_of_experience: 15,
					doctor_licenses: [
						{
							id: "f884774e-18c6-4989-bde0-db4624dbe6bf",
							name: "DONALD T TRIMBLE D.O.",
							lender: "51154836-38bb-4398-bbe1-58076eb6aef5",
							npi_id: "1043216864",
							created_at: "2025-05-10T00:20:56.104220Z",
							updated_at: "2025-08-01T03:16:46.667582Z",
							verifications: [],
							license_number: "OS7179",
							license_taxonomy_code: "207X00000X",
							primary_taxonomy_switch: "Y",
							license_number_state_code: "FL"
						}
					]
				},
				{
					name: "Dr. Jane Doe",
					npi_id: "0987654321",
					specialty: "Pediatrics",
					years_of_experience: 8,
					doctor_licenses: [
						{
							id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
							name: "JANE DOE M.D.",
							lender: "98765432-1234-5678-9abc-def123456789",
							npi_id: "0987654321",
							created_at: "2025-03-15T08:30:22.456789Z",
							updated_at: "2025-07-20T14:25:18.123456Z",
							verifications: [],
							license_number: "MD67890",
							license_taxonomy_code: "208000000X",
							primary_taxonomy_switch: "Y",
							license_number_state_code: "NY"
						}
					]
				}
			]);
		});

		it("should return empty array when no query parameters provided", async () => {
			const body = {};
			const query = {};

			const result = await verification.fetchDoctorsDetails(body, query);

			expect(result).toEqual([]);
		});

		it("should return empty array when database query returns no result", async () => {
			const mockDbQuery = {
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(null)
			};

			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = { case_id: "non-existent-case-id" };
			const query = {};

			const result = await verification.fetchDoctorsDetails(body, query);

			expect(result).toEqual([]);
		});

		it("should return empty array when doctors field is null", async () => {
			const mockResult = { doctors: null };
			const mockDbQuery = {
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockResult)
			};

			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = { case_id: "test-case-id" };
			const query = {};

			const result = await verification.fetchDoctorsDetails(body, query);

			expect(result).toEqual([]);
		});

		it("should handle doctors data as string and parse it correctly", async () => {
			const mockResult = { doctors: JSON.stringify(mockDoctorsData) };
			const mockDbQuery = {
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockResult)
			};

			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = { case_id: "test-case-id" };
			const query = {};

			const result = await verification.fetchDoctorsDetails(body, query);

			expect(result).toEqual([
				{
					name: "Dr. John Smith",
					npi_id: "1234567890",
					specialty: "Cardiology",
					years_of_experience: 15
				},
				{
					name: "Dr. Jane Doe",
					npi_id: "0987654321",
					specialty: "Pediatrics",
					years_of_experience: 8
				}
			]);
		});

		it("should handle doctors with missing fields gracefully", async () => {
			const incompleteDoctorsData = [
				{
					name: "Dr. Incomplete"
					// missing npi_id, specialty, years_of_experience
				},
				{
					npi_id: "1111111111",
					specialty: "Neurology"
					// missing name, years_of_experience
				}
			];

			const mockResult = { doctors: incompleteDoctorsData };
			const mockDbQuery = {
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockResult)
			};

			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = { case_id: "test-case-id" };
			const query = { doctor_licenses: true, reviews: true };

			const result = await verification.fetchDoctorsDetails(body, query);

			expect(result).toEqual([
				{
					name: "Dr. Incomplete",
					npi_id: null,
					specialty: null,
					years_of_experience: null,
					doctor_licenses: [],
					reviews: []
				},
				{
					name: null,
					npi_id: "1111111111",
					specialty: "Neurology",
					years_of_experience: null,
					doctor_licenses: [],
					reviews: []
				}
			]);
		});

		it("should handle invalid JSON string gracefully", async () => {
			const mockResult = { doctors: "invalid json string" };
			const mockDbQuery = {
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockResult)
			};

			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = { case_id: "test-case-id" };
			const query = {};

			const result = await verification.fetchDoctorsDetails(body, query);

			expect(result).toEqual([]);
		});

		it("should prioritize case_id over score_trigger_id and business_id", async () => {
			const mockResult = { doctors: mockDoctorsData };
			const mockDbQuery = {
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockResult)
			};

			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = {
				case_id: "test-case-id",
				score_trigger_id: "test-score-trigger-id",
				business_id: "test-business-id"
			};
			const query = {};

			const result = await verification.fetchDoctorsDetails(body, query);

			// Should use case_id query path
			expect(db).toHaveBeenCalledWith({ dc: "public.data_cases" });
			expect(mockDbQuery.where).toHaveBeenCalledWith("dc.id", "test-case-id");
			expect(result).toHaveLength(2);
		});

		it("should prioritize score_trigger_id over business_id when case_id is not provided", async () => {
			const mockResult = { doctors: mockDoctorsData };
			const mockDbQuery = {
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockResult)
			};

			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = {
				score_trigger_id: "test-score-trigger-id",
				business_id: "test-business-id"
			};
			const query = {};

			const result = await verification.fetchDoctorsDetails(body, query);

			// Should use score_trigger_id query path
			expect(db).toHaveBeenCalledWith({ dbit: "integrations.data_business_integrations_tasks" });
			expect(mockDbQuery.where).toHaveBeenCalledWith("dbit.business_score_trigger_id", "test-score-trigger-id");
			expect(result).toHaveLength(2);
		});

		it("should handle database error gracefully", async () => {
			const mockDbQuery = {
				join: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				first: jest.fn().mockRejectedValue(new Error("Database connection failed"))
			};

			const { db } = require("#helpers/index");
			db.mockReturnValue(mockDbQuery);
			db.raw = jest.fn(sql => sql);

			const body = { case_id: "test-case-id" };
			const query = {};

			await expect(verification.fetchDoctorsDetails(body, query)).rejects.toThrow("Database connection failed");
		});
	});

	describe("canIRun() - Routing Logic", () => {
		let businessEntityVerification: BusinessEntityVerificationService;
		const mockBusinessId = "00000000-0000-0000-0000-000000000000" as const;
		let mockGetBusinessDetails: jest.MockedFunction<any>;

		beforeEach(() => {
			businessEntityVerification = new BusinessEntityVerificationService();
			const { getBusinessDetails } = require("#helpers/api");
			mockGetBusinessDetails = getBusinessDetails;
			mockGetBusinessDetails.mockClear();
		});

		it("should return true for US businesses (Middesk behavior)", async () => {
			// Mock getBusinessDetails to return US business
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "US",
					name: "Test US Business"
				}
			});

			const result = await BusinessEntityVerificationService.canIRun(mockBusinessId);

			expect(result).toBe(true);
			expect(mockGetBusinessDetails).toHaveBeenCalledWith(mockBusinessId);
		});

		it("should return false for non-US countries (international)", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "GB", // UK
					name: "Test UK Business"
				}
			});

			const result = await BusinessEntityVerificationService.canIRun(mockBusinessId);

			expect(result).toBe(false);
		});

		it("should return true when business details fetch fails", async () => {
			mockGetBusinessDetails.mockRejectedValue(new Error("API Error"));

			const result = await BusinessEntityVerificationService.canIRun(mockBusinessId);

			expect(result).toBe(true);
		});

		it("should return true when business data is null", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: null
			});

			const result = await BusinessEntityVerificationService.canIRun(mockBusinessId);

			expect(result).toBe(true);
		});

		it("should return false when country is empty string", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "",
					name: "Test Business"
				}
			});

			const result = await BusinessEntityVerificationService.canIRun(mockBusinessId);

			expect(result).toBe(false);
		});
	});
});
