import { extractPersonNameFromTruliooResponse } from "../utils";

describe("extractPersonNameFromTruliooResponse", () => {
	it("should extract person name from direct fullName field", () => {
		const rawClientData = {
			fullName: "John Travolta",
			firstName: "John",
			lastName: "Travolta"
		};

		const result = extractPersonNameFromTruliooResponse(rawClientData);

		expect(result).toEqual({
			personName: "John Travolta",
			firstName: "John",
			lastName: "Travolta"
		});
	});

	it("should extract person name from personName field", () => {
		const rawClientData = {
			personName: "Jane Doe"
		};

		const result = extractPersonNameFromTruliooResponse(rawClientData);

		expect(result).toEqual({
			personName: "Jane Doe",
			firstName: undefined,
			lastName: undefined
		});
	});

	it("should extract person name from firstName + lastName combination", () => {
		const rawClientData = {
			firstName: "John",
			lastName: "Travolta"
		};

		const result = extractPersonNameFromTruliooResponse(rawClientData);

		expect(result).toEqual({
			personName: "John Travolta",
			firstName: "John",
			lastName: "Travolta"
		});
	});

	it("should extract person name from flowData.fieldData with first_name and last_name roles", () => {
		const rawClientData = {
			flowData: {
				"68c1c50b5e5acf081d6c8ca7": {
					id: "68c1c50b5e5acf081d6c8ca7",
					completed: true,
					fieldData: {
						"68c1e1855e5acf081d6c8f0b": {
							id: "68c1e1855e5acf081d6c8f0b",
							name: "First name",
							value: ["John"],
							role: "first_name"
						},
						"68c1e1860fcf327e2fcda1bf": {
							id: "68c1e1860fcf327e2fcda1bf",
							name: "Last name",
							value: ["Travolta"],
							role: "last_name"
						}
					}
				}
			}
		};

		const result = extractPersonNameFromTruliooResponse(rawClientData);

		expect(result).toEqual({
			personName: "John Travolta",
			firstName: "John",
			lastName: "Travolta"
		});
	});

	it("should extract person name from flowData.fieldData with only first_name", () => {
		const rawClientData = {
			flowData: {
				"68c1c50b5e5acf081d6c8ca7": {
					fieldData: {
						"68c1e1855e5acf081d6c8f0b": {
							value: ["John"],
							role: "first_name"
						}
					}
				}
			}
		};

		const result = extractPersonNameFromTruliooResponse(rawClientData);

		expect(result).toEqual({
			personName: "John",
			firstName: "John",
			lastName: undefined
		});
	});

	it("should extract person name from flowData.fieldData with only last_name", () => {
		const rawClientData = {
			flowData: {
				"68c1c50b5e5acf081d6c8ca7": {
					fieldData: {
						"68c1e1860fcf327e2fcda1bf": {
							value: ["Travolta"],
							role: "last_name"
						}
					}
				}
			}
		};

		const result = extractPersonNameFromTruliooResponse(rawClientData);

		expect(result).toEqual({
			personName: "Travolta",
			firstName: undefined,
			lastName: "Travolta"
		});
	});

	it("should prioritize direct fields over flowData.fieldData", () => {
		const rawClientData = {
			fullName: "Direct Name",
			flowData: {
				"68c1c50b5e5acf081d6c8ca7": {
					fieldData: {
						"68c1e1855e5acf081d6c8f0b": {
							value: ["John"],
							role: "first_name"
						},
						"68c1e1860fcf327e2fcda1bf": {
							value: ["Travolta"],
							role: "last_name"
						}
					}
				}
			}
		};

		const result = extractPersonNameFromTruliooResponse(rawClientData);

		expect(result?.personName).toBe("Direct Name");
	});

	it("should return undefined when no name fields are found", () => {
		const rawClientData = {
			id: "some-id",
			status: "ACCEPTED"
		};

		const result = extractPersonNameFromTruliooResponse(rawClientData);

		expect(result).toBeUndefined();
	});

	it("should return undefined when rawClientData is null or undefined", () => {
		expect(extractPersonNameFromTruliooResponse(null)).toBeUndefined();
		expect(extractPersonNameFromTruliooResponse(undefined)).toBeUndefined();
	});

	it("should handle flowData with multiple flow items and extract from first matching one", () => {
		const rawClientData = {
			flowData: {
				"flow1": {
					fieldData: {
						"field1": {
							value: ["John"],
							role: "first_name"
						},
						"field2": {
							value: ["Travolta"],
							role: "last_name"
						}
					}
				},
				"flow2": {
					fieldData: {
						"field3": {
							value: ["Jane"],
							role: "first_name"
						},
						"field4": {
							value: ["Doe"],
							role: "last_name"
						}
					}
				}
			}
		};

		const result = extractPersonNameFromTruliooResponse(rawClientData);

		// Should extract from first flow that has name data (flow1)
		expect(result?.personName).toBe("John Travolta");
		expect(result?.firstName).toBe("John");
		expect(result?.lastName).toBe("Travolta");
	});

	it("should trim whitespace from extracted names", () => {
		const rawClientData = {
			fullName: "  John Travolta  ",
			firstName: "  John  ",
			lastName: "  Travolta  "
		};

		const result = extractPersonNameFromTruliooResponse(rawClientData);

		expect(result?.personName).toBe("John Travolta");
		expect(result?.firstName).toBe("  John  "); // firstName/lastName are not trimmed, only personName
	});
});
