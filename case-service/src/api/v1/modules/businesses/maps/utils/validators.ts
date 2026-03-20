import { logger } from "#helpers";
import type { MapperField } from "#types";
import { MapperError } from "../../mapper";

export const assertTruthy = (value: boolean, field?: MapperField) => {
	if (!value) {
		logger.error({ field, message: "Validation failed" });
		if (field) {
			throw new MapperError(`Validation failed`, field);
		}
		throw new Error(`Validation failed`);
	}
};

export const validatePercentage = async (mapper, field) =>
	assertTruthy(typeof field.value === "number" && field.value >= 0 && field.value <= 100, field);
export const validateRoutingNumber = async (mapper, field) =>
	assertTruthy(field && ("" + field.value).length === 9, field);
export const validateWireRoutingNumber = async (mapper, field) =>
	assertTruthy((field && ("" + field.value).length === 9) || field.value == "", field);
export const validateBankAccountType = async (mapper, field) => assertTruthy(typeof field?.value === "string", field);

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];
export const validateHighVolumeMonths = async (mapper, field) =>
	assertTruthy(
		typeof field.value === "string" &&
			field.value
				.replaceAll(" ", "")
				.split(",")
				.every((item: string) => MONTH_NAMES.includes(item))
	);
