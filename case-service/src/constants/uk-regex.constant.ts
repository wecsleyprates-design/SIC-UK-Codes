export const UK_REGISTRATION_REGEX = {
	UK_UTR: /^\d{10}$/u, // UTR: 10-digit Unique Taxpayer Reference
	UK_NINO: /^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]?$/u, // NINO: 2 prefix letters (excluding some), 6 digits, optional suffix (A–D)
	UK_CRN: /^(\d{8}|[A-Z]{2}\d{6})$/u, // CRN: 8 digits or 2 letters followed by 6 digits
	UK_VAT: /^(GB)?\d{9}(\d{3})?$/u // VAT: Optional 'GB' prefix, 9 digits, optional 3-digit branch suffix
} as const;
