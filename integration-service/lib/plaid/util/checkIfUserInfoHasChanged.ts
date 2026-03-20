import type { IIdentityVerification } from "#types/db";
import type { Owner } from "#types/worthApi";
import { safeDecrypt } from "#utils/encryption";

/**
 * Checks if the owner's information has changed compared to what was verified in a previous IDV record.
 *
 * Compares non-encrypted fields including:
 * - Name (first/last)
 * - Email
 * - Phone
 * - Address (street, city, state, postal code, country)
 *
 * Compares encrypted fields by decrypting them and comparing the values:
 * - SSN
 * - DOB
 *
 * @param owner - The current owner information
 * @param record - The previous identity verification record
 * @returns true if any information has changed, false if all fields match
 */
export function checkIfUserInfoHasChanged(owner: Owner, record: IIdentityVerification): boolean {
	const user = record.meta?.user;
	if (!user) return true; /** No previous data = treat as changed */

	const isEqual = (a?: string | null, b?: string | null) => {
		return (a || null)?.toUpperCase() === (b || null)?.toUpperCase();
	};

	/** Return true if ANY field has changed */
	return !(
		isEqual(user.name?.given_name, owner.first_name) &&
		isEqual(user.name?.family_name, owner.last_name) &&
		isEqual(user.email_address, owner.email) &&
		isEqual(user.phone_number, owner.mobile?.toString()) &&
		isEqual(user.address?.city, owner.address_city) &&
		isEqual(user.address?.region, owner.address_state) &&
		isEqual(user.address?.street, owner.address_line_1) &&
		isEqual(user.address?.street2, owner.address_line_2 ?? owner.address_apartment) &&
		isEqual(user.address?.postal_code, owner.address_postal_code) &&
		isEqual(user.address?.country, owner.address_country) &&
		isEqual(safeDecrypt(user?.id_number?.value!), safeDecrypt(owner.ssn!)) &&
		isEqual(safeDecrypt(user?.date_of_birth!), safeDecrypt(owner.date_of_birth!))
	);
}
