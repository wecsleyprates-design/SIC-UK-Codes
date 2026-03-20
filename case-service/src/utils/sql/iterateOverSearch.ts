import { escapeRegExp } from "#utils/escapeRegExp";

interface Search {
	[columnName: string | `${string}::${string}`]: string | string[] | undefined;
}

/**
 * Iterates over the query.search object and applies a callback function to each column name and the associated trimmed value.
 */
export const iterateOverSearch = (search: Search, callbackfn: (columnName: string, escapedValue: string) => void) => {
	const columns = Object.keys(search);
	columns.forEach(column => {
		const value = search[column];
		if (value === undefined) return;

		const values = Array.isArray(value) ? value : [value];
		values.forEach(v => {
			if (!v) return;

			const value = escapeRegExp(v.trim()).trim();
			callbackfn(column, value);
		});
	});
};
