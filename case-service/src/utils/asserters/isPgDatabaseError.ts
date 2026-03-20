import { DatabaseError } from "pg";

export const isPgDatabaseError = (error: unknown): error is DatabaseError => {
	return error instanceof Error && error?.constructor?.name === "DatabaseError";
};
