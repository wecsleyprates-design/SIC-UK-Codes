export function mapIdsToLabels<T extends { id: number }>(keys: number[], values: T[], labelKey: keyof T): string[] {
	const valueMap = values.reduce<Record<number, string>>((acc, item) => {
		const label = item[labelKey];
		acc[item.id] = typeof label === "string" ? label : `Invalid label for ID ${item.id}`;
		return acc;
	}, {});

	return keys.map(id => valueMap[id] ?? `Unknown (${id})`);
}
