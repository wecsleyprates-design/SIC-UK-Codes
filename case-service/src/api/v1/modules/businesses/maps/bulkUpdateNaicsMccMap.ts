import { Business, MapperDefinition, MapperField } from "#types/index";
import { v4 as uuid } from "uuid";
import { Mapper, MapperError } from "../mapper";
import { businesses } from "../businesses";
import type { UUID } from "crypto";
import { db } from "#helpers";

export const coreNaicsMccCode: MapperField[] = [
	{
		column: "mcc_code",
		table: "core_naics_mcc_code",
		alternate: ["MCC"],
		description: "MCC code of Industry",
		isDefault: true,
		sanitize: async (_, value) => parseInt(value)
	},
	{
		column: "mcc_description",
		table: "core_naics_mcc_code",
		alternate: ["MCC Description"],
		description: "MCC code Description of Industry",
		required: false
	},
	{
		column: "naics_code",
		table: "core_naics_mcc_code",
		alternate: ["NAICS"],
		description: "NAICS code of Industry",
		sanitize: async (_, value) => parseInt(value)
	},
	{
		column: "naics_description",
		table: "core_naics_mcc_code",
		alternate: ["NAICS Description"],
		description: "NAICS code Description of Industry",
		required: false
	}
];

export class BulkUpdateNaicsMccMap extends Mapper {
	static MAP: MapperDefinition = {
		tables: {
			core_naics_mcc_code: {
				order: 0,
				process: async (mapper: BulkUpdateNaicsMccMap, fields: MapperField[]) => {
					const naicsMccCodes = fields.reduce((acc, field) => {
						if (field.table === "core_naics_mcc_code") {
							acc[field.column] = field.value;
						}
						return acc;
					}, {} as Business.NaicsAndMccCode);
					try {
						await businesses.bulkUpdateCoreNaicsMccCode(naicsMccCodes);
					} catch (error) {
						throw new MapperError(
							`Unable to validate Naics ans Mcc code data: ${
								error instanceof Error ? error.message : JSON.stringify(error)
							}`
						);
					}
				},
				fields: coreNaicsMccCode
			}
		}
	};

	constructor(input: Map<string, any>, runId = uuid(), threshold = 0.2) {
		super(BulkUpdateNaicsMccMap.MAP, input, { runId: runId as UUID, threshold, knexInstance: db });
	}
}
