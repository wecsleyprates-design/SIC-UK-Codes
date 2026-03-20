import { ERROR_CODES, kafkaEvents, kafkaTopics } from "#constants/index";
import { logger, producer, sqlTransaction } from "#helpers/index";
import { StatusCodes } from "http-status-codes";
import { KafkaHandlerError } from "../error";
import { I360Report } from "../types";
import { reportEventsHandler } from "../report";
import { relatedBusinesses } from "../../../../../api/v1/modules/businesses/relatedBusinesses";

jest.mock("#helpers/index", () => {
	const originalHelpers = jest.requireActual("#helpers/index");
	return {
		...originalHelpers,
		sqlTransaction: jest.fn(),
		producer: {
			send: jest.fn()
		},
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn()
		},
		getFlagValue: jest.fn().mockResolvedValue(false),
		BullQueue: jest.fn().mockImplementation(() => {
			return {};
		})
	};
});

jest.mock("#configs/index", () => {
	const { Partitioners } = require("kafkajs");
	return {
		envConfig: {
			KAFKA_BROKERS: "mocked_brokers",
			KAFKA_SSL_ENABLED: false,
			KAFKA_CLIENT_ID: "mocked_client_id",
			LD_SDK_KEY: "mock_ld_sdk_key"
		},
		kafkaConfig: {},
		consumerConfig: { groupId: "testGroupId" },
		producerConfig: {
			createPartitioner: Partitioners.LegacyPartitioner
		}
	};
});

jest.mock("../../../../../api/v1/modules/businesses/relatedBusinesses", () => {
	return {
		relatedBusinesses: {
			getRelatedBusinesses: jest.fn()
		}
	};
});

