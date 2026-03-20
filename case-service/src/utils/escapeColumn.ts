import { ident } from "pg-format";

const VALID_TYPECAST_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Escapes a column name with optional table and optional type cast.
 * Supported formats: 'column', 'table.column', 'column::type', 'table.column::type'
 */
export const escapeColumn = (unescaped: string) => {
	const [beforeCast, typecast] = unescaped.split("::");
	const parts = beforeCast.split(".");

	let escaped = parts.length === 2 ? `${ident(parts[0])}.${ident(parts[1])}` : ident(parts[0]);

	if (typecast) {
		if (!VALID_TYPECAST_REGEX.test(typecast)) {
			throw new Error(`Invalid type cast: ${typecast}`);
		}
		escaped += `::${typecast}`;
	}

	return escaped;
};
