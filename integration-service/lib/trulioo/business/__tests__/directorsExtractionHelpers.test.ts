/**
 * Tests for directorsExtractionHelpers
 * Validates the business logic for extracting directors based on flow type
 */

import { extractDirectorsForPSCScreening, ExtractDirectorsOptions } from "../directorsExtractionHelpers";
import { extractDirectorsOfficersFromTrulioo } from "../../common/utils";
import { logger } from "#helpers/logger";

jest.mock("#helpers/logger", () => ({
	logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
}));

jest.mock("../../common/utils", () => ({
	extractDirectorsOfficersFromTrulioo: jest.fn()
}));

describe("directorsExtractionHelpers", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("extractDirectorsForPSCScreening", () => {
		const mockClientData = {
			businessData: {
				name: "Test Company",
				country: "US"
			},
			flowData: {
				serviceData: [
					{
						fullServiceDetails: {
							Record: {
								DatasourceResults: [
									{
										Field: {
											FieldName: "StandardizedDirectorsOfficers",
											Data: JSON.stringify([
												{ FullName: "John Doe", Titles: ["Director"] },
												{ FullName: "Jane Smith", Titles: ["Officer"] }
											])
										}
									}
								]
							}
						}
					}
				]
			}
		};

		const mockExtractedOfficers = [
			{ name: "John Doe", titles: ["Director"] },
			{ name: "Jane Smith", titles: ["Officer"] }
		];

		describe("Advanced Watchlists (US)", () => {
			it("should extract directors from StandardizedDirectorsOfficers when Advanced Watchlists is enabled", async () => {
				(extractDirectorsOfficersFromTrulioo as jest.Mock).mockReturnValue(mockExtractedOfficers);

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: { name: "Test Company", country: "US" },
					businessState: "NY",
					advancedWatchlistsEnabled: true
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(extractDirectorsOfficersFromTrulioo).toHaveBeenCalledWith(mockClientData, "NY");
				expect(result).toEqual([
					{ fullName: "John Doe", title: "Director" },
					{ fullName: "Jane Smith", title: "Officer" }
				]);
				expect(logger.info).toHaveBeenCalledWith(
					"Advanced Watchlists: Extracted 2 directors/officers from StandardizedDirectorsOfficers"
				);
			});

			it("should return undefined when no directors found in StandardizedDirectorsOfficers", async () => {
				(extractDirectorsOfficersFromTrulioo as jest.Mock).mockReturnValue([]);

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: { name: "Test Company", country: "US" },
					businessState: "NY",
					advancedWatchlistsEnabled: true
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(result).toBeUndefined();
				expect(logger.info).toHaveBeenCalledWith(
					"Advanced Watchlists: Extracted 0 directors/officers from StandardizedDirectorsOfficers"
				);
			});

			it("should parse fullAddress when parseFullAddress function is provided", async () => {
				const officersWithAddress = [
					{ name: "John Doe", titles: ["Director"], fullAddress: "123 Main St New York NY US 10001" }
				];
				(extractDirectorsOfficersFromTrulioo as jest.Mock).mockReturnValue(officersWithAddress);

				const parseFullAddress = jest.fn().mockReturnValue({
					addressLine1: "123 Main St",
					city: "New York",
					state: "NY",
					country: "US",
					postalCode: "10001"
				});

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: { name: "Test Company", country: "US" },
					businessState: "NY",
					advancedWatchlistsEnabled: true,
					parseFullAddress
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(parseFullAddress).toHaveBeenCalledWith("123 Main St New York NY US 10001");
				expect(result).toEqual([
					expect.objectContaining({
						fullName: "John Doe",
						title: "Director",
						addressLine1: "123 Main St",
						city: "New York",
						state: "NY",
						country: "US",
						postalCode: "10001"
					})
				]);
			});
		});

		describe("Standard Flow (International)", () => {
			it("should use explicitly returned directors from businessData when available", async () => {
				const explicitDirectors = [
					{ fullName: "Explicit Director", title: "CEO" }
				];

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: {
						name: "Test Company",
						country: "CA",
						directors: explicitDirectors
					},
					businessState: "ON",
					advancedWatchlistsEnabled: false
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(extractDirectorsOfficersFromTrulioo).not.toHaveBeenCalled();
				expect(result).toEqual(explicitDirectors);
				expect(logger.info).toHaveBeenCalledWith(
					"Standard flow: Using 1 explicitly returned directors/officers from Trulioo"
				);
			});

			it("should fallback to StandardizedDirectorsOfficers when no explicit directors", async () => {
				(extractDirectorsOfficersFromTrulioo as jest.Mock).mockReturnValue(mockExtractedOfficers);

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: {
						name: "Test Company",
						country: "CA"
						// No explicit directors
					},
					businessState: "ON",
					advancedWatchlistsEnabled: false
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(extractDirectorsOfficersFromTrulioo).toHaveBeenCalledWith(mockClientData, "ON");
				expect(result).toEqual([
					{ fullName: "John Doe", title: "Director" },
					{ fullName: "Jane Smith", title: "Officer" }
				]);
				expect(logger.info).toHaveBeenCalledWith(
					"Standard flow: Extracted 2 directors/officers from StandardizedDirectorsOfficers (Trulioo's returned data)"
				);
			});

			it("should return undefined when no directors found in explicit fields or StandardizedDirectorsOfficers", async () => {
				(extractDirectorsOfficersFromTrulioo as jest.Mock).mockReturnValue([]);

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: {
						name: "Test Company",
						country: "CA"
						// No explicit directors
					},
					businessState: "ON",
					advancedWatchlistsEnabled: false
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(result).toBeUndefined();
				expect(logger.info).toHaveBeenCalledWith(
					"Standard flow: No directors/officers returned by Trulioo (neither explicit fields nor StandardizedDirectorsOfficers)"
				);
			});

			it("should handle empty directors array in businessData", async () => {
				(extractDirectorsOfficersFromTrulioo as jest.Mock).mockReturnValue(mockExtractedOfficers);

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: {
						name: "Test Company",
						country: "CA",
						directors: [] // Empty array
					},
					businessState: "ON",
					advancedWatchlistsEnabled: false
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(extractDirectorsOfficersFromTrulioo).toHaveBeenCalled(); // Should fallback
				expect(result).toEqual([
					{ fullName: "John Doe", title: "Director" },
					{ fullName: "Jane Smith", title: "Officer" }
				]);
			});

			it("should parse fullAddress in standard flow when parseFullAddress function is provided", async () => {
				const officersWithAddress = [
					{ name: "John Doe", titles: ["Director"], fullAddress: "220 Victoria Street Toronto ON CA M5B 2R6" }
				];
				(extractDirectorsOfficersFromTrulioo as jest.Mock).mockReturnValue(officersWithAddress);

				const parseFullAddress = jest.fn().mockReturnValue({
					addressLine1: "220 Victoria Street",
					city: "Toronto",
					state: "ON",
					country: "CA",
					postalCode: "M5B 2R6"
				});

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: {
						name: "Test Company",
						country: "CA"
					},
					businessState: "ON",
					advancedWatchlistsEnabled: false,
					parseFullAddress
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(parseFullAddress).toHaveBeenCalledWith("220 Victoria Street Toronto ON CA M5B 2R6");
				expect(result).toEqual([
					expect.objectContaining({
						fullName: "John Doe",
						title: "Director",
						addressLine1: "220 Victoria Street",
						city: "Toronto",
						state: "ON",
						country: "CA",
						postalCode: "M5B 2R6"
					})
				]);
			});
		});

		describe("Edge Cases", () => {
			it("should handle missing businessData gracefully", async () => {
				(extractDirectorsOfficersFromTrulioo as jest.Mock).mockReturnValue([]);

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: undefined,
					businessState: "ON",
					advancedWatchlistsEnabled: false
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(extractDirectorsOfficersFromTrulioo).toHaveBeenCalled();
				expect(result).toBeUndefined();
			});

			it("should handle officers without titles", async () => {
				const officersWithoutTitles = [{ name: "John Doe" }];
				(extractDirectorsOfficersFromTrulioo as jest.Mock).mockReturnValue(officersWithoutTitles);

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: { name: "Test Company", country: "US" },
					businessState: "NY",
					advancedWatchlistsEnabled: true
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(result).toEqual([{ fullName: "John Doe", title: undefined }]);
			});

			it("should handle officers with empty titles array", async () => {
				const officersWithEmptyTitles = [{ name: "John Doe", titles: [] }];
				(extractDirectorsOfficersFromTrulioo as jest.Mock).mockReturnValue(officersWithEmptyTitles);

				const options: ExtractDirectorsOptions = {
					clientData: mockClientData,
					businessData: { name: "Test Company", country: "US" },
					businessState: "NY",
					advancedWatchlistsEnabled: true
				};

				const result = await extractDirectorsForPSCScreening(options);

				expect(result).toEqual([{ fullName: "John Doe", title: undefined }]);
			});
		});
	});
});
