import { sanitizeBusinessName } from "#api/v1/modules/verification/util";

type MaybeName = string | undefined | null;

export const getUniqueBusinessNames = (...names: (MaybeName | MaybeName[])[]): string[] => {
	let uniqueNames = new Set<string>();
	names.flat().forEach(n => {
		const name = sanitizeBusinessName(n ?? undefined);
		if (name) uniqueNames.add(name);
	});
	return Array.from(uniqueNames);
};
