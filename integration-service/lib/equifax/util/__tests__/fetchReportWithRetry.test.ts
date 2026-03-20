import { BureauApiError } from "#api/v1/modules/bureau/error";
import axios, { AxiosError, isAxiosError } from "axios";
import { fetchReportWithRetry } from "../fetchReportWithRetry";

jest.mock("axios");

/** Mock constants */
const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;
const mockIsAxiosError = isAxiosError as jest.MockedFunction<typeof isAxiosError>;

/** Factory functions */
const createMockAxiosResponse = (overrides = {}) => ({
	data: Buffer.from("mock-pdf-data"),
	status: 200,
	statusText: "OK",
	headers: {},
	config: {},
	...overrides
});

const createMockAxiosError = (status: number, overrides: Partial<AxiosError["response"]> = {}) => {
	const error = new Error("Mock Axios Error") as AxiosError;
	error.name = "AxiosError";
	error.isAxiosError = true;
	error.response = { status, ...overrides } as AxiosError["response"];
	return error;
};

describe("fetchReportWithRetry", () => {
	const mockToken = "test-bearer-token";
	const mockPath = "https://example.com/report/123";
	const mockretryUntil = Date.now() + 10000;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useRealTimers();
		jest.restoreAllMocks();

		mockIsAxiosError.mockReturnValue(true);
	});

	it("should return the fetched report", async () => {
		/** Arrange */
		const mockBuffer = Buffer.from("test-pdf-content");
		const mockResponse = createMockAxiosResponse({ data: mockBuffer });
		mockAxiosGet.mockResolvedValueOnce(mockResponse);

		/** Act */
		const result = await fetchReportWithRetry(mockToken, mockPath, mockretryUntil);

		/** Assert */
		expect(result).toEqual(mockBuffer);
		expect(mockAxiosGet).toHaveBeenCalledWith(mockPath, {
			responseType: "arraybuffer",
			headers: {
				Authorization: `Bearer ${mockToken}`,
				Accept: "application/pdf"
			}
		});
	});

	it("should retry on 409 errors and return the fetched report", async () => {
		/** Arrange */
		const mock409Error = createMockAxiosError(409);
		const mockResponse = createMockAxiosResponse({ data: Buffer.from("test-pdf-content") });
		mockAxiosGet.mockRejectedValueOnce(mock409Error).mockResolvedValueOnce(mockResponse);

		const retryUntil = Date.now() + 15;
		const retryDelay = 5;

		/** Act */
		const result = await fetchReportWithRetry(mockToken, mockPath, retryUntil, retryDelay);
		const numberOfCalls = mockAxiosGet.mock.calls.length;

		/** Assert */
		expect(result).toEqual(Buffer.from("test-pdf-content"));
		expect(numberOfCalls).toBeGreaterThan(1);
	});

	it("should stop retrying after the retry timeout has been reached", async () => {
		/** Arrange */
		const mock409Error = createMockAxiosError(409);
		mockAxiosGet
			.mockRejectedValueOnce(mock409Error)
			.mockRejectedValueOnce(mock409Error)
			.mockRejectedValueOnce(mock409Error)
			.mockRejectedValueOnce(mock409Error);

		const retryUntil = Date.now() + 15; /** Very short timeout for test */
		const retryDelay = 5;

		/** Act & Assert */
		await expect(fetchReportWithRetry(mockToken, mockPath, retryUntil, retryDelay)).rejects.toThrow(Error);
		const numberOfCalls = mockAxiosGet.mock.calls.length;
		expect(numberOfCalls).toBeGreaterThan(1);
	});

	it("should throw BureauApiError for network errors", async () => {
		/** Arrange */
		const mockError = new Error("Network Error") as AxiosError;
		mockError.isAxiosError = true;
		mockError.config = {} as any;
		mockError.toJSON = () => ({});
		mockAxiosGet.mockRejectedValueOnce(mockError);

		/** Act & Assert */
		await expect(fetchReportWithRetry(mockToken, mockPath, mockretryUntil)).rejects.toThrow(Error);
	});
});
