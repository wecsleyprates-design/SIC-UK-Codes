import { decryptEin, encryptEin, maskString } from "#utils/encryption";
import type { UUID } from "crypto";
import { businesses } from "../api/v1/modules/businesses/businesses";
import { TIN_BEHAVIOR } from "#constants";
import { Business } from "#types";

/*
    Get a business by TIN, businessID, or customerID and externalID
    Type guarded to ensure that you pass in the correct combination of parameters
        tin
        businessID
        customerID + externalID
    Throws if invalid parameters are passed, or business cannot be looked up
*/

type LookupBusinessRequestWithCustomerID = {
	customerID: string | UUID;
	externalID: string | UUID;
	tin?: never;
	businessID?: never;
};

type LookupBusinessRequestWithTIN = {
	tin: string | number;
	customerID?: never;
	externalID?: never;
	businessID?: never;
};

type LookupBusinessRequestWithBusinessID = {
	businessID: string | UUID;
	customerID?: never;
	externalID?: never;
	tin?: never;
};

export type LookupBusinessRequest =
	| LookupBusinessRequestWithCustomerID
	| LookupBusinessRequestWithTIN
	| LookupBusinessRequestWithBusinessID;
/**
 *
 * @param {obj} - Object with either TIN, businessID, or customerID and externalID
 * @returns Promise<Business> or throws if cannot find business
 */
export const businessLookupHelper = async (
	{ tin, businessID, customerID, externalID }: LookupBusinessRequest,
	tinBehavior?: TIN_BEHAVIOR
): Promise<Business.Record[]> => {
	let business;
	let businessTIN;
	let businessList: Business.Record[] = [];
	if (businessID) {
		business = await businesses.getBusinessByID({ businessID, tinBehavior: TIN_BEHAVIOR.ENCRYPT });
		if (!business?.id) {
			throw new Error(`Specified business_id does not exist: ${businessID}`);
		}
		businessList.push(business);
	} else if (customerID && externalID) {
		const matches = await businesses.getBusinessByExternalId(externalID, customerID);
		business = matches[0];
		if (!business?.id) {
			throw new Error(`Specified combination of external_id ${externalID} does not exist for customer ${customerID}`);
		}
		businessList.push(business);
	} else if (tin) {
		businessList = await businesses.getBusinessesByTin(tin as string);
		if (businessList.length === 0) {
			throw new Error(`Specified TIN does not exist: ${tin}`);
		}
	} else {
		if (externalID && !customerID) {
			throw new Error("customer_id is required when using external_id");
		}
		throw new Error("Either TIN, business_id, or customer_id and external_id are required in the request");
	}
	let plainTextTIN = (businessList[0]?.tin as string) || "";
	let encryptedTIN = plainTextTIN;
	try {
		plainTextTIN = decryptEin(plainTextTIN, false);
	} catch (_error) {
		// can't decrypt, already in plain text
	}
	try {
		encryptedTIN = encryptEin(plainTextTIN, false);
	} catch (_error) {
		// already plain text if it throws
	}
	switch (tinBehavior) {
		case TIN_BEHAVIOR.PLAIN:
			businessTIN = plainTextTIN;
			break;
		case TIN_BEHAVIOR.MASK:
			businessTIN = maskString(plainTextTIN);
			break;
		default:
			businessTIN = encryptedTIN;
	}
	// Replace tin value for each business in businessList with businessTIN
	businessList = businessList.map(biz => ({
		...biz,
		tin: businessTIN
	}));
	return businessList;
};
