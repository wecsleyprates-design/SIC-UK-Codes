import type { UUID } from "crypto";
import { getBusinessDetails, internalGetBusinessByTin, internalGetCustomerBusinessByExternalId, type TIN_BEHAVIOR } from "./api";

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
	tinBehavior?: TIN_BEHAVIOR;
};

type LookupBusinessRequestWithTIN = {
	tin: string | number;
	customerID?: never;
	externalID?: never;
	businessID?: never;
	tinBehavior?: TIN_BEHAVIOR;
};

type LookupBusinessRequestWithBusinessID = {
	businessID: string | UUID;
	customerID?: never;
	externalID?: never;
	tin?: never;
	tinBehavior?: TIN_BEHAVIOR;
};

type LookupBusinessRequest = LookupBusinessRequestWithCustomerID | LookupBusinessRequestWithTIN | LookupBusinessRequestWithBusinessID;
type BasicBusiness = {
	id: string | UUID;
	name: string;
	tin: string | null;
	[keyof: string]: any;
};
/**
 *
 * @param {obj} - Object with either TIN, businessID, or customerID and externalID
 * @returns Promise<Business> or throws if cannot find business
 */
const businessLookupHelper = async ({ tin, businessID, customerID, externalID, tinBehavior }: LookupBusinessRequest): Promise<BasicBusiness[]> => {
	if (externalID && !customerID) {
		throw new Error("customer_id is required when using external_id");
	}
	let business;
	let businessList: BasicBusiness[] = [];
	if (tin) {
		businessList = await internalGetBusinessByTin(tin as string);
		if (!businessList?.[0]?.id) {
			throw new Error(`Specified TIN does not exist: ${tin}`);
		}
	} else if (businessID) {
		const businessDetails = await getBusinessDetails(businessID, undefined, tinBehavior);
		business = businessDetails?.data;
		if (!business?.id) {
			throw new Error(`Specified business_id does not exist: ${businessID}`);
		}
		businessList.push(business);
	} else if (customerID && externalID) {
		const businesses = await internalGetCustomerBusinessByExternalId(customerID as UUID, externalID);

		business = businesses[0];
		if (!business?.id) {
			throw new Error(`Specified combination of external_id ${externalID} does not exist for customer ${customerID}`);
		}
		businessList.push(business);
	} else {
		throw new Error("Either TIN, business_id, or customer_id and external_id are required in the request");
	}
	return businessList;
};
export default businessLookupHelper;
