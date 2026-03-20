// @ts-nocheck
import { CONNECTION_STATUS, ERROR_CODES, TASK_STATUS } from "#constants";
import { oauthClient, sqlQuery, sqlTransaction, logger, handlePlatformConnectionNotFound } from "#helpers/index";
import { StatusCodes } from "http-status-codes";
import { PublicRecordsApiError } from "../error";
import { publicRecords } from "../public-records";
import { getBusinessReviews } from "#common/common";

jest.mock("#helpers/index");
jest.mock("#helpers/index", () => ({
	sqlQuery: jest.fn(),
	sqlTransaction: jest.fn(),
	handlePlatformConnectionNotFound: jest.fn(),
	logger: {
		error: jest.fn(),
		info: jest.fn()
	},
	oauthClient: {
		generateBusinessConsentUrl: jest.fn(),
		getOAuthTokens: jest.fn(),
		getClient: jest.fn()
	}
}));

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

jest.mock("#common/common", () => ({
	getBusinessReviews: jest.fn()
}));

describe("PublicRecords", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("getGoogleReviews", () => {
		it("When business integration task not exist for business", async () => {
			sqlTransaction.mockResolvedValueOnce([{ rowCount: 0 }, { rowCount: 0 }]);

			sqlTransaction.mockResolvedValueOnce([{ rowCount: 0 }, { rowCount: 0 }]);

			const businessID = "123";
			const result = await publicRecords.getGoogleReviews({ businessID }, { sort: { review_datetime: "DESC" } });

			expect(result.data).toEqual({
				records: [],
				google_avg_rating: null,
				is_google_business_api_connected: false,
				source: "none"
			});
			expect(result.message).toEqual("No google reviews records found.");
		});

		it("When google reviews not exist for business", async () => {
			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [{ connection_status: CONNECTION_STATUS }]
				},
				{
					rowCount: 1,
					rows: [{ id: "integration_task_id1" }]
				}
			]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [{ connection_status: CONNECTION_STATUS }]
				},
				{
					rowCount: 1,
					rows: [{ id: "integration_task_id2" }]
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			const businessID = "123";

			const result = await publicRecords.getGoogleReviews({ businessID }, { sort: { review_datetime: "DESC" } });

			expect(result.data).toEqual({
				records: [],
				google_avg_rating: null,
				is_google_business_api_connected: false,
				source: "none"
			});
			expect(result.message).toEqual("No google reviews records found.");
		});

		it("should return google reviews from Google Places API until consent for Google Business API not provided", async () => {
			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [{ connection_status: CONNECTION_STATUS.SUCCESS }]
				},
				{
					rowCount: 1,
					rows: [{ id: "integration_task_id1" }]
				}
			]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [{ connection_status: CONNECTION_STATUS.CREATED }]
				},
				{
					rowCount: 1,
					rows: [{ id: "integration_task_id2" }]
				}
			]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [{ totalcount: 1, google_avg_rating: 5 }]
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "review_id",
							rating: 5,
							text: "review_text",
							business_integration_task_id: "integration_task_id1",
							review_id: "google_review_id"
						}
					]
				}
			]);

			const businessID = "123";

			sqlQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

			const result = await publicRecords.getGoogleReviews(
				{ businessID },
				{ sort: { review_datetime: "DESC" }, pagination: true, page: 1, items_per_page: 10 }
			);

			const mockResultData = {
				records: [
					{
						id: "review_id",
						rating: 5,
						text: "review_text",
						business_integration_task_id: "integration_task_id1",
						review_id: "google_review_id"
					}
				],
				total_pages: 1,
				total_items: 1,
				google_avg_rating: 5,
				source: "google_places_api",
				is_google_business_api_connected: false
			};

			expect(result.data).toEqual(mockResultData);
			expect(result.message).toEqual("Google reviews fetched successfully.");
		});

		it("should return google reviews from Google Business API after getting consent for Google Business API", async () => {
			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [{ connection_status: CONNECTION_STATUS.SUCCESS }]
				},
				{
					rowCount: 1,
					rows: [{ id: "integration_task_id1" }]
				}
			]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [{ connection_status: CONNECTION_STATUS.SUCCESS }]
				},
				{
					rowCount: 1,
					rows: [{ id: "integration_task_id2" }]
				}
			]);

			sqlTransaction.mockResolvedValueOnce([
				{
					rowCount: 1,
					rows: [{ totalcount: 1, google_avg_rating: 5 }]
				},
				{
					rowCount: 1,
					rows: [
						{
							id: "review_id",
							rating: 5,
							text: "review_text",
							business_integration_task_id: "integration_task_id2",
							review_id: "google_review_id"
						}
					]
				}
			]);

			const businessID = "123";

			const result = await publicRecords.getGoogleReviews(
				{ businessID },
				{ sort: { review_datetime: "DESC" }, pagination: true, page: 1, items_per_page: 10 }
			);

			const mockResultData = {
				records: [
					{
						id: "review_id",
						rating: 5,
						text: "review_text",
						business_integration_task_id: "integration_task_id2",
						review_id: "google_review_id"
					}
				],
				total_pages: 1,
				total_items: 1,
				google_avg_rating: 5,
				is_google_business_api_connected: true,
				source: "google_business_api"
			};

			expect(result.data).toEqual(mockResultData);
			expect(result.message).toEqual("Google reviews fetched successfully.");
		});
	});

	describe("businessAPIConsentInit", () => {
		const body = { re_authenticate: true };
		const params = { businessID: "123" };

		it("should return the consent redirect URL", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});
			sqlTransaction.mockResolvedValueOnce([{ rowCount: 1 }, { rowCount: 1 }]);
			const authorizationUrl = "https://example.com/authorize";
			oauthClient.generateBusinessConsentUrl.mockReturnValueOnce(authorizationUrl);

			const response = await publicRecords.businessAPIConsentInit(body, params);
			expect(response.redirect_url).toEqual(authorizationUrl);
		});

		it("should throw an error if re_authenticate is not provided & connection is success", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ connection_status: CONNECTION_STATUS.SUCCESS }]
			});

			try {
				await publicRecords.businessAPIConsentInit({}, params);
			} catch (error) {
				expect(error).toBeInstanceOf(PublicRecordsApiError);
				expect(error.status).toEqual(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toEqual(ERROR_CODES.NOT_ALLOWED);
				expect(error.message).toEqual("Google Business API is already connected for business");
			}
		});
	});

	describe("fetchGoogleBusinessReviews", () => {
		it("should throw an error if connection not found", async () => {
			const body = { code: "code" };
			const params = { businessID: "123", caseID: "456" };

			try {
				oauthClient.getOAuthTokens.mockResolvedValueOnce({
					tokens: { refresh_token: "refresh_token", access_token: "access_token" }
				});
				const getConnectionResult = { rowCount: 0, rows: [] };
				const getGoogleReviewsTaskIDResult = { rowCount: 0, rows: [] };

				sqlTransaction.mockResolvedValueOnce([getConnectionResult, getGoogleReviewsTaskIDResult]);

				await publicRecords.fetchGoogleBusinessReviews(body, params);
			} catch (error) {
				expect(error).toBeInstanceOf(PublicRecordsApiError);
				expect(error.status).toEqual(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toEqual(ERROR_CODES.NOT_FOUND);
				expect(error.message).toEqual("No connection found");
			}
		});

		it("should update connection status to created if we were able to fetch tokens from oauth", async () => {
			const body = { code: "code" };
			const params = { businessID: "123", caseID: "456" };

			oauthClient.getOAuthTokens.mockResolvedValueOnce({
				tokens: { refresh_token: "refresh_token", access_token: "access_token" }
			});

			let getConnectionResult = {
				rowCount: 1,
				rows: [{ id: "conn_1", connection_status: CONNECTION_STATUS.INITIALIZED }]
			};
			let getGoogleReviewsTaskIDResult = { rowCount: 1, rows: [{ id: "task_1", task_status: TASK_STATUS.CREATED }] };

			sqlTransaction.mockResolvedValueOnce([getConnectionResult, getGoogleReviewsTaskIDResult]);

			sqlTransaction.mockResolvedValueOnce([
				{ rowCount: 1, rows: [{ score_trigger_id: "score_1" }] },
				{ rowCount: 1, rows: [{ id: "task_1", platform_id: "p1" }] }
			]);

			sqlTransaction.mockResolvedValueOnce([, getConnectionResult, getGoogleReviewsTaskIDResult]);

			getBusinessReviews.mockResolvedValueOnce({
				all_reviews: [{ id: "review_id", startRating: 5, comment: "review_text", createTime: "2022-01-01T00:00:00Z" }],
				average_rating: 5,
				total_review_count: 1
			});

			await publicRecords.fetchGoogleBusinessReviews(body, params);
		});

		it("should return a success message if task status is SUCCESS", async () => {
			const body = { code: "code", refresh_token: "refresh_token" };
			const params = { businessID: "123", caseID: "456" };

			oauthClient.getOAuthTokens.mockResolvedValueOnce({
				tokens: { refresh_token: "refresh_token", access_token: "access_token" }
			});

			const getConnectionResult = { rowCount: 1, rows: [{ id: "connection_id" }] };
			const getGoogleReviewsTaskIDResult = { rowCount: 1, rows: [{ id: "task_id", task_status: "SUCCESS" }] };

			sqlTransaction.mockResolvedValueOnce([getConnectionResult, getGoogleReviewsTaskIDResult]);

			const result = await publicRecords.fetchGoogleBusinessReviews(body, params);

			expect(result.message).toEqual("Your Google Business reviews have been already fetched!");
		});

		it("should throw an error if there is an error in fetching google reviews", async () => {
			const body = { code: "code", refresh_token: "refresh_token" };
			const params = { businessID: "123", caseID: "456" };

			const getConnectionResult = { rowCount: 1, rows: [{ id: "connection_id" }] };
			const getGoogleReviewsTaskIDResult = { rowCount: 1, rows: [{ id: "task_id", task_status: "CREATED" }] };
			sqlTransaction.mockResolvedValueOnce([getConnectionResult, getGoogleReviewsTaskIDResult]);

			oauthClient.getOAuthTokens.mockResolvedValueOnce({
				tokens: { refresh_token: "refresh_token", access_token: "access_token" }
			});

			getBusinessReviews.mockRejectedValueOnce(new Error("Error fetching reviews"));

			try {
				sqlTransaction.mockResolvedValueOnce();
				await publicRecords.fetchGoogleBusinessReviews(body, params);
			} catch (error) {
				expect(error).toBeInstanceOf(PublicRecordsApiError);
				expect(error.status).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
				expect(error.errorCode).toEqual(ERROR_CODES.UNKNOWN_ERROR);
				expect(error.message).toEqual("Error in fetching google reviews");
			}
		});

		it("should save reviews to the database and return a success message", async () => {
			const getConnectionResult = { rowCount: 1, rows: [{ id: "connection_id" }] };
			const getGoogleReviewsTaskIDResult = { rowCount: 1, rows: [{ id: "task_id", task_status: "CREATED" }] };
			sqlTransaction.mockResolvedValueOnce([getConnectionResult, getGoogleReviewsTaskIDResult]);

			oauthClient.getOAuthTokens.mockResolvedValueOnce({
				tokens: { refresh_token: "refresh_token", access_token: "access_token" }
			});

			getBusinessReviews.mockResolvedValueOnce({
				all_reviews: [{ id: "review_id", startRating: 5, comment: "review_text", createTime: "2022-01-01T00:00:00Z" }],
				average_rating: 5,
				total_review_count: 1
			});

			const body = { code: "code" };
			const params = { businessID: "123", caseID: "456" };

			const result = await publicRecords.fetchGoogleBusinessReviews(body, params);

			expect(result.message).toEqual("Your Google Business reviews have been successfully fetched");
		});

		it("should return a success message of no reviews found if no reviews are found but process succeed", async () => {
			const getConnectionResult = { rowCount: 1, rows: [{ id: "connection_id" }] };
			const getGoogleReviewsTaskIDResult = { rowCount: 1, rows: [{ id: "task_id", task_status: "CREATED" }] };
			sqlTransaction.mockResolvedValueOnce([getConnectionResult, getGoogleReviewsTaskIDResult]);

			oauthClient.getOAuthTokens.mockResolvedValueOnce({
				tokens: { refresh_token: "refresh_token", access_token: "access_token" }
			});

			publicRecords._getReviews = jest.fn().mockResolvedValueOnce([]);

			getBusinessReviews.mockResolvedValueOnce({
				all_reviews: [],
				average_rating: 0,
				total_review_count: 0
			});

			const body = { code: "code" };
			const params = { businessID: "123", caseID: "456" };

			const result = await publicRecords.fetchGoogleBusinessReviews(body, params);

			expect(result.message).toEqual("No reviews found for this Google Business Account");
		});
	});

	describe("getBusinessRatings", () => {
		it("should return business ratings from verdata if connection is successful", async () => {
			const params = { businessID: "123" };
			const query = { year: 2022 };

			const getConnectionResult = {
				rowCount: 1,
				rows: [{ connection_status: CONNECTION_STATUS.SUCCESS }]
			};
			sqlTransaction.mockResolvedValueOnce([getConnectionResult]);

			const getTaskIdResult = {
				rowCount: 1,
				rows: [{ id: "integration_task_id" }]
			};
			sqlQuery.mockResolvedValueOnce(getTaskIdResult);

			const getRatingsResult = {
				rowCount: 1,
				rows: [{ average_rating: 5, updated_at: new Date("2022-01-01T12:00:00Z") }]
			};
			sqlQuery.mockResolvedValueOnce(getRatingsResult);

			const result = await publicRecords.getBusinessRatings(params, query);
			let records = {
				January: {
					month: "January",
					avg_rating: 5
				}
			};

			records = publicRecords._addMissingMonths(records);

			records = Object.values(records);

			const mockResultData = {
				records,
				avg_rating: 5,
				source: "verdata"
			};

			expect(result).toEqual(mockResultData);
		});

		it("should return business ratings from google business reviews if verdata connection is failed and google business reviews connection is successful", async () => {
			const params = { businessID: "123" };
			const query = { year: 2022 };

			const getConnectionResult = {
				rowCount: 2,
				rows: [{ connection_status: CONNECTION_STATUS.FAILED }, { connection_status: CONNECTION_STATUS.SUCCESS }]
			};
			sqlTransaction.mockResolvedValueOnce([getConnectionResult]);

			const getTaskIdResult = {
				rowCount: 1,
				rows: [{ id: "integration_task_id" }]
			};
			sqlQuery.mockResolvedValueOnce(getTaskIdResult);

			const getRatingsResult = {
				rowCount: 1,
				rows: [{ average_rating: 4, created_at: new Date("2022-01-01T12:00:00Z") }]
			};
			sqlQuery.mockResolvedValueOnce(getRatingsResult);

			const result = await publicRecords.getBusinessRatings(params, query);

			let records = {
				January: {
					month: "January",
					avg_rating: 4
				}
			};

			records = publicRecords._addMissingMonths(records);

			records = Object.values(records);

			const mockResultData = {
				records,
				avg_rating: 4,
				source: "google_business_reviews"
			};

			expect(result).toEqual(mockResultData);
		});

		it("should return default response if no data is found", async () => {
			const params = { businessID: "123" };
			const query = { year: 2022 };

			const getConnectionResult = {
				rowCount: 1,
				rows: [{ connection_status: CONNECTION_STATUS.FAILED }]
			};
			sqlTransaction.mockResolvedValueOnce([getConnectionResult]);

			const result = await publicRecords.getBusinessRatings(params, query);

			const monthNames = [
				"January",
				"February",
				"March",
				"April",
				"May",
				"June",
				"July",
				"August",
				"September",
				"October",
				"November",
				"December"
			];

			const records = monthNames.map(month => {
				return {
					month,
					avg_rating: 0
				};
			});

			const mockResultData = {
				records,
				avg_rating: 0,
				source: "none"
			};

			expect(result).toEqual(mockResultData);
		});

		it("should throw error if no connection for verdata & google business reviews", async () => {
			const params = { businessID: "123" };
			const query = { year: 2022 };

			const getConnectionResult = {
				rowCount: 0,
				rows: []
			};
			sqlTransaction.mockResolvedValueOnce([getConnectionResult]);

			try {
				await publicRecords.getBusinessRatings(params, query);
			} catch (error) {
				expect(error).toBeInstanceOf(PublicRecordsApiError);
				expect(error.status).toEqual(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toEqual(ERROR_CODES.NOT_FOUND);
				expect(error.message).toEqual("No connections found");
			}
		});
	});
});
