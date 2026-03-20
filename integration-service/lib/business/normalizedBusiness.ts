import { SerpScrapeResponseSchema } from "#api/v1/modules/data-scrape/schema";
import { getBusinessDetails } from "#helpers";
import { IBusinessEntityAddressSource } from "#types";
import { AddressUtil } from "#utils";
import { UUID } from "@joinworth/types/dist/utils/utilityTypes";
import { Record as VerdataRecord } from "lib/verdata/types";
import type { TruliooBusinessData } from "#lib/trulioo/common/types";
import { extractTruliooAddressForNormalization } from "#lib/trulioo/common/utils";

export type RequiredBusinessEntityVerificationParts = {
	addressSources:
		| {
				full_address: string | null;
				address_line_1: any;
				address_line_2: any;
				city: any;
				state: any;
				postal_code: any;
		  }[]
		| IBusinessEntityAddressSource[];
	names: Array<{
		name: string;
		submitted: boolean;
	}>;
};

export class NormalizedBusiness {
	/*
    This class is for normalizing business data from various 3rd party integrations 
    in order to make requests to the warehouse service. If you need to get match predictions/confidence from the
    warehouse service, you must use this class to create a normalized business object which 
    will meet the validation requirements of the warehouse service endpoints.
    */

	constructor(
		public business_id: UUID,
		public name: string,
		public address: string,
		public city: string,
		public state: string,
		public country: string,
		public zip: string,
		public source: string,
		public extra: Record<string, boolean | null> = {}
	) {
		this.business_id = business_id;
		this.name = name;
		this.address = address;
		this.city = city;
		this.state = state;
		this.country = country;
		this.zip = zip;
		this.source = source;
		this.extra = extra;
	}

	static async fromCustomerSubmission(businessId: UUID): Promise<NormalizedBusiness | undefined> {
		const businessDetailsResponse = await getBusinessDetails(businessId);

		if (businessDetailsResponse.status === "fail") {
			return;
		}

		return new NormalizedBusiness(
			businessId,
			businessDetailsResponse.data.name,
			businessDetailsResponse.data.address_line_1,
			businessDetailsResponse.data.address_city,
			businessDetailsResponse.data.address_state,
			businessDetailsResponse.data.address_country,
			businessDetailsResponse.data.address_postal_code,
			"customer"
		);
	}

	static fromPublicRecord(businessId: UUID, verdataRecord: VerdataRecord): NormalizedBusiness | undefined {
		if (!verdataRecord?.seller) {
			return;
		}

		if (
			!verdataRecord.seller.name ||
			!verdataRecord.seller.address_line_1 ||
			!verdataRecord.seller.city ||
			!verdataRecord.seller.state ||
			!verdataRecord.seller.zip5
		) {
			return;
		}

		return new NormalizedBusiness(
			businessId,
			verdataRecord.seller.name,
			verdataRecord.seller.address_line_1,
			verdataRecord.seller.city,
			verdataRecord.seller.state,
			"US",
			verdataRecord.seller.zip5,
			"verdata"
		);
	}
	static fromBusinessEntityReviewComplete(
		businessId: UUID,
		businessEntityReview: RequiredBusinessEntityVerificationParts
	): NormalizedBusiness[] | undefined {
		let names: Array<string> = [];
		let addresses: Array<Record<string, any>> = [];

		for (const nameObject of businessEntityReview.names || []) {
			names.push(nameObject.name);
		}

		for (const address of businessEntityReview.addressSources || []) {
			if (!address.address_line_1 || !address.city || !address.state || !address.postal_code) {
				continue;
			}

			addresses.push({
				address: address.address_line_1,
				city: address.city,
				state: address.state,
				country: "US",
				zip: address.postal_code
			});
		}

		if (!names || !addresses) {
			return;
		}

		let normalizedBusinessesArray: Array<NormalizedBusiness> = [];
		for (const name of names) {
			for (const address of addresses) {
				normalizedBusinessesArray.push(
					new NormalizedBusiness(
						businessId,
						name,
						address.address,
						address.city,
						address.state,
						address.country,
						address.zip,
						"middesk"
					)
				);
			}
		}

		return normalizedBusinessesArray;
	}

	static fromSerpScrapeResponse(
		businessId: UUID,
		serpResponse: SerpScrapeResponseSchema
	): NormalizedBusiness | undefined {
		if (!serpResponse.businessMatch?.address || !serpResponse.businessMatch?.title) {
			return;
		}

		const normAddress = AddressUtil.stringToParts(serpResponse.businessMatch.address);

		if (!normAddress.line_1 || !normAddress.city || !normAddress.state || !normAddress.postal_code) {
			return;
		}

		return new NormalizedBusiness(
			businessId,
			serpResponse.businessMatch.title,
			normAddress.line_1,
			normAddress.city,
			normAddress.state,
			normAddress.country || "US",
			normAddress.postal_code,
			"serp"
		);
	}

	static fromTrulioo(businessId: UUID, businessData: TruliooBusinessData): NormalizedBusiness | undefined {
		if (!businessData) {
			return;
		}

		// Extract address components using utility function (handles primary address preference, fallbacks, and format variations)
		const addressComponents = extractTruliooAddressForNormalization(businessData);
		if (!addressComponents) {
			return;
		}

		// Validate required fields (country is required for Trulioo as it's used for UK/Canada businesses)
		if (!businessData.name) {
			return;
		}

		// Combine addressLine1 and addressLine2 if both exist
		const fullAddressLine1 = addressComponents.addressLine2 
			? `${addressComponents.addressLine1}, ${addressComponents.addressLine2}` 
			: addressComponents.addressLine1;

		return new NormalizedBusiness(
			businessId,
			businessData.name,
			fullAddressLine1,
			addressComponents.city,
			addressComponents.state,
			addressComponents.country,
			addressComponents.postalCode,
			"trulioo"
		);
	}
}
