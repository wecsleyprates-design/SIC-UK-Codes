import { FieldsToEncrypt } from "#types";

export const OWNER_TYPES = {
	CONTROL: "CONTROL",
	BENEFICIARY: "BENEFICIARY"
} as const;
export type OwnerType = keyof typeof OWNER_TYPES;

export const OWNER_FIELDS_TO_ENCRYPT: FieldsToEncrypt = {
	ssn: {
		field: "last_four_of_ssn",
		fn: (str: string | number): string => {
			if (typeof str !== "string") {
				str = str.toString();
			}
			return str.substring(str.length - 4);
		}
	},
	date_of_birth: {
		field: "year_of_birth",
		fn: (str: string | Date | number): string => {
			if (typeof str !== "string") {
				str = str.toString();
			}
			return str.substring(0, 4);
		}
	}
};
