import type { MapperField } from "#types";
import type { BusinessState } from "../../businessState";
import type { Mapper } from "../../mapper";
import { assertTruthy } from "../utils";

const baseBusinessNamesField: MapperField[] = [
	// DBA Name: 1
	{
		column: "dba",
		description: "The dba name of the business",
		table: "data_business_names",
		required: false,
		sanitize: async (_, str) => (str as string).toString().substring(0, 255).trim(),
		validate: async (_, field) =>
			assertTruthy(typeof field.value === "string" && field.value.length <= 255 && field.value.length >= 0, field)
	}
];

// Construct "dba{n}_" fields for n = 2, 3, 4, 5
export function getBusinessNamesFields() {
	return (baseBusinessNamesField as MapperField[]).reduce((acc, field) => {
		for (let i = 1; i <= 5; i++) {
			const column = field.column.replace("dba", `dba${i}_name`);
			acc.push({
				...field,
				column,
				description: (field.description ?? "").concat(` #${i}`),
				alternate: [column, column.replace("_name", "")], // allow dba1, dba2, etc.
				pathKey: "data_business_names[].name"
			});
		}
		return acc;
	}, [] as MapperField[]);
}

export const collectBusinessNames = async (mapper: Mapper, fields: MapperField[]): Promise<void> => {
	const metadata = mapper.getAdditionalMetadata();
	const { originalState }: { originalState: BusinessState } = metadata;

	const currentNames = originalState?.getState()?.data_business_names ?? [];
	const nameMap: Map<string, { name: string; is_primary?: boolean }> = new Map();
	currentNames.forEach(row => {
		nameMap.set(row.name, row);
	});
	fields.forEach(field => {
		if (field.pathKey === "data_business_names[].name") {
			if (!nameMap.has(field.value)) {
				nameMap.set(field.value, { name: field.value, is_primary: false });
			}
		}
	});
	mapper.addAdditionalMetadata({
		dba_names: Array.from(nameMap.values())
	});
};
