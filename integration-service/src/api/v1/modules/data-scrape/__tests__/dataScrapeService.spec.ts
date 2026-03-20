import { getBusinessDetailsForTaxConsent, internalGetBusinessNamesAndAddresses } from "#helpers";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { DataScrapeService } from "../dataScrapeService";
import axios from "axios";
import { IBusinessIntegrationTaskEnriched } from "#types";
import { CONNECTION_STATUS, SCORE_TRIGGER } from "#constants";
import { AddressUtil } from "#utils/addressUtil";

jest.mock("axios");
jest.mock("openai");
jest.mock("kafkajs");
jest.mock("#api/v1/modules/tasks/taskManager");
jest.mock("#common/common");
jest.mock("#helpers/index");
jest.mock("#utils/addressUtil");
jest.mock("#configs/env.config", () => {
	return {
		envConfig: { SERP_API_KEY: "MOCK_SERP_API_KEY", SYNCHRONOUS_API_TIMEOUT_SECONDS: 60 }
	};
});

const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;
const mockTaskManagerGetEnrichedTask = TaskManager.getEnrichedTask as jest.MockedFunction<
	typeof TaskManager.getEnrichedTask
>;
const mockGetBusinessDetailsForTaxConsent = getBusinessDetailsForTaxConsent as jest.MockedFunction<
	typeof getBusinessDetailsForTaxConsent
>;
const mockInternalGetBusinessNamesAndAddresses = internalGetBusinessNamesAndAddresses as jest.MockedFunction<
	typeof internalGetBusinessNamesAndAddresses
>;
const mockAddCountryToAddress = AddressUtil.addCountryToAddress as jest.MockedFunction<
	typeof AddressUtil.addCountryToAddress
>;

describe("searchSerpAPI", () => {
	afterEach(() => {
		mockAxiosGet.mockClear();
		mockAddCountryToAddress.mockClear();
	});

	it("should search for the provided business name and address", async () => {
		/** Arrange */
		const businessID = "1-2-3-4-5";
		const businessName = "Test Business";
		const businessDbaNames = [];
		const businessAddress = "123 Test St, Test City, TC 12345";
		const taskID = "5-4-3-2-1";
		const dataScrapeService = new DataScrapeService();

		mockAxiosGet.mockResolvedValueOnce({
			data: {}
		});

		/** Act */
		await dataScrapeService.searchSerpAPI({
			businessID,
			businessName,
			businessDbaNames,
			businessAddress,
			taskID
		});

		/** Assert */
		expect(axios.get).toHaveBeenCalledTimes(1);
		expect(axios.get).toHaveBeenCalledWith(
			`https://serpapi.com/search?api_key=MOCK_SERP_API_KEY&engine=google_maps&type=search&google_domain=google.com&q=${encodeURIComponent(
				`${businessName}, ${businessAddress}`
			)}&hl=en&ll=@44.967243,-103.771556,5z`,
			{ timeout: 60000 }
		);
		// No Google profile data, so addCountryToAddress should not be called
		expect(mockAddCountryToAddress).not.toHaveBeenCalled();
	});

	it("should search for the provided business name, business dba name, and address", async () => {
		/** Arrange */
		const businessID = "1-2-3-4-5";
		const businessName = "Test Business";
		const businessDbaNames = ["Test DBA 1", "Test DBA 2"];
		const businessAddress = "123 Test St, Test City, TC 12345";
		const taskID = "5-4-3-2-1";
		const dataScrapeService = new DataScrapeService();

		mockAxiosGet.mockResolvedValueOnce({
			data: {}
		});

		/** Act */
		await dataScrapeService.searchSerpAPI({
			businessID,
			businessName,
			businessDbaNames,
			businessAddress,
			taskID
		});

		/** Assert */
		expect(axios.get).toHaveBeenCalledTimes(1);
		expect(axios.get).toHaveBeenCalledWith(
			`https://serpapi.com/search?api_key=MOCK_SERP_API_KEY&engine=google_maps&type=search&google_domain=google.com&q=${encodeURIComponent(
				`Test Business, 123 Test St, Test City, TC 12345 OR Test DBA 1, 123 Test St, Test City, TC 12345 OR Test DBA 2, 123 Test St, Test City, TC 12345`
			)}&hl=en&ll=@44.967243,-103.771556,5z`,
			{ timeout: 60000 }
		);
		// No Google profile data, so addCountryToAddress should not be called
		expect(mockAddCountryToAddress).not.toHaveBeenCalled();
	});

	it("should trim the business name, business dba name(s), and address when searching", async () => {
		/** Arrange */
		const businessID = "1-2-3-4-5";
		const businessName = " Test Business ";
		const businessDbaNames = [" Test DBA 1 "];
		const businessAddress = " 123 Test St, Test City, TC 12345 ";
		const taskID = "5-4-3-2-1";
		const dataScrapeService = new DataScrapeService();

		mockAxiosGet.mockResolvedValueOnce({
			data: {}
		});

		/** Act */
		await dataScrapeService.searchSerpAPI({
			businessID,
			businessName,
			businessDbaNames,
			businessAddress,
			taskID
		});

		/** Assert */
		expect(axios.get).toHaveBeenCalledTimes(1);
		expect(axios.get).toHaveBeenCalledWith(
			`https://serpapi.com/search?api_key=MOCK_SERP_API_KEY&engine=google_maps&type=search&google_domain=google.com&q=${encodeURIComponent(
				`Test Business, 123 Test St, Test City, TC 12345 OR Test DBA 1, 123 Test St, Test City, TC 12345`
			)}&hl=en&ll=@44.967243,-103.771556,5z`,
			{ timeout: 60000 }
		);
		// No Google profile data, so addCountryToAddress should not be called
		expect(mockAddCountryToAddress).not.toHaveBeenCalled();
	});

	it("should remove any business dba names that exactly equal the business name", async () => {
		/** Arrange */
		const businessID = "1-2-3-4-5";
		const businessName = "Test Business";
		const businessDbaNames = ["Test Business", "Test Business", "Test DBA 1", "Test Business", "Test Business"];
		const businessAddress = " 123 Test St, Test City, TC 12345 ";
		const taskID = "5-4-3-2-1";
		const dataScrapeService = new DataScrapeService();

		mockAxiosGet.mockResolvedValueOnce({
			data: {}
		});

		/** Act */
		await dataScrapeService.searchSerpAPI({
			businessID,
			businessName,
			businessDbaNames,
			businessAddress,
			taskID
		});

		/** Assert */
		expect(axios.get).toHaveBeenCalledTimes(1);
		expect(axios.get).toHaveBeenCalledWith(
			`https://serpapi.com/search?api_key=MOCK_SERP_API_KEY&engine=google_maps&type=search&google_domain=google.com&q=${encodeURIComponent(
				`Test Business, 123 Test St, Test City, TC 12345 OR Test DBA 1, 123 Test St, Test City, TC 12345`
			)}&hl=en&ll=@44.967243,-103.771556,5z`,
			{ timeout: 60000 }
		);
		// No Google profile data, so addCountryToAddress should not be called
		expect(mockAddCountryToAddress).not.toHaveBeenCalled();
	});
});

