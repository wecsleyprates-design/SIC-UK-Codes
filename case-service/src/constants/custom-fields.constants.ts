export const SECTION_VISIBILITY = {
	DEFAULT: "Default",
	HIDDEN: "Hidden"
};
export type SectionVisibility = (typeof SECTION_VISIBILITY)[keyof typeof SECTION_VISIBILITY];
export const FIELD_ACCESS = {
	DEFAULT: "DEFAULT",
	HIDDEN: "HIDDEN", // Same as "no access"
	READ_ONLY: "READ_ONLY",
	READ_WRITE: "READ_WRITE",
	WRITE_ONLY: "WRITE_ONLY"
} as const;

export type FieldAccess = (typeof FIELD_ACCESS)[keyof typeof FIELD_ACCESS];

export const FIELD_PROPERTY = {
	TEXT: 1,
	DROPDOWN: 2,
	INTEGER: 3,
	FULL_TEXT: 4,
	UPLOAD: 5,
	PHONE_NUMBER: 6,
	EMAIL: 7,
	BOOLEAN: 8,
	ALPHANUMERIC: 9,
	DECIMAL: 10,
	CHECKBOX: 11,
	DATE: 12
} as const;
