import {
	TruliooUBOPersonData,
	TruliooPSCScreeningRequest,
	TruliooPSCScreeningResult,
	TruliooWatchlistHit
} from "../types";

describe("Trulioo UBO/Director Types", () => {
	describe("TruliooUBOPersonData", () => {
		it("should create valid UBO person data", () => {
			const uboData: TruliooUBOPersonData = {
				fullName: "John Smith",
				firstName: "John",
				lastName: "Smith",
				dateOfBirth: "1980-01-15",
				email: "john.smith@example.com",
				phone: "+44 20 7946 0958",
				addressLine1: "123 Main Street",
				city: "London",
				postalCode: "SW1A 1AA",
				country: "GB",
				ownershipPercentage: 75,
				controlType: "UBO",
				title: "CEO",
				nationality: "British",
				passportNumber: "AB1234567"
			};

			expect(uboData.fullName).toBe("John Smith");
			expect(uboData.controlType).toBe("UBO");
			expect(uboData.ownershipPercentage).toBe(75);
		});

		it("should create valid Director person data", () => {
			const directorData: TruliooUBOPersonData = {
				fullName: "Jane Doe",
				firstName: "Jane",
				lastName: "Doe",
				dateOfBirth: "1975-06-20",
				addressLine1: "456 Oak Avenue",
				city: "Toronto",
				state: "ON",
				postalCode: "M5H 2N2",
				country: "CA",
				controlType: "DIRECTOR",
				title: "CFO"
			};

			expect(directorData.controlType).toBe("DIRECTOR");
			expect(directorData.country).toBe("CA");
		});
	});

	describe("TruliooPSCScreeningRequest", () => {
		it("should create valid screening request", () => {
			const request: TruliooPSCScreeningRequest = {
				businessData: {
					companyName: "Test Company Ltd",
					companyCountryIncorporation: "GB",
					companyStateAddress: "England",
					companyZip: "SW1A 1AA"
				},
				persons: [
					{
						fullName: "John Smith",
						firstName: "John",
						lastName: "Smith",
						dateOfBirth: "1980-01-15",
						addressLine1: "123 Main Street",
						city: "London",
						postalCode: "SW1A 1AA",
						country: "GB",
						controlType: "UBO"
					}
				],
				businessId: "test-business-id"
			};

			expect(request.persons).toHaveLength(1);
			expect(request.businessData.companyName).toBe("Test Company Ltd");
		});
	});

	describe("TruliooWatchlistHit", () => {
		it("should create valid watchlist hit", () => {
			const hit: TruliooWatchlistHit = {
				listType: "PEP",
				listName: "UK PEP List",
				confidence: 85,
				matchDetails: "Name match with 85% confidence"
				// riskLevel removed - pending business definition
			};

			expect(hit.listType).toBe("PEP");
			expect(hit.confidence).toBe(85);
			// Risk level testing removed - pending business definition
		});
	});

	describe("TruliooPSCScreeningResult", () => {
		it("should create valid screening result", () => {
			const result: TruliooPSCScreeningResult = {
				person: {
					fullName: "John Smith",
					firstName: "John",
					lastName: "Smith",
					dateOfBirth: "1980-01-15",
					addressLine1: "123 Main Street",
					city: "London",
					postalCode: "SW1A 1AA",
					country: "GB",
					controlType: "UBO"
				},
				status: "COMPLETED",
				watchlistHits: [],
				// riskScore removed - pending business definition
				provider: "trulioo",
				screenedAt: "2024-01-15T10:30:00Z"
			};

			expect(result.status).toBe("COMPLETED");
			expect(result.provider).toBe("trulioo");
			// Risk score testing removed - pending business definition
		});
	});
});