describe("executeTask", () => {
	afterEach(() => {
		mockTaskManagerGetEnrichedTask.mockClear();
		mockGetBusinessDetailsForTaxConsent.mockClear();
		mockInternalGetBusinessNamesAndAddresses.mockClear();
	});

	it("should call getEnrichedTask with the provided task id", async () => {
		/** Arrange */
		const taskID = "5-4-3-2-1";
		const dataScrapeService = new DataScrapeService();

		/** Act */
		await dataScrapeService.executeTask(taskID);

		/** Assert */
		expect(mockTaskManagerGetEnrichedTask).toHaveBeenCalledWith(taskID);
	});

	it("should call getBusinessDetailsForTaxConsent and internalGetBusinessNamesAndAddresses with the business ID from the task", async () => {
		/** Arrange */
		const taskID = "5-4-3-2-1";
		const dataScrapeService = new DataScrapeService();

		const businessId = "1-2-3-4-5";
		const task = { business_id: businessId } as unknown as IBusinessIntegrationTaskEnriched<any>;
		mockTaskManagerGetEnrichedTask.mockResolvedValueOnce(task);

		/** Act */
		await dataScrapeService.executeTask(taskID);

		/** Assert */
		expect(getBusinessDetailsForTaxConsent).toHaveBeenCalledWith(businessId);
		expect(internalGetBusinessNamesAndAddresses).toHaveBeenCalledWith(businessId);
	});

	it.each`
		triggerType                            | expectedIncludeIndustryAndWebsiteData
		${SCORE_TRIGGER.MANUAL_REFRESH}        | ${false}
		${SCORE_TRIGGER.APPLICATION_EDIT}      | ${true}
		${SCORE_TRIGGER.MONITORING_REFRESH}    | ${true}
		${SCORE_TRIGGER.ONBOARDING_INVITE}     | ${true}
		${SCORE_TRIGGER.SUBCSCRIPTION_REFRESH} | ${true}
	`(
		"should call searchSerpAPI with `includeIndustryAndWebsiteData: $expectedIncludeIndustryAndWebsiteData` if the task trigger type is $triggerType",
		async ({ triggerType, expectedIncludeIndustryAndWebsiteData }) => {
			/** Arrange */
			const taskID = "5-4-3-2-1";
			const dataScrapeService = new DataScrapeService();
			dataScrapeService.searchSerpAPI = jest.fn();

			const businessId = "1-2-3-4-5";
			const task = {
				business_id: businessId,
				trigger_type: triggerType
			} as unknown as IBusinessIntegrationTaskEnriched<any>;
			mockTaskManagerGetEnrichedTask.mockResolvedValueOnce(task);

			const businessDetails = {
				data: {}
			} as Awaited<ReturnType<typeof getBusinessDetailsForTaxConsent>>;
			mockGetBusinessDetailsForTaxConsent.mockResolvedValueOnce(businessDetails);

			const businessNamesAndAddresses = {
				names: [] as { name: string }[]
			} as Awaited<ReturnType<typeof internalGetBusinessNamesAndAddresses>>;
			mockInternalGetBusinessNamesAndAddresses.mockResolvedValueOnce(businessNamesAndAddresses);

			/** Act */
			await dataScrapeService.executeTask(taskID);

			/** Assert */
			expect(dataScrapeService.searchSerpAPI).toHaveBeenCalledWith(
				expect.objectContaining({
					includeIndustryAndWebsiteData: expectedIncludeIndustryAndWebsiteData
				})
			);
		}
	);

	it("should call searchSerpAPI with the expected business details", async () => {
		/** Arrange */
		const taskID = "5-4-3-2-1";
		const dataScrapeService = new DataScrapeService();
		dataScrapeService.searchSerpAPI = jest.fn();

		const businessId = "1-2-3-4-5";
		const task = {
			business_id: businessId,
			trigger_type: SCORE_TRIGGER.MANUAL_REFRESH
		} as unknown as IBusinessIntegrationTaskEnriched<any>;
		mockTaskManagerGetEnrichedTask.mockResolvedValueOnce(task);

		const businessDetails = {
			data: {
				business_name: "Test Business",
				address_line_1: "123 Test St",
				address_city: "Test City",
				address_state: "TS",
				address_postal_code: "12345"
			}
		} as Awaited<ReturnType<typeof getBusinessDetailsForTaxConsent>>;
		mockGetBusinessDetailsForTaxConsent.mockResolvedValueOnce(businessDetails);

		const businessNamesAndAddresses = {
			names: [{ name: "Test DBA 1" }, { name: "Test DBA 2" }]
		} as Awaited<ReturnType<typeof internalGetBusinessNamesAndAddresses>>;
		mockInternalGetBusinessNamesAndAddresses.mockResolvedValueOnce(businessNamesAndAddresses);

		/** Act */
		await dataScrapeService.executeTask(taskID);

		/** Assert */
		expect(dataScrapeService.searchSerpAPI).toHaveBeenCalledWith({
			businessAddress: "123 Test St, Test City, TS, 12345",
			businessName: "Test Business",
			businessDbaNames: ["Test DBA 1", "Test DBA 2"],
			businessID: businessId,
			taskID: taskID,
			includeIndustryAndWebsiteData: false
		});
	});

	it("should call updateConnectionStatus and return true if no error is thrown", async () => {
		/** Arrange */
		const taskID = "5-4-3-2-1";
		const dataScrapeService = new DataScrapeService();
		dataScrapeService.searchSerpAPI = jest.fn();
		dataScrapeService.updateConnectionStatus = jest.fn();

		const businessId = "1-2-3-4-5";
		const task = {
			business_id: businessId,
			trigger_type: SCORE_TRIGGER.MANUAL_REFRESH
		} as unknown as IBusinessIntegrationTaskEnriched<any>;
		mockTaskManagerGetEnrichedTask.mockResolvedValueOnce(task);

		const businessDetails = {
			data: {}
		} as Awaited<ReturnType<typeof getBusinessDetailsForTaxConsent>>;
		mockGetBusinessDetailsForTaxConsent.mockResolvedValueOnce(businessDetails);

		const businessNamesAndAddresses = {
			names: [] as { name: string }[]
		} as Awaited<ReturnType<typeof internalGetBusinessNamesAndAddresses>>;
		mockInternalGetBusinessNamesAndAddresses.mockResolvedValueOnce(businessNamesAndAddresses);

		/** Act */
		const result = await dataScrapeService.executeTask(taskID);

		/** Assert */
		expect(dataScrapeService.updateConnectionStatus).toHaveBeenCalledWith(CONNECTION_STATUS.SUCCESS);
		expect(result).toBe(true);
	});

	it("should return false if an error is thrown", async () => {
		/** Arrange */
		const taskID = "5-4-3-2-1";
		const dataScrapeService = new DataScrapeService();
		dataScrapeService.searchSerpAPI = jest.fn();
		dataScrapeService.updateConnectionStatus = jest.fn().mockRejectedValue(new Error("Test error"));

		const businessId = "1-2-3-4-5";
		const task = {
			business_id: businessId,
			trigger_type: SCORE_TRIGGER.MANUAL_REFRESH
		} as unknown as IBusinessIntegrationTaskEnriched<any>;
		mockTaskManagerGetEnrichedTask.mockResolvedValueOnce(task);

		const businessDetails = {
			data: {}
		} as Awaited<ReturnType<typeof getBusinessDetailsForTaxConsent>>;
		mockGetBusinessDetailsForTaxConsent.mockResolvedValueOnce(businessDetails);

		const businessNamesAndAddresses = {
			names: [] as { name: string }[]
		} as Awaited<ReturnType<typeof internalGetBusinessNamesAndAddresses>>;
		mockInternalGetBusinessNamesAndAddresses.mockResolvedValueOnce(businessNamesAndAddresses);

		/** Act */
		const result = await dataScrapeService.executeTask(taskID);

		/** Assert */
		expect(result).toBe(false);
	});
});
