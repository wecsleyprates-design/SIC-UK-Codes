export function sanitizeBusinessName(name: string | undefined): string | undefined {
	if (!name) return undefined;
	name = name.replace(/\s+AND\s+/gi, " & ");
	name = name.replace(/[^A-Za-z0-9 &]+/, "");
	return name;
}
