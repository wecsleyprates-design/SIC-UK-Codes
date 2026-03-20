import { plaidIdvAdapterGetMetadata as getMetadata } from "../plaidIdvAdapterGetMetadata";
import { getOwners } from "#helpers/api";
import { logger } from "#helpers/logger";
import type { Owner } from "#types";
import { UUID } from "crypto";

jest.mock("#helpers/api");
jest.mock("#helpers/logger");

const mockGetOwners = getOwners as jest.MockedFunction<typeof getOwners>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe("plaidIdvAdapter - getMetadata", () => {
	const businessID = "test-business-id" as UUID;

	const createMockOwner = (overrides: Partial<Owner> = {}): Owner => ({
		id: "owner-1" as UUID,
		title: null,
		first_name: "John",
		last_name: "Doe",
		ssn: "encrypted-ssn",
		email: "john@example.com",
		mobile: "1234567890",
		date_of_birth: "encrypted-dob",
		address_apartment: null,
		address_line_1: "123 Main St",
		address_line_2: null,
		address_city: "New York",
		address_state: "NY",
		address_postal_code: "10001",
		address_country: "US",
		created_at: "2024-01-01T00:00:00.000Z",
		created_by: "creator-id" as UUID,
		updated_at: "2024-01-01T00:00:00.000Z",
		updated_by: "updater-id" as UUID,
		last_four_of_ssn: "1234",
		year_of_birth: 1990,
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockLogger.debug = jest.fn();
		mockLogger.error = jest.fn();
	});

	describe("successful metadata generation", () => {
		it("should return metadata with valid owners", async () => {
			/** Arrange */
			const mockOwners = [createMockOwner(), createMockOwner({ id: "owner-2" as UUID, first_name: "Jane" })];
			mockGetOwners.mockResolvedValue(mockOwners);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({ owners: mockOwners });
			expect(mockGetOwners).toHaveBeenCalledWith(businessID);
		});

		it("should filter out owners with missing first_name", async () => {
			/** Arrange */
			const validOwner = createMockOwner();
			const invalidOwner = createMockOwner({ id: "owner-2" as UUID, first_name: null });
			mockGetOwners.mockResolvedValue([validOwner, invalidOwner]);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({ owners: [validOwner] });
			expect(mockLogger.debug).toHaveBeenCalledWith(
				{ businessID, owner: invalidOwner },
				"Plaid IDV adapter: Owner missing required fields (first_name, last_name, address_line_1, address_city)"
			);
		});

		it("should filter out owners with missing last_name", async () => {
			/** Arrange */
			const validOwner = createMockOwner();
			const invalidOwner = createMockOwner({ id: "owner-2" as UUID, last_name: null });
			mockGetOwners.mockResolvedValue([validOwner, invalidOwner]);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({ owners: [validOwner] });
			expect(mockLogger.debug).toHaveBeenCalledWith(
				{ businessID, owner: invalidOwner },
				"Plaid IDV adapter: Owner missing required fields (first_name, last_name, address_line_1, address_city)"
			);
		});

		it("should filter out owners with missing address_line_1", async () => {
			/** Arrange */
			const validOwner = createMockOwner();
			const invalidOwner = createMockOwner({ id: "owner-2" as UUID, address_line_1: undefined });
			mockGetOwners.mockResolvedValue([validOwner, invalidOwner]);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({ owners: [validOwner] });
			expect(mockLogger.debug).toHaveBeenCalledWith(
				{ businessID, owner: invalidOwner },
				"Plaid IDV adapter: Owner missing required fields (first_name, last_name, address_line_1, address_city)"
			);
		});

		it("should filter out owners with missing address_city", async () => {
			/** Arrange */
			const validOwner = createMockOwner();
			const invalidOwner = createMockOwner({ id: "owner-2" as UUID, address_city: undefined });
			mockGetOwners.mockResolvedValue([validOwner, invalidOwner]);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({ owners: [validOwner] });
			expect(mockLogger.debug).toHaveBeenCalledWith(
				{ businessID, owner: invalidOwner },
				"Plaid IDV adapter: Owner missing required fields (first_name, last_name, address_line_1, address_city)"
			);
		});

		it("should return metadata with only valid owners when some are invalid", async () => {
			/** Arrange */
			const validOwners = [createMockOwner({ id: "owner-1" as UUID }), createMockOwner({ id: "owner-3" as UUID })];
			const invalidOwners = [
				createMockOwner({ id: "owner-2" as UUID, first_name: null }),
				createMockOwner({ id: "owner-4" as UUID, address_city: undefined })
			];
			mockGetOwners.mockResolvedValue([...validOwners, ...invalidOwners]);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({ owners: validOwners });
			expect(mockLogger.debug).toHaveBeenCalledTimes(2);
		});
	});

	describe("error cases", () => {
		it("should return undefined when getOwners returns null", async () => {
			/** Arrange */
			mockGetOwners.mockResolvedValue(null as unknown as Owner[]);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toBeUndefined();
			expect(mockLogger.debug).toHaveBeenCalledWith({ businessID }, "Plaid IDV adapter: No owners found for business");
		});

		it("should return undefined when getOwners returns undefined", async () => {
			/** Arrange */
			mockGetOwners.mockResolvedValue(undefined as unknown as Owner[]);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toBeUndefined();
			expect(mockLogger.debug).toHaveBeenCalledWith({ businessID }, "Plaid IDV adapter: No owners found for business");
		});

		it("should return undefined when getOwners returns empty array", async () => {
			/** Arrange */
			mockGetOwners.mockResolvedValue([]);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toBeUndefined();
			expect(mockLogger.debug).toHaveBeenCalledWith({ businessID }, "Plaid IDV adapter: No owners found for business");
		});

		it("should return undefined when all owners are invalid", async () => {
			/** Arrange */
			const invalidOwners = [
				createMockOwner({ id: "owner-1" as UUID, first_name: null }),
				createMockOwner({ id: "owner-2" as UUID, last_name: null }),
				createMockOwner({ id: "owner-3" as UUID, address_line_1: undefined }),
				createMockOwner({ id: "owner-4" as UUID, address_city: undefined })
			];
			mockGetOwners.mockResolvedValue(invalidOwners);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toBeUndefined();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				{ businessID },
				"Plaid IDV adapter: No valid owners with required fields"
			);
		});

		it("should return undefined and log error when getOwners throws", async () => {
			/** Arrange */
			const error = new Error("API error");
			mockGetOwners.mockRejectedValue(error);

			/** Act */
			const result = await getMetadata(businessID);

			/** Assert */
			expect(result).toBeUndefined();
			expect(mockLogger.error).toHaveBeenCalledWith({ businessID, error }, "Plaid IDV adapter: Error fetching owners");
		});
	});
});
