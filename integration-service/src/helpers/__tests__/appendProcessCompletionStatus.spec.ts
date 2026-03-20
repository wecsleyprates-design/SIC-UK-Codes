// @ts-nocheck
import { areAllKybProcessStatusesTerminal } from "../kyb";

describe("areAllKybProcessStatusesTerminal", () => {
	it("returns true when every status is terminal", () => {
		const tasks = {
			a: { status: "COMPLETED", timestamp: "2025-01-01T00:00:00Z" },
			b: { status: "FAILED", timestamp: "2025-01-01T00:01:00Z" },
			c: { status: "SUCCESS", timestamp: "2025-01-01T00:02:00Z" },
			d: { status: "ERRORED", timestamp: "2025-01-01T00:03:00Z" }
		};
		expect(areAllKybProcessStatusesTerminal(tasks)).toBe(true);
	});

	it("returns false if any status is non-terminal", () => {
		const tasks = {
			a: { status: "COMPLETED", timestamp: "" },
			b: { status: "IN_PROGRESS", timestamp: "" }
		};
		expect(areAllKybProcessStatusesTerminal(tasks)).toBe(false);
	});

	it("returns false when there are no tasks", () => {
		expect(areAllKybProcessStatusesTerminal({})).toBe(false);
	});

	it("treats a single terminal-task map as true", () => {
		expect(
			areAllKybProcessStatusesTerminal({
				only: { status: "SUCCESS", timestamp: "" }
			})
		).toBe(true);
	});

	it("treats a single non-terminal-task map as false", () => {
		expect(
			areAllKybProcessStatusesTerminal({
				only: { status: "PENDING", timestamp: "" }
			})
		).toBe(false);
	});
});
