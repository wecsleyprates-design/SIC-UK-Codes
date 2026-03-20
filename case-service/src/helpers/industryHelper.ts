/* A small in memory cache of industries names to their respective IDs to avoid unnecessary DB calls*/
import { db } from "./knex";

export const industryMapBySectorName = new Map<string, number>();
export const industryMapBySectorCode = new Map<number, number>();

export const populateIndustryMaps = async () => {
	const industryRows = await db("core_business_industries").select("id", "name", "code", "sector_code");
	industryRows.forEach(industry => {
		const name = industry.name.toLowerCase();
		industryMapBySectorName.set(name, industry.id);
		if (industry.sector_code.includes("-")) {
			// Convert the range to numbers
			const sectorCodes = convertRangeToNumbers(industry.sector_code);
			sectorCodes.forEach(code => {
				industryMapBySectorCode.set(code, industry.id);
			});
		} else {
			const sectorCode = parseInt(industry.sector_code);
			if (sectorCode && !isNaN(sectorCode)) {
				industryMapBySectorCode.set(sectorCode, industry.id);
			}
		}
	});
};

function convertRangeToNumbers(rangeStr: string): number[] {
	// Split the input string by the dash
	const [startStr, endStr] = rangeStr.split("-");

	// Convert the split strings to integers
	const startNum = parseInt(startStr, 10);
	const endNum = parseInt(endStr, 10);
	if (isNaN(startNum) || isNaN(endNum)) {
		return [];
	}
	// Generate the range of numbers
	const numberList: number[] = [];
	for (let i = startNum; i <= endNum; i++) {
		numberList.push(i);
	}

	return numberList;
}
