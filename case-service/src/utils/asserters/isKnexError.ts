interface KnexError<T> extends Error {
	nativeError?: T;
	sql?: string;
	bindings?: unknown[];
}

const KNEX_STACK_MARKER = "knex/lib/";

/**
 * Type guard for errors that originated from Knex (stack contains knex/lib/ at top frames).
 */
export const isKnexError = <T = Error>(error: unknown): error is KnexError<T> => {
	if (error instanceof Error && Object.hasOwn(error, "nativeError")) {
		return true;
	}
	if (!(error instanceof Error) || !error.stack) {
		return false;
	}
	const stackLines = error.stack.split("\n");
	const topFrames = [stackLines[0], stackLines[1]].filter(Boolean);
	return topFrames.some(frame => frame.includes(KNEX_STACK_MARKER));
};
