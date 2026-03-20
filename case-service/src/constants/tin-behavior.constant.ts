export enum TIN_BEHAVIOR {
	MASK, // Mask the string e.g.: 987654321 becomes ****4321
	ENCRYPT, // Normal encrypted value as exists in DB
	PLAIN // plain text 987654321 -- should never be leaked out of service
}
