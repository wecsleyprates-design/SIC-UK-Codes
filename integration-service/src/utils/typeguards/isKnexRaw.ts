import type { Knex } from "knex";
import { isObjectWithKeys } from "./isObjectWithKeys";

export const isKnexRaw = (candidate: unknown): candidate is Knex.Raw => {
	return isObjectWithKeys(candidate, "toSQL");
};
