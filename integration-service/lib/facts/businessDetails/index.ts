import {
	BusinessAddressSchema,
	internalGetIndustries,
	internalGetMccCode,
	internalGetNaicsCode,
	type BusinessAddress,
	type BusinessDetails
} from "#helpers/api";
import { type Fact, factAbbreviatedToFact } from "../types";
import { sources } from "../sources";
import type { FactEngine } from "../factEngine";
import type { OpenCorporateResponse } from "#lib/opencorporates/types";
import type { ZoomInfoResponse } from "#lib/zoominfo/types";
import type { EquifaxCombined } from "#lib/equifax/types";
import type { GetBusinessEntityReview } from "#api/v1/modules/verification/types";
import type { IBusinessEntityAddressSource } from "#types/db";
import type { CanadaOpenEntityMatchTask } from "#lib/canadaOpen/types";
import { SerializableMap } from "#utils/serialization";
import z from "zod-v4";
import { AddressUtil } from "#utils/addressUtil";
import { Details, KYXVerificationResponse } from "#lib/kyx/types";
import {
	extractWebsiteFromTruliooResponse,
	extractStandardizedIndustriesFromTruliooResponse
} from "#lib/trulioo/common/utils";

export const businessFacts: readonly Fact[] = factAbbreviatedToFact({
	business_name: [
		{ source: sources.businessDetails, path: "name" },
		{ source: sources.zoominfo, path: "firmographic.zi_c_name" },
		{ source: sources.opencorporates, path: "firmographic.name" },
		{ source: sources.equifax, fn: (_, efx) => efx.efx_legal_name || efx.efx_name || efx.scoring_model.legultnameall }
	],
	dba: [
		{
			source: sources.businessDetails,
			schema: z.array(z.string()),
			fn: async (_, businessDetails: any): Promise<string[] | undefined> => {
				const dba = businessDetails.business_names.filter(
					(name: any) => name.is_primary === false && name.name.toLowerCase() !== businessDetails.name.toLowerCase()
				);
				return Promise.resolve(dba?.map((name: any) => name.name));
			}
		}
	],
	business_phone: [
		{
			source: sources.businessDetails,
			path: "mobile"
		},
		{ source: sources.zoominfo, path: "firmographic.zi_c_phone" },
		{ source: sources.serp, path: "businessMatch.phone" },
		{
			source: sources.verdataRaw,
			path: "seller.phone"
		},
		{ source: sources.middeskRaw, path: "phone_numbers[0].phone_number" }
	],
	names: [
		{
			source: sources.zoominfo,
			fn: async (_, zi: ZoomInfoResponse): Promise<string[] | undefined> => {
				if (zi?.firmographic) {
					const names = [
						zi.firmographic.zi_c_name,
						zi.firmographic.zi_c_name_display,
						...(zi.firmographic.zi_c_names_other ?? "").split("|")
					];
					if (Array.isArray(names) && names.length > 0) {
						// Dedupe and remove empty strings
						return Array.from(new Set(names.filter(name => name !== "")));
					}
				}
			}
		},
		{
			source: sources.opencorporates,
			fn: async (_, oc: OpenCorporateResponse): Promise<string[] | undefined> => {
				const names = oc?.names?.map((name: any) => name.name);
				if (Array.isArray(names) && names.length > 0) {
					// Dedupe and remove empty strings
					return Array.from(new Set(names.filter(name => name !== "")));
				}
			}
		},
		{
			source: sources.middesk,
			fn: async (_, middesk: GetBusinessEntityReview): Promise<string[] | undefined> => {
				if (!middesk) {
					return;
				}
				const names = middesk.names?.map(({ name }) => name) || [];
				if (
					middesk.businessEntityVerification &&
					!names.some(n => n.toLowerCase() === middesk.businessEntityVerification.name.toLowerCase())
				) {
					names.push(middesk.businessEntityVerification.name);
				}
				return names.length > 0 ? names : undefined;
			}
		},
		{
			source: sources.equifax,
			fn: async (_, equifax: EquifaxCombined): Promise<string[] | undefined> => {
				if (equifax?.efx_id) {
					const names = new Set<string>();
					if (equifax.efx_name) {
						names.add(equifax.efx_name);
					}
					if (equifax.efx_legdomultnameall) {
						names.add(equifax.efx_legdomultnameall);
					}
					if (equifax.efx_legultnameall) {
						names.add(equifax.efx_legultnameall);
					}
					if (names.size > 0) return Array.from(names);
				}
			}
		},
		{ source: sources.verdataRaw, path: "seller.name_dba" },
		{
			source: sources.canadaopen,
			fn: async (_, canadaOpen: CanadaOpenEntityMatchTask): Promise<string[] | undefined> => {
				const names: string[] = [];
				if (canadaOpen.business) {
					names.push(canadaOpen.business.name);
					if (canadaOpen.business.other_names) {
						canadaOpen.business.other_names.split("|").forEach(name => names.push(name.trim()));
					}
				}
				return names.length > 0 ? names : undefined;
			}
		}
	],
	primary_address: {
		fn: async (_, businessDetails: any): Promise<BusinessAddress | undefined> => {
			return businessDetails.business_addresses.find((address: BusinessAddress) => address.is_primary === true);
		},
		source: sources.businessDetails
	},
	primary_address_string: {
		dependencies: ["primary_address"],
		fn: async (engine): Promise<string | undefined> => {
			const addrToUse = engine.getResolvedFact("primary_address")?.value;
			if (addrToUse) {
				return AddressUtil.formatBusinessAddressToString(addrToUse);
			}
		},
		source: sources.businessDetails
	},
	primary_city: {
		source: sources.businessDetails,
		dependencies: ["primary_address"],
		fn: async (engine: FactEngine): Promise<string | undefined> =>
			engine.getResolvedFact("primary_address")?.value?.city
	},
	city: {
		source: sources.businessDetails,
		fn: async (_, businessDetails: any): Promise<string | undefined> => {
			// Use direct address fields from business object
			if (businessDetails.address_city) {
				return businessDetails.address_city;
			}

			return undefined;
		}
	},
	state: {
		source: sources.businessDetails,
		fn: async (_, businessDetails: any): Promise<string | undefined> => {
			// Use direct address fields from business object
			if (businessDetails.address_state) {
				return businessDetails.address_state;
			}

			return undefined;
		}
	},
	mailing_address: [
		{
			source: sources.businessDetails,
			fn: async (_, businessDetails: any): Promise<BusinessAddress[] | undefined> => {
				const addresses = businessDetails.business_addresses.filter(
					(address: BusinessAddress) => address.is_primary === false
				);
				return addresses.length > 0 ? addresses : undefined;
			}
		},
		{
			// Get the first address that is deliverable
			source: sources.middesk,
			fn: async (_, middesk: GetBusinessEntityReview): Promise<Partial<BusinessAddress[]> | undefined> => {
				const addresses = (middesk?.addressSources as IBusinessEntityAddressSource[])
					?.filter(
						({ deliverable, address_line_1, city, state, postal_code, country }) =>
							deliverable && address_line_1 && city && state && postal_code && country
					)
					.map(
						addr =>
							({
								line_1: addr.address_line_1,
								apartment: addr.address_line_2 || null,
								city: addr.city,
								state: addr.state,
								postal_code: addr.postal_code,
								is_primary: false,
								mobile: null,
								country: addr.country
							}) as unknown as BusinessAddress
					);
				return addresses.length > 0 ? addresses : undefined;
			}
		}
	],
	mailing_address_strings: {
		dependencies: ["mailing_address"],
		fn: async (engine): Promise<string[] | undefined> => {
			const mailingAddresses = engine.getResolvedFact("mailing_address")?.value;
			if (mailingAddresses && mailingAddresses.length > 0) {
				return mailingAddresses.map(AddressUtil.formatBusinessAddressToString);
			}
		},
		source: sources.businessDetails
	},
	website: [
		{ source: sources.businessDetails, path: "official_website" }, // Product prefers the official_website field to be surfaced first, if the confidence is the same.
		{ source: sources.zoominfo, path: "firmographic.zi_c_url" },
		{ source: sources.serp, path: "businessWebsite" },
		{ source: sources.verdataRaw, path: "seller.domain_name" },
		{
			source: sources.AIWebsiteEnrichment,
			path: "response.company_website.url",
			weight: 0.1
		},
		{
			source: sources.business,
			weight: 0.7,
			fn: async (_, truliooResponse: any): Promise<string | undefined> => {
				if (!truliooResponse?.clientData) {
					return undefined;
				}
				return extractWebsiteFromTruliooResponse(truliooResponse.clientData);
			}
		}
	],
	industry: [
		{
			source: null,
			dependencies: ["naics_code"],
			category: "kyb",
			confidence: 0.9,
			fn: async (engine: FactEngine): Promise<any> => {
				const fact = engine.getResolvedFact("naics_code");
				if (fact?.value) {
					const sectorCode = fact.value.toString().substring(0, 2);
					if (sectorCode) {
						const industries = await internalGetIndustries(sectorCode);
						if (industries?.[0]) {
							return industries[0];
						}
					}
				}
			}
		},
		{
			source: sources.business,
			weight: 0.7,
			fn: async (_, truliooResponse: any): Promise<any> => {
				if (!truliooResponse?.clientData) return undefined;
				const industry = extractStandardizedIndustriesFromTruliooResponse(truliooResponse.clientData)?.find(
					(i: any) => i.industryName
				);
				return industry?.industryName ? { name: industry.industryName } : undefined;
			}
		},
		{ source: sources.businessDetails, path: "industry" }
	],
	naics_code: [
		{ source: sources.equifax, path: "primnaicscode" },
		{ source: sources.zoominfo, path: "firmographic.zi_c_naics6" },
		{
			source: sources.opencorporates,
			fn: (_, oc: OpenCorporateResponse) => {
				if (!oc.firmographic?.industry_code_uids) return Promise.resolve(undefined);
				for (const industryCodeUid of oc.firmographic.industry_code_uids.split("|") ?? []) {
					const [codeName, industryCode] = industryCodeUid.split("-", 2);
					if (
						codeName?.includes("us_naics") &&
						industryCode &&
						isFinite(parseInt(industryCode)) &&
						industryCode.toString().length === 6
					) {
						return Promise.resolve(industryCode);
					}
				}
				return Promise.resolve(undefined);
			}
		},
		{ source: sources.serp, weight: 0.3, path: "businessLegitimacyClassification.naics_code" },
		{
			source: sources.business,
			weight: 0.7,
			fn: async (_, truliooResponse: any): Promise<string | undefined> => {
				if (!truliooResponse?.clientData) return undefined;
				return extractStandardizedIndustriesFromTruliooResponse(truliooResponse.clientData)?.find(
					(i: any) => i.naicsCode && /^\d{6}$/.test(i.naicsCode)
				)?.naicsCode;
			}
		},
		{
			source: sources.businessDetails,
			path: "naics_code",
			weight: 0.2,
			/* constrain NAICS to a 6 digit numeric string*/
			schema: z.string().regex(/^\d{6}$/)
		},
		{
			source: sources.AINaicsEnrichment,
			path: "response.naics_code",
			weight: 0.1
		}
	],
	classification_codes: [
		{
			description: "Industry classification codes for all jurisdictions",
			source: sources.opencorporates,
			fn: (_, oc: OpenCorporateResponse) => {
				type JurisdictionIndustryIdentifiers = Record<string, string>;

				let out: JurisdictionIndustryIdentifiers | undefined;
				if (oc.firmographic?.industry_code_uids) {
					const industryCodeUids = oc.firmographic?.industry_code_uids.split("|") ?? [];
					for (const industryCodeUid of industryCodeUids) {
						const [codeName, industryCode] = industryCodeUid.split("-", 2);
						if (codeName && industryCode && !out?.[codeName]) {
							out = out ?? {};
							out[codeName] = industryCode;
						}
					}
				}
				return Promise.resolve(out);
			}
		}
	],
	num_employees: [
		{ path: "corpemployees", category: "business", source: sources.equifax },
		{ source: sources.zoominfo, path: "firmographic.zi_c_employees" },
		{ source: sources.opencorporates, path: "firmographic.number_of_employees" }
	],

	mcc_code_found: [
		{
			schema: z.string().regex(/^\d{4}$/),
			source: sources.AINaicsEnrichment,
			path: "response.mcc_code",
			description: "Merchant Category Code derived from Industry Classification"
		}
	],
	mcc_code_from_naics: [
		{
			dependencies: ["naics_code"],
			source: sources.calculated,
			schema: z.string().regex(/^\d{4}$/),
			description: "Merchant Category Code derived from best NAICS code",
			fn: async (engine: FactEngine): Promise<number | undefined> => {
				const fact = engine.getResolvedFact("naics_code");
				if (fact?.value) {
					const naicsInfo = await internalGetNaicsCode(fact.value);
					if (naicsInfo) {
						return naicsInfo?.find(naics => !!naics.mcc_code)?.mcc_code;
					}
				}
			}
		}
	],
	mcc_code: [
		{
			dependencies: ["mcc_code_found", "mcc_code_from_naics"],
			source: sources.calculated,
			schema: z.string().regex(/^\d{4}$/),
			description: "Merchant Category Code derived from best source",
			fn: async (engine: FactEngine): Promise<number | undefined> => {
				const foundMcc = engine.getResolvedFact("mcc_code_found");
				const inferredMcc = engine.getResolvedFact("mcc_code_from_naics");
				return foundMcc?.value ?? inferredMcc?.value;
			}
		}
	],
	mcc_description: {
		dependencies: ["mcc_code"],
		source: sources.calculated,
		schema: z.string(),
		fn: async (engine: FactEngine): Promise<string | undefined> => {
			const fact = engine.getResolvedFact("mcc_code");
			if (fact && fact.value) {
				const mccInfo = await internalGetMccCode(fact.value);
				const mccLabel = mccInfo?.find(mcc => !!mcc.mcc_label)?.mcc_label;
				if (mccLabel) {
					return mccLabel;
				}
			}
			// Backup: AI NAICS Enrichment
			return engine.getSource("AINaicsEnrichment")?.rawResponse?.response?.mcc_description;
		}
	},
	naics_description: {
		dependencies: ["naics_code"],
		source: null,
		fn: async (engine: FactEngine): Promise<string | undefined> => {
			const fact = engine.getResolvedFact("naics_code");
			if (fact && fact.value) {
				const naicsInfo = await internalGetNaicsCode(fact.value);
				return naicsInfo.find(naics => !!naics.naics_label)?.naics_label;
			}
		}
	},
	business_names_submitted: {
		source: sources.businessDetails,
		fn: async (_, businessDetails: BusinessDetails): Promise<string[] | undefined> => {
			const nameMap = new SerializableMap<string, string>();
			const calculateNameHash = (name: string): string => {
				// Remove all non-alphanumeric characters and set to lowercase
				return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
			};
			nameMap.set(calculateNameHash(businessDetails.name), businessDetails.name);
			businessDetails.business_names?.forEach((name: any) => {
				const hash = calculateNameHash(name.name);
				if (!nameMap.has(hash)) {
					nameMap.set(hash, name.name);
				}
			});
			return nameMap.size > 0 ? Array.from(nameMap.values()) : undefined;
		}
	},
	business_addresses_submitted: {
		source: sources.businessDetails,
		schema: BusinessAddressSchema,
		fn: async (_, businessDetails: BusinessDetails): Promise<BusinessAddress[] | undefined> => {
			const addressMap = new Map<string, BusinessAddress>();
			let primaryAddress: BusinessAddress | undefined;
			if (
				businessDetails.address_line_1 &&
				businessDetails.address_city &&
				businessDetails.address_state &&
				businessDetails.address_postal_code
			) {
				primaryAddress = {
					line_1: businessDetails.address_line_1,
					apartment: businessDetails.address_line_2 || "",
					city: businessDetails.address_city,
					state: businessDetails.address_state,
					postal_code: businessDetails.address_postal_code,
					country: businessDetails.address_country,
					mobile: null,
					is_primary: true
				};
				addressMap.set(AddressUtil.toFingerprint(primaryAddress), primaryAddress);
			}
			businessDetails.business_addresses?.forEach((address: BusinessAddress) => {
				const fingerprint = AddressUtil.toFingerprint(address);
				if (!addressMap.has(fingerprint)) {
					addressMap.set(fingerprint, address);
				}
			});
			return addressMap.size > 0 ? Array.from(addressMap.values()) : undefined;
		}
	},
	business_addresses_submitted_strings: {
		dependencies: ["business_addresses_submitted"],
		fn: async (engine): Promise<Array<{ address: string; is_primary: boolean }> | undefined> => {
			const addressesToUse = engine.getResolvedFact("business_addresses_submitted")?.value;
			if (!addressesToUse || !addressesToUse?.length) return undefined;

			return addressesToUse.map((address: BusinessAddress) => ({
				address: AddressUtil.formatBusinessAddressToString(address),
				is_primary: address.is_primary
			}));
		},
		source: sources.businessDetails
	},
	owners: {
		source: sources.kyx,
		description: "Owner data from KYX",
		schema: z.object({
			person: z
				.object({
					firstName: z.string(),
					middleName: z.string(),
					lastName: z.string(),
					fullName: z.string(),
					dob: z.string().regex(/^\d{4}-\d{1,2}-\d{1,2}$/, "Date of birth must be in YYYY-MM-D or YYYY-MM-DD format"),
					ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, "XXX-XX-XXXX format")
				})
				.nullable(),
			phone: z
				.object({
					activityScore: z.number(),
					phoneNumber: z.string(),
					type: z.enum(["Mobile", "Landline", "VoIP", "Unknown"]),
					carrier: z.string()
				})
				.nullable(),
			emails: z.array(z.any()).nullable(),
			addresses: z
				.array(
					z.object({
						address1: z.string(),
						address2: z.string(),
						city: z.string(),
						state: z.string(),
						county: z.string(),
						postalCode: z.string(),
						zip4: z.string(),
						country: z.string()
					})
				)
				.nullable()
		}),
		fn: async function (this: Fact, engine: FactEngine, kyx: KYXVerificationResponse): Promise<Details | undefined> {
			const result = kyx?.prefillExpress ?? kyx?.prefill;
			const details = result?.details;

			// Calculate confidence based on phone activityScore
			if (details?.phone?.activityScore != null) {
				// Normalize activityScore to 0-1 range (assuming it's 0-100, adjust if different)
				const activityScore = details.phone.activityScore;
				// If activityScore is already 0-1, use it directly; otherwise normalize from 0-100
				this.confidence = activityScore > 1 ? Math.min(activityScore / 100, 1) : Math.min(activityScore, 1);
			}
			return details;
		}
	},
	worth_score: {
		source: sources.worthScore,
		description: "Latest Worth score",
		schema: z.number().nullable(),
		fn: async (_: any, data: any): Promise<number | null> => {
			if (data == null) return null;
			const score = data.weighted_score_850;
			if (score == null) return null;
			const num = Number(score);
			return Number.isFinite(num) ? num : null;
		}
	}
});
