/**
 * Tests for Owner Converters
 * Tests conversion of owners from different sources (Middesk, applicant flow, business_entity_people) to TruliooUBOPersonData
 */

import {
	convertMiddeskOwnerToTruliooPerson,
	convertApplicantFlowOwnerToTruliooPerson,
	convertOwnersToTruliooPersons,
	convertBusinessEntityPersonToTruliooPerson,
	convertDiscoveredOfficersToTruliooPersons,
	deduplicatePersons
} from "../ownerConverters";
import type { BusinessOwner } from "#helpers/api";
import type { IBusinessEntityPerson } from "#types/db";
import type { TruliooUBOPersonData } from "../types";

describe("Owner Converters", () => {
	describe("convertMiddeskOwnerToTruliooPerson", () => {
		it("should convert valid Middesk owner to TruliooUBOPersonData", () => {
			const middeskOwner: BusinessOwner = {
				owner_type: "individual",
				first_name: "John",
				last_name: "Doe",
				address_line_1: "123 Main St",
				address_city: "New York",
				address_state: "NY",
				address_postal_code: "10001",
				address_country: "US",
				mobile: "+1234567890",
				ssn: "123-45-6789",
				date_of_birth: "1990-01-01",
				email: "john.doe@example.com",
				ownership_percentage: 50,
				title: {
					id: 1,
					title: "CEO"
				}
			};

			const result = convertMiddeskOwnerToTruliooPerson(middeskOwner);

			expect(result).not.toBeNull();
			expect(result?.fullName).toBe("John Doe");
			expect(result?.firstName).toBe("John");
			expect(result?.lastName).toBe("Doe");
			expect(result?.dateOfBirth).toBe("1990-01-01");
			expect(result?.addressLine1).toBe("123 Main St");
			expect(result?.city).toBe("New York");
			expect(result?.state).toBe("NY");
			expect(result?.postalCode).toBe("10001");
			expect(result?.country).toBe("US");
			expect(result?.email).toBe("john.doe@example.com");
			expect(result?.phone).toBe("+1234567890");
			expect(result?.ownershipPercentage).toBe(50);
			expect(result?.controlType).toBe("UBO");
			expect(result?.title).toBe("CEO");
		});

		it("should handle owner with only first_name", () => {
			const middeskOwner: BusinessOwner = {
				owner_type: "individual",
				first_name: "John",
				last_name: "",
				address_line_1: "123 Main St",
				address_city: "New York",
				address_state: "NY",
				address_postal_code: "10001",
				address_country: "US",
				mobile: "",
				ssn: "",
				date_of_birth: ""
			};

			const result = convertMiddeskOwnerToTruliooPerson(middeskOwner);

			expect(result).not.toBeNull();
			expect(result?.fullName).toBe("John");
			expect(result?.firstName).toBe("John");
			expect(result?.lastName).toBe("");
		});

		it("should return null for owner missing both first_name and last_name", () => {
			const middeskOwner: BusinessOwner = {
				owner_type: "individual",
				first_name: "",
				last_name: "",
				address_line_1: "123 Main St",
				address_city: "New York",
				address_state: "NY",
				address_postal_code: "10001",
				address_country: "US",
				mobile: "",
				ssn: "",
				date_of_birth: ""
			};

			const result = convertMiddeskOwnerToTruliooPerson(middeskOwner);

			expect(result).toBeNull();
		});

		it("should handle optional fields gracefully", () => {
			const middeskOwner: BusinessOwner = {
				owner_type: "individual",
				first_name: "Jane",
				last_name: "Smith",
				address_line_1: "456 Oak Ave",
				address_city: "Los Angeles",
				address_state: "CA",
				address_postal_code: "90001",
				address_country: "US",
				mobile: "",
				ssn: "",
				date_of_birth: "",
				email: null,
				ownership_percentage: null,
				title: undefined
			};

			const result = convertMiddeskOwnerToTruliooPerson(middeskOwner);

			expect(result).not.toBeNull();
			expect(result?.email).toBeUndefined();
			expect(result?.ownershipPercentage).toBeUndefined();
			expect(result?.title).toBeUndefined();
		});
	});

	describe("convertApplicantFlowOwnerToTruliooPerson", () => {
		it("should convert applicant flow owner using same logic as Middesk", () => {
			const applicantOwner: BusinessOwner = {
				owner_type: "individual",
				first_name: "Alice",
				last_name: "Johnson",
				address_line_1: "789 Pine Rd",
				address_city: "Chicago",
				address_state: "IL",
				address_postal_code: "60601",
				address_country: "US",
				mobile: "+1987654321",
				ssn: "987-65-4321",
				date_of_birth: "1985-05-15",
				email: "alice.johnson@example.com",
				ownership_percentage: 25,
				title: {
					id: 2,
					title: "CFO"
				}
			};

			const result = convertApplicantFlowOwnerToTruliooPerson(applicantOwner);

			expect(result).not.toBeNull();
			expect(result?.fullName).toBe("Alice Johnson");
			expect(result?.controlType).toBe("UBO");
		});
	});

	describe("convertOwnersToTruliooPersons", () => {
		it("should convert array of valid owners", () => {
			const owners: BusinessOwner[] = [
				{
					owner_type: "individual",
					first_name: "John",
					last_name: "Doe",
					address_line_1: "123 Main St",
					address_city: "New York",
					address_state: "NY",
					address_postal_code: "10001",
					address_country: "US",
					mobile: "",
					ssn: "",
					date_of_birth: ""
				},
				{
					owner_type: "individual",
					first_name: "Jane",
					last_name: "Smith",
					address_line_1: "456 Oak Ave",
					address_city: "Los Angeles",
					address_state: "CA",
					address_postal_code: "90001",
					address_country: "US",
					mobile: "",
					ssn: "",
					date_of_birth: ""
				}
			];

			const result = convertOwnersToTruliooPersons(owners, "Test Source");

			expect(result).toHaveLength(2);
			expect(result[0].fullName).toBe("John Doe");
			expect(result[1].fullName).toBe("Jane Smith");
		});

		it("should filter out invalid owners", () => {
			const owners: BusinessOwner[] = [
				{
					owner_type: "individual",
					first_name: "John",
					last_name: "Doe",
					address_line_1: "123 Main St",
					address_city: "New York",
					address_state: "NY",
					address_postal_code: "10001",
					address_country: "US",
					mobile: "",
					ssn: "",
					date_of_birth: ""
				},
				{
					owner_type: "individual",
					first_name: "",
					last_name: "",
					address_line_1: "456 Oak Ave",
					address_city: "Los Angeles",
					address_state: "CA",
					address_postal_code: "90001",
					address_country: "US",
					mobile: "",
					ssn: "",
					date_of_birth: ""
				}
			];

			const result = convertOwnersToTruliooPersons(owners, "Test Source");

			expect(result).toHaveLength(1);
			expect(result[0].fullName).toBe("John Doe");
		});

		it("should return empty array for null/undefined input", () => {
			expect(convertOwnersToTruliooPersons(null, "Test Source")).toEqual([]);
			expect(convertOwnersToTruliooPersons(undefined, "Test Source")).toEqual([]);
		});

		it("should return empty array for empty array", () => {
			expect(convertOwnersToTruliooPersons([], "Test Source")).toEqual([]);
		});
	});

	describe("convertBusinessEntityPersonToTruliooPerson", () => {
		const makeOfficer = (overrides: Partial<IBusinessEntityPerson> = {}): IBusinessEntityPerson => ({
			id: "test-id" as any,
			business_entity_verification_id: "test-bev-id" as any,
			created_at: "2024-01-01T00:00:00Z" as any,
			updated_at: "2024-01-01T00:00:00Z" as any,
			name: "Ali Muhsin",
			submitted: false,
			metadata: null,
			source: JSON.stringify([{ type: "registration", id: "source-1" }]),
			titles: ["CEO"],
			...overrides
		});

		it("should convert a Middesk-discovered officer with name and title", () => {
			const officer = makeOfficer({ name: "Ali Muhsin", titles: ["CEO"] });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");

			expect(result).not.toBeNull();
			expect(result?.fullName).toBe("Ali Muhsin");
			expect(result?.firstName).toBe("Ali");
			expect(result?.lastName).toBe("Muhsin");
			expect(result?.controlType).toBe("DIRECTOR");
			expect(result?.title).toBe("CEO");
			expect(result?.country).toBe("US");
			expect(result?.dateOfBirth).toBe("");
			expect(result?.addressLine1).toBe("");
		});

		it("should handle officer with multi-part last name", () => {
			const officer = makeOfficer({ name: "John Michael Smith Jr" });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");

			expect(result).not.toBeNull();
			expect(result?.firstName).toBe("John");
			expect(result?.lastName).toBe("Michael Smith Jr");
		});

		it("should handle officer with single name (no last name)", () => {
			const officer = makeOfficer({ name: "Madonna" });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");

			expect(result).not.toBeNull();
			expect(result?.firstName).toBe("Madonna");
			expect(result?.lastName).toBe("");
		});

		it("should return null for officer with empty name", () => {
			const officer = makeOfficer({ name: "" });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");
			expect(result).toBeNull();
		});

		it("should return null for officer with whitespace-only name", () => {
			const officer = makeOfficer({ name: "   " });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");
			expect(result).toBeNull();
		});

		it("should use first title from titles array", () => {
			const officer = makeOfficer({ titles: ["CEO", "President", "Director"] });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");
			expect(result?.title).toBe("CEO");
		});

		it("should handle officer with empty titles array", () => {
			const officer = makeOfficer({ titles: [] });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");
			expect(result?.title).toBeUndefined();
		});

		it("should trim whitespace from name", () => {
			const officer = makeOfficer({ name: "  Ali Muhsin  " });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");
			expect(result?.fullName).toBe("Ali Muhsin");
		});

		it("should return null for officer with null name", () => {
			const officer = makeOfficer({ name: null as any });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");
			expect(result).toBeNull();
		});

		it("should return null for officer with undefined name", () => {
			const officer = makeOfficer({ name: undefined as any });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");
			expect(result).toBeNull();
		});

		it("should handle null titles gracefully", () => {
			const officer = makeOfficer({ titles: null as any });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");
			expect(result).not.toBeNull();
			expect(result?.title).toBeUndefined();
		});

		it("should handle undefined titles gracefully", () => {
			const officer = makeOfficer({ titles: undefined as any });
			const result = convertBusinessEntityPersonToTruliooPerson(officer, "US");
			expect(result).not.toBeNull();
			expect(result?.title).toBeUndefined();
		});
	});

	describe("convertDiscoveredOfficersToTruliooPersons", () => {
		const makeOfficer = (name: string, titles: string[] = []): IBusinessEntityPerson => ({
			id: "test-id" as any,
			business_entity_verification_id: "test-bev-id" as any,
			created_at: "2024-01-01T00:00:00Z" as any,
			updated_at: "2024-01-01T00:00:00Z" as any,
			name,
			submitted: false,
			metadata: null,
			source: JSON.stringify([]),
			titles
		});

		it("should convert array of discovered officers", () => {
			const officers = [
				makeOfficer("Ali Muhsin", ["CEO"]),
				makeOfficer("Taher Hasson", ["President"])
			];
			const result = convertDiscoveredOfficersToTruliooPersons(officers, "US");

			expect(result).toHaveLength(2);
			expect(result[0].fullName).toBe("Ali Muhsin");
			expect(result[0].title).toBe("CEO");
			expect(result[1].fullName).toBe("Taher Hasson");
			expect(result[1].title).toBe("President");
		});

		it("should filter out officers with invalid names", () => {
			const officers = [
				makeOfficer("Ali Muhsin", ["CEO"]),
				makeOfficer("", []),
				makeOfficer("Taher Hasson", ["President"])
			];
			const result = convertDiscoveredOfficersToTruliooPersons(officers, "US");
			expect(result).toHaveLength(2);
		});

		it("should return empty array for null input", () => {
			expect(convertDiscoveredOfficersToTruliooPersons(null, "US")).toEqual([]);
		});

		it("should return empty array for undefined input", () => {
			expect(convertDiscoveredOfficersToTruliooPersons(undefined, "US")).toEqual([]);
		});

		it("should return empty array for empty array input", () => {
			expect(convertDiscoveredOfficersToTruliooPersons([], "US")).toEqual([]);
		});

		it("should propagate businessCountry to each converted officer", () => {
			const officers = [
				makeOfficer("Ali Muhsin", ["CEO"]),
				makeOfficer("Taher Hasson", ["President"])
			];
			const result = convertDiscoveredOfficersToTruliooPersons(officers, "US");

			expect(result).toHaveLength(2);
			expect(result[0].country).toBe("US");
			expect(result[1].country).toBe("US");
		});
	});

	describe("deduplicatePersons", () => {
		it("should remove duplicate persons by fullName (case-insensitive)", () => {
			const persons: TruliooUBOPersonData[] = [
				{
					fullName: "John Doe",
					firstName: "John",
					lastName: "Doe",
					dateOfBirth: "",
					addressLine1: "",
					city: "",
					postalCode: "",
					country: "",
					controlType: "UBO"
				},
				{
					fullName: "JOHN DOE",
					firstName: "John",
					lastName: "Doe",
					dateOfBirth: "",
					addressLine1: "",
					city: "",
					postalCode: "",
					country: "",
					controlType: "UBO"
				},
				{
					fullName: "Jane Smith",
					firstName: "Jane",
					lastName: "Smith",
					dateOfBirth: "",
					addressLine1: "",
					city: "",
					postalCode: "",
					country: "",
					controlType: "UBO"
				}
			];

			const result = deduplicatePersons(persons);

			expect(result).toHaveLength(2);
			expect(result[0].fullName).toBe("John Doe");
			expect(result[1].fullName).toBe("Jane Smith");
		});

		it("should handle persons with whitespace differences", () => {
			const persons: TruliooUBOPersonData[] = [
				{
					fullName: "  John Doe  ",
					firstName: "John",
					lastName: "Doe",
					dateOfBirth: "",
					addressLine1: "",
					city: "",
					postalCode: "",
					country: "",
					controlType: "UBO"
				},
				{
					fullName: "John Doe",
					firstName: "John",
					lastName: "Doe",
					dateOfBirth: "",
					addressLine1: "",
					city: "",
					postalCode: "",
					country: "",
					controlType: "UBO"
				}
			];

			const result = deduplicatePersons(persons);

			expect(result).toHaveLength(1);
		});

		it("should return same array if no duplicates", () => {
			const persons: TruliooUBOPersonData[] = [
				{
					fullName: "John Doe",
					firstName: "John",
					lastName: "Doe",
					dateOfBirth: "",
					addressLine1: "",
					city: "",
					postalCode: "",
					country: "",
					controlType: "UBO"
				},
				{
					fullName: "Jane Smith",
					firstName: "Jane",
					lastName: "Smith",
					dateOfBirth: "",
					addressLine1: "",
					city: "",
					postalCode: "",
					country: "",
					controlType: "UBO"
				}
			];

			const result = deduplicatePersons(persons);

			expect(result).toHaveLength(2);
		});

		it("should return empty array for empty input", () => {
			expect(deduplicatePersons([])).toEqual([]);
		});
	});
});