describe("ReportEventsHandler", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("_getCompanyOverview", () => {
		const mockPayload: I360Report = {
			report_id: "123e4567-e89b-12d3-a456-426614174000",
			business_id: "123e4567-e89b-12d3-a456-426614174001",
			case_id: "123e4567-e89b-12d3-a456-426614174002",
			score_trigger_id: "123e4567-e89b-12d3-a456-426614174003",
			customer_id: "123e4567-e89b-12d3-a456-426614174004"
		};

		it("should throw an error if business is not found", async () => {
			(sqlTransaction as jest.Mock).mockResolvedValueOnce([{ rowCount: 0, rows: [] }]);

			await expect(reportEventsHandler._getCompanyOverview(mockPayload)).rejects.toThrow(
				new KafkaHandlerError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND)
			);

			expect(sqlTransaction).toHaveBeenCalledTimes(1);
		});

		it("should return company overview with ownership details when business is found", async () => {
			const mockBusinessData = [
				{
					id: "business-id-1",
					name: "Test Business",
					owners_json: {
						data_owners: {
							id: "owner-id-1",
							first_name: "John",
							last_name: "Doe",
							last_four_of_ssn: "1234"
						}
					},
					owners_percentage_json: {
						rel_business_owners: {
							ownership_percentage: 50
						}
					}
				}
			];

			(sqlTransaction as jest.Mock).mockResolvedValueOnce([{ rowCount: 1, rows: mockBusinessData }]);

			const result = await reportEventsHandler._getCompanyOverview(mockPayload);

			expect(result).toEqual({
				ownership: [
					{
						id: "owner-id-1",
						first_name: "John",
						last_name: "Doe",
						ownership_percentage: "50",
						last_four_of_ssn: "XXXX"
					}
				]
			});

			expect(sqlTransaction).toHaveBeenCalledTimes(1);
		});

		it("should return company overview with ownership details when ownership percentage is 0", async () => {
			const mockBusinessData = [
				{
					id: "business-id-1",
					name: "Test Business",
					owners_json: {
						data_owners: {
							id: "owner-id-1",
							first_name: "John",
							last_name: "Doe",
							last_four_of_ssn: "1234"
						}
					},
					owners_percentage_json: {
						rel_business_owners: {
							ownership_percentage: 0
						}
					}
				}
			];

			(sqlTransaction as jest.Mock).mockResolvedValueOnce([{ rowCount: 1, rows: mockBusinessData }]);

			const result = await reportEventsHandler._getCompanyOverview(mockPayload);

			expect(result).toEqual({
				ownership: [
					{
						id: "owner-id-1",
						first_name: "John",
						last_name: "Doe",
						ownership_percentage: "0",
						last_four_of_ssn: "XXXX"
					}
				]
			});

			expect(sqlTransaction).toHaveBeenCalledTimes(1);
		});

		it("should return company overview with ownership details when ownership percentage is null", async () => {
			const mockBusinessData = [
				{
					id: "business-id-1",
					name: "Test Business",
					owners_json: {
						data_owners: {
							id: "owner-id-1",
							first_name: "John",
							last_name: "Doe",
							last_four_of_ssn: "1234"
						}
					},
					owners_percentage_json: {
						rel_business_owners: {
							ownership_percentage: null
						}
					}
				}
			];

			(sqlTransaction as jest.Mock).mockResolvedValueOnce([{ rowCount: 1, rows: mockBusinessData }]);

			const result = await reportEventsHandler._getCompanyOverview(mockPayload);

			expect(result).toEqual({
				ownership: [
					{
						id: "owner-id-1",
						first_name: "John",
						last_name: "Doe",
						ownership_percentage: null,
						last_four_of_ssn: "XXXX"
					}
				]
			});

			expect(sqlTransaction).toHaveBeenCalledTimes(1);
		});

		it("should return company overview with ownership details when last four of ssn is null", async () => {
			const mockBusinessData = [
				{
					id: "business-id-1",
					name: "Test Business",
					owners_json: {
						data_owners: {
							id: "owner-id-1",
							first_name: "John",
							last_name: "Doe",
							last_four_of_ssn: null
						}
					},
					owners_percentage_json: {
						rel_business_owners: {
							ownership_percentage: 0
						}
					}
				}
			];

			(sqlTransaction as jest.Mock).mockResolvedValueOnce([{ rowCount: 1, rows: mockBusinessData }]);

			const result = await reportEventsHandler._getCompanyOverview(mockPayload);

			expect(result).toEqual({
				ownership: [
					{
						id: "owner-id-1",
						first_name: "John",
						last_name: "Doe",
						ownership_percentage: "0",
						last_four_of_ssn: null
					}
				]
			});

			expect(sqlTransaction).toHaveBeenCalledTimes(1);
		});

		it("should handle owners without ownership data", async () => {
			const mockBusinessData = [
				{
					id: "business-id-1",
					name: "Test Business",
					owners_json: null,
					owners_percentage_json: null
				}
			];

			(sqlTransaction as jest.Mock).mockResolvedValueOnce([{ rowCount: 1, rows: mockBusinessData }]);

			const result = await reportEventsHandler._getCompanyOverview(mockPayload);

			expect(result).toEqual({
				ownership: []
			});
		});
	});

	describe("_getKycKyb", () => {
		const mockPayload: I360Report = {
			report_id: "123e4567-e89b-12d3-a456-426614174000",
			business_id: "123e4567-e89b-12d3-a456-426614174001",
			case_id: "123e4567-e89b-12d3-a456-426614174002",
			score_trigger_id: "123e4567-e89b-12d3-a456-426614174003",
			customer_id: "123e4567-e89b-12d3-a456-426614174004"
		};

		it("should return related businesses data", async () => {
			const mockRelatedBusinesses = [
				{ id: "related-1", name: "Related Business 1" },
				{ id: "related-2", name: "Related Business 2" }
			];

			(relatedBusinesses.getRelatedBusinesses as jest.Mock).mockResolvedValueOnce({
				records: mockRelatedBusinesses
			});

			const result = await reportEventsHandler._getKycKyb(mockPayload);

			expect(result).toEqual({
				related_businesses: mockRelatedBusinesses
			});

			expect(relatedBusinesses.getRelatedBusinesses).toHaveBeenCalledWith(
				{
					businessID: mockPayload.business_id,
					customerID: mockPayload.customer_id
				},
				{
					pagination: false
				}
			);
		});

		it("should return related businesses data when there are no related businesses", async () => {
			(relatedBusinesses.getRelatedBusinesses as jest.Mock).mockResolvedValueOnce({
				records: []
			});

			const result = await reportEventsHandler._getKycKyb(mockPayload);

			expect(result).toEqual({
				related_businesses: []
			});
		});
	});

	describe("fetchReportData", () => {
		const mockPayload: I360Report = {
			report_id: "123e4567-e89b-12d3-a456-426614174000",
			business_id: "123e4567-e89b-12d3-a456-426614174001",
			case_id: "123e4567-e89b-12d3-a456-426614174002",
			score_trigger_id: "123e4567-e89b-12d3-a456-426614174003",
			customer_id: "123e4567-e89b-12d3-a456-426614174004"
		};

		it("should fetch report data and send to kafka", async () => {
			const mockCompanyOverview = { ownership: [] };
			const mockKybKycData = { related_businesses: [] };

			jest.spyOn(reportEventsHandler, "_getCompanyOverview").mockResolvedValueOnce(mockCompanyOverview);
			jest.spyOn(reportEventsHandler, "_getKycKyb").mockResolvedValueOnce(mockKybKycData);

			await reportEventsHandler.fetchReportData(mockPayload);

			expect(producer.send).toHaveBeenCalledWith({
				topic: kafkaTopics.REPORTS,
				messages: [
					{
						key: mockPayload.report_id || mockPayload.business_id,
						value: {
							event: kafkaEvents.UPDATE_REPORT_DATA,
							business_id: mockPayload.business_id,
							source: "case",
							report_id: mockPayload.report_id,
							data: {
								company_overview: mockCompanyOverview,
								kyc_kyb: mockKybKycData
							}
						}
					}
				]
			});
		});

		it("should handle errors gracefully and still send data", async () => {
			const overviewError = new Error("Company overview error");
			jest.spyOn(reportEventsHandler, "_getCompanyOverview").mockRejectedValueOnce(overviewError);
			jest.spyOn(reportEventsHandler, "_getKycKyb").mockResolvedValueOnce({ related_businesses: [] });

			await reportEventsHandler.fetchReportData(mockPayload);

			expect(logger.error).toHaveBeenCalledWith({ error: overviewError }, "_getCompanyOverview error");
			expect(producer.send).toHaveBeenCalled();
		});
	});
});
