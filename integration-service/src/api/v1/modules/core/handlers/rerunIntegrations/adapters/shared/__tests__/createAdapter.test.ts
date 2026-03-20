import { createAdapter } from "../createAdapter";
import { defaultAdapterProcessFunction } from "../defaultAdapterProcessFunction";
import { FactName } from "#lib/facts/types";

jest.mock("../defaultAdapterProcessFunction");

describe("createAdapter", () => {
	/** Factory function for creating mock getMetadata */
	const createMockGetMetadata = () => jest.fn();

	const mockFactNames: FactName[] = ["business_name", "primary_address"];

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("adapter creation with required fields", () => {
		it("should create adapter with getMetadata and factNames", () => {
			/** Arrange */
			const mockGetMetadata = createMockGetMetadata();

			/** Act */
			const adapter = createAdapter({
				getMetadata: mockGetMetadata,
				factNames: mockFactNames
			});

			/** Assert */
			expect(adapter).toBeDefined();
			expect(adapter.getMetadata).toBe(mockGetMetadata);
			expect(adapter.factNames).toEqual(mockFactNames);
			expect(adapter.process).toBe(defaultAdapterProcessFunction);
		});

		it("should use defaultAdapterProcessFunction when process is not provided", () => {
			/** Arrange */
			const mockGetMetadata = createMockGetMetadata();

			/** Act */
			const adapter = createAdapter({
				getMetadata: mockGetMetadata,
				factNames: mockFactNames
			});

			/** Assert */
			expect(adapter.process).toBe(defaultAdapterProcessFunction);
		});

		it("should preserve all provided fact names", () => {
			/** Arrange */
			const mockGetMetadata = createMockGetMetadata();
			const factNames: FactName[] = ["business_name", "legal_name", "dba", "primary_address", "addresses"];

			/** Act */
			const adapter = createAdapter({
				getMetadata: mockGetMetadata,
				factNames
			});

			/** Assert */
			expect(adapter.factNames).toEqual(factNames);
		});
	});

	describe("adapter creation with custom process function", () => {
		it("should use provided process function instead of default", () => {
			/** Arrange */
			const mockGetMetadata = createMockGetMetadata();
			const customProcessFunction = jest.fn();

			/** Act */
			const adapter = createAdapter({
				getMetadata: mockGetMetadata,
				factNames: mockFactNames,
				process: customProcessFunction
			});

			/** Assert */
			expect(adapter.process).toBe(customProcessFunction);
			expect(adapter.process).not.toBe(defaultAdapterProcessFunction);
		});
	});
});
