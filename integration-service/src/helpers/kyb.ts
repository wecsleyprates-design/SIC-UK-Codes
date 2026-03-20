/**
 * Check if every KYB task status is terminal.
 *
 * Terminal statuses are: COMPLETED, FAILED, SUCCESS, ERRORED.
 * Returns false if no tasks or any status is non-terminal.
 *
 * @param tasks – Map of task IDs to { status, timestamp }.
 * @returns true if ≥1 task and all statuses are terminal; otherwise false.
 */
export function areAllKybProcessStatusesTerminal(tasks: Record<string, { status: string; timestamp: string }>): boolean {
	const terminalStatuses = new Set(["COMPLETED", "FAILED", "SUCCESS", "ERRORED"]);
	const statuses = Object.values(tasks).map(t => t.status);
	return statuses.length > 0 && statuses.every(s => terminalStatuses.has(s));
}
