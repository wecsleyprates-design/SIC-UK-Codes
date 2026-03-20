import { extractPeopleFromTruliooPerson } from "../peopleHelpers";
import type { TruliooScreenedPersonData } from "#lib/trulioo/common/types";

describe("peopleHelpers", () => {
	describe("extractPeopleFromTruliooPerson", () => {
		it("should extract people from truliooPerson response", async () => {
			const truliooPersonResponse = {
				screenedPersons: [
					{
						fullName: "John Doe",
						firstName: "John",
						lastName: "Doe",
						title: "CEO",
						controlType: "UBO",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData
				]
			};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].name).toBe("John Doe");
			expect(result![0].titles).toContain("CEO");
			expect(result![0].titles).toContain("UBO");
		});

		it("should construct name from firstName and lastName when fullName is missing", async () => {
			const truliooPersonResponse = {
				screenedPersons: [
					{
						firstName: "Jane",
						lastName: "Smith",
						title: "Director",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData
				]
			};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].name).toBe("Jane Smith");
			expect(result![0].titles).toContain("Director");
		});

		it("should use default title when title and controlType are missing", async () => {
			const truliooPersonResponse = {
				screenedPersons: [
					{
						fullName: "Unknown Person",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData
				]
			};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].name).toBe("Unknown Person");
			expect(result![0].titles).toContain("Owner/Controller");
		});

		it("should include both title and controlType when both are present", async () => {
			const truliooPersonResponse = {
				screenedPersons: [
					{
						fullName: "Person With Both",
						title: "CEO",
						controlType: "UBO",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData
				]
			};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].titles).toHaveLength(2);
			expect(result![0].titles).toContain("CEO");
			expect(result![0].titles).toContain("UBO");
		});

		it("should skip people without names", async () => {
			const truliooPersonResponse = {
				screenedPersons: [
					{
						firstName: "",
						lastName: "",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData,
					{
						fullName: "Valid Person",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData
				]
			};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].name).toBe("Valid Person");
		});

		it("should return undefined when no screened people exist", async () => {
			const truliooPersonResponse = {
				screenedPersons: []
			};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeUndefined();
		});

		it("should return undefined when screenedPersons is missing", async () => {
			const truliooPersonResponse = {};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeUndefined();
		});

		it("should handle multiple people", async () => {
			const truliooPersonResponse = {
				screenedPersons: [
					{
						fullName: "Person One",
						title: "CEO",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData,
					{
						fullName: "Person Two",
						title: "CFO",
						controlType: "DIRECTOR",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData
				]
			};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeDefined();
			expect(result).toHaveLength(2);
			expect(result![0].name).toBe("Person One");
			expect(result![1].name).toBe("Person Two");
			expect(result![1].titles).toContain("CFO");
			expect(result![1].titles).toContain("DIRECTOR");
		});

		it("should handle name construction with only firstName", async () => {
			const truliooPersonResponse = {
				screenedPersons: [
					{
						firstName: "SingleName",
						lastName: "",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData
				]
			};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].name).toBe("SingleName");
		});

		it("should handle name construction with only lastName", async () => {
			const truliooPersonResponse = {
				screenedPersons: [
					{
						firstName: "",
						lastName: "LastNameOnly",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData
				]
			};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].name).toBe("LastNameOnly");
		});

		it("should set jurisdictions as undefined", async () => {
			const truliooPersonResponse = {
				screenedPersons: [
					{
						fullName: "Test Person",
						screeningStatus: "completed",
						screeningResults: {}
					} as TruliooScreenedPersonData
				]
			};

			const result = await extractPeopleFromTruliooPerson(truliooPersonResponse);

			expect(result).toBeDefined();
			expect(result![0].jurisdictions).toBeUndefined();
		});
	});
});
