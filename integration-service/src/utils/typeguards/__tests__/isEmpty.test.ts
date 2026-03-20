import { isEmpty } from "../isEmpty";

describe("isEmpty", () => {
	test.each`
		input                      | expected
		${null}                    | ${true}
		${undefined}               | ${true}
		${new Set()}               | ${true}
		${new Map()}               | ${true}
		${[]}                      | ${true}
		${{}}                      | ${true}
		${""}                      | ${true}
		${Symbol.for("empty")}     | ${true}
		${new Set([1])}            | ${false}
		${new Map([["key", 1]])}   | ${false}
		${[1]}                     | ${false}
		${{ key: 1 }}              | ${false}
		${"1"}                     | ${false}
		${Symbol.for("non-empty")} | ${false}
	`("should return $expected for $input", ({ input, expected }) => {
		expect(isEmpty(input)).toBe(expected);
	});
});
