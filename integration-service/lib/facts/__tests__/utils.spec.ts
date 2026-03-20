import { Fact, FactName, SimpleFact } from "../types";
import { getFactKeys } from "../utils";

describe("getFactKeys", () => {
	it.each`
		input                         | expected
		${[]}                         | ${[]}
		${[{ name: "test" }]}         | ${["test"]}
		${{ test: { name: "test" } }} | ${["test"]}
		${undefined}                  | ${[]}
		${null}                       | ${[]}
		${1}                          | ${[]}
		${"string"}                   | ${[]}
		${true}                       | ${[]}
		${false}                      | ${[]}
	`("should return the correct fact keys for the input $input", ({ input, expected }) => {
		const result = getFactKeys(input);
		expect(result).toEqual(expected);
	});

	it("should return the correct fact keys for a simple fact", () => {
		const simpleFact: SimpleFact = {
			business_name: {
				calculated: {}
			}
		};
		const result = getFactKeys(simpleFact);
		expect(result).toEqual(["business_name"]);
	});

	it("should return the correct fact keys for a fact record", () => {
		const factRecord: Partial<Record<FactName, any>> = {
			business_name: {}
		};
		const result = getFactKeys(factRecord);
		expect(result).toEqual(["business_name"]);
	});

	it("should return the correct fact keys for a fact array", () => {
		const facts: Pick<Fact, "name">[] = [{ name: "business_name" }];
		const result = getFactKeys(facts);
		expect(result).toEqual(["business_name"]);
	});
});
