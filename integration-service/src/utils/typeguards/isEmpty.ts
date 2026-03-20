/**
 * Checks if a given value is empty.
 * @param a - The value to check.
 * @returns `true` if the value is empty, otherwise `false`.
 *
 * Note: This currently only works on objects, arrays, sets, maps, strings, and symbols.
 *       You are more than welcome to add support for more types to this function if needed :)
 *
 * @example
 * isEmpty(null);                    // true, null value
 * isEmpty(undefined);               // true, undefined
 * isEmpty(new Set());               // true, empty set
 * isEmpty(new Map());               // true, empty map
 * isEmpty([]);                      // true, empty array
 * isEmpty({});                      // true, empty object
 * isEmpty("");                      // true, empty string
 * isEmpty(Symbol.for("empty"));     // true, symbol
 *
 * isEmpty(new Set([1]));          	 // false, non-empty set
 * isEmpty(new Map([["key", 1]])); 	 // false, non-empty map
 * isEmpty([1]);                   	 // false, non-empty array
 * isEmpty({ key: 1 });            	 // false, non-empty object
 * isEmpty("1");                   	 // false, non-empty string
 * isEmpty(Symbol.for("non-empty")); // false, non-empty symbol
 *
 * isEmpty(0);                       // false, number (not currently supported)
 */
export const isEmpty = <T extends Set<any> | Map<any, any> | Array<any> | Record<string, any> | string | symbol>(
	a: unknown
): a is T => {
	if (a === null || a === undefined) return true;
	else if (a instanceof Set) return a.size === 0;
	else if (a instanceof Map) return a.size === 0;
	else if (Array.isArray(a)) return a.length === 0;
	else if (typeof a === "object") return Object.keys(a).length === 0;
	else if (typeof a === "string") return a.trim() === "";
	else if (typeof a === "symbol") return a === Symbol.for("empty");
	else return false;
};
