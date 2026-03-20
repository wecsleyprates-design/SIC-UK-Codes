import { sources } from "../sources";
import { factAbbreviatedToFact, simpleFactToFacts, type Fact, type SimpleFact } from "../types";
import { maskString, safeDecrypt } from "#utils/encryption";
import dayjs from "dayjs";
import { AddressUtil } from "#utils/addressUtil";
import { get as _get } from "lodash";
import { isCanadianAddress } from "#utils/canadianProvinces";
import { logger } from "#helpers/logger";
import { truliooFacts } from "../truliooFacts";

import type { CanadaOpenEntityMatchTask } from "#lib/canadaOpen/types";
import { WATCHLIST_HIT_TYPE, type SoSRegistration, type WatchlistValue, type WatchlistValueMetadatum } from "./types";
import { calculateConsolidatedWatchlist } from "./consolidatedWatchlist";
import { extractPeopleFromTruliooPerson } from "./peopleHelpers";
import {
	ensureBusinessEntityType,
	transformTruliooBusinessWatchlistResults
} from "./watchlistHelpers";
import type * as VerdataType from "#lib/verdata/types";
import type { SerpScrapeResponseSchema } from "#api/v1/modules/data-scrape/schema";
import type {
	IBusinessEntityRegistration,
	IBusinessEntityReviewTask,
	IIdentityVerification,
	IBusinessEntityAddressSource
} from "#types/db";
import type { EquifaxCombined } from "#lib/equifax/types";
import type { GetBusinessEntityReview } from "#api/v1/modules/verification/types";
import type { OpenCorporateResponse } from "#lib/opencorporates/types";
import type { ZoomInfoResponse } from "#lib/zoominfo/types";
import { type BusinessAddress } from "#helpers/index";
import {
	type IdentityVerification as PlaidIdentityVerification,
	IdentityVerificationStatus,
	IDNumberType
} from "plaid";
import {
	IDV_STATUS,
	OC_ACTIVE_STATUSES,
	OC_INACTIVE_STATUSES,
	INTEGRATION_CATEGORIES,
	type IdvStatusId
} from "#constants";
import { convertPlaidToWorth } from "#lib/plaid/convert";
import type { FactEngine } from "..";
import {
	extractTruliooAddressesAsStrings,
	extractRegistrationNumberFromTruliooResponse,
	findFieldInInputArray,
	getServiceDataArray,
	extractFieldFromTruliooServiceData,
	extractIncorporationDateFromTrulioo,
	extractYearOfIncorporationFromTrulioo,
	extractDirectorsOfficersFromTrulioo,
	getTruliooRegistryUrl,
	extractWatchlistResultsFromTruliooResponse
} from "#lib/trulioo/common/utils";
import z from "zod-v4";

const normalizeEquifaxFlag = (flag: string): boolean | undefined => {
	switch (flag) {
		case "Y":
			return true;
		case "N":
			return false;
	}
};
const statusMatch = (status: string | undefined, patterns: string[]): boolean => {
	if (!status) return false;
	const normalized = status.toLowerCase().trim();

	return patterns.some(p => {
		const patternNormalized = p.toLowerCase().trim();
		if (p.includes(" ")) {
			// Multi-word phrase: anywhere in the string
			return normalized.includes(patternNormalized);
		}
		// Single word: whole word match
		return new RegExp(`\\b${patternNormalized}\\b`, "i").test(normalized);
	});
};
const corporationType = (isPublicFlag: number | string | null | undefined): string | null => {
	if (isPublicFlag === null || isPublicFlag === undefined) return null;

	// In some cases, the isPublicFlag can be a string representation of a number, e.g. "1" or "0"
	switch (typeof isPublicFlag === "string" ? parseInt(isPublicFlag, 10) : isPublicFlag) {
		case 0:
			return "Private";
		case 1:
			return "Public";
		default:
			return null;
	}
};

// Combine all the names from the zi response
const collectZiNames = (zi: ZoomInfoResponse, pathToInclude?: string[]): string[] | undefined => {
	const names = new Set<string>();
	pathToInclude?.forEach(path => {
		const value = _get(zi, path);
		if (value) {
			names.add(value);
		}
	});
	// Iterate through the "other" names (pipe delimited)
	zi.firmographic?.zi_c_names_other?.split("|")?.forEach(name => names.add(name.trim()));
	const nameArray = Array.from(names).filter(name => !!name);
	return nameArray.length > 0 ? nameArray : undefined;
};

const ocJurisdictionToJurisdiction = (jurisdictionCode: string | null | undefined) =>
	typeof jurisdictionCode === "string" ? jurisdictionCode?.replace("_", "::")?.toLowerCase() : undefined;

const simpleFacts: SimpleFact = {
	addresses: {
		schema: z.array(z.string()),
		equifax: async (_, efx: EquifaxCombined) => efx?.address_string && [efx.address_string],
		middesk: async (_, middesk): Promise<string[] | undefined> =>
			Array.isArray(middesk.addressSources)
				? middesk.addressSources.map(({ full_address }) => full_address && full_address)
				: undefined,
		opencorporates: async (_, opencorporates: OpenCorporateResponse): Promise<string[] | undefined> =>
			opencorporates?.addresses
				?.filter(addr => !!addr.normalized_address)
				?.map(addr => addr.normalized_address && addr.normalized_address),
		serp: async (_, serp: SerpScrapeResponseSchema) => serp?.businessMatch?.address && [serp.businessMatch.address],
		verdataRaw: async (_, verdata: VerdataType.Record) => {
			const { city, zip5, state, address_line_1, address_line_2 } = verdata.seller;
			if (address_line_1 && city && state && zip5) {
				return [`${address_line_1}, ${address_line_2}, ${city}, ${state}, ${zip5}`];
			}
		},
		zoominfo: async (_, zi: ZoomInfoResponse): Promise<any> =>
			zi?.firmographic && [
				`${zi?.firmographic?.zi_c_street}, ${zi?.firmographic?.zi_c_city}, ${zi?.firmographic?.zi_c_state} ${zi?.firmographic?.zi_c_zip}`
			],
		canadaopen: async (_, canadaOpen: CanadaOpenEntityMatchTask): Promise<any> => {
			const addresses: string[] = [];
			if (canadaOpen?.business) {
				addresses.push(
					`${canadaOpen.business.address}, ${canadaOpen.business.city}, ${canadaOpen.business.region}, ${canadaOpen.business.zip} ${canadaOpen.business.country}`
				);
			}
			return addresses.length > 0 ? addresses : undefined;
		},
		business: async (_, truliooResponse: GetBusinessEntityReview): Promise<string[] | undefined> => {
			const addressSources = truliooResponse?.addressSources;
			if (Array.isArray(addressSources)) {
				return addressSources.map(({ full_address }) => full_address).filter((addr): addr is string => Boolean(addr));
			}
			// Fallback to old method if addressSources not available
			const truliooResponseWithClientData = truliooResponse as GetBusinessEntityReview & {
				clientData?: { businessData?: Record<string, unknown> };
			};
			const businessData = truliooResponseWithClientData?.clientData?.businessData;
			if (!businessData) return undefined;
			const addresses = extractTruliooAddressesAsStrings(
				businessData as Parameters<typeof extractTruliooAddressesAsStrings>[0]
			);
			return addresses.length > 0 ? addresses : undefined;
		},
		normalize: async (engine, value) => {
			if (!engine.isValidFactValue(value)) {
				return;
			}
			if (!Array.isArray(value)) {
				value = [value];
			}
			const addressSet = new Set<string>();
			const validAddresses = value.filter((addr): addr is string => addr != null && typeof addr === "string");
			validAddresses.forEach(address => addressSet.add(AddressUtil.addCountryToAddress(AddressUtil.normalizeString(address))));
			return addressSet.size > 0 ? Array.from(addressSet) : undefined;
		}
	},
	addresses_submitted: {
		middesk: async (_, middesk) =>
			middesk?.addressSources?.filter(address => address.submitted).map(({ full_address }) => full_address),
		business: async (_, truliooResponse: GetBusinessEntityReview): Promise<string[] | undefined> => {
			const addressSources = truliooResponse?.addressSources;
			if (Array.isArray(addressSources)) {
				return addressSources
					.filter(
						(address): address is IBusinessEntityAddressSource =>
							typeof address === "object" && address !== null && "submitted" in address && address.submitted === true
					)
					.map(({ full_address }) => full_address)
					.filter((addr): addr is string => Boolean(addr));
			}
			return undefined;
		}
	},
	legal_name: {
		middesk: "businessEntityVerification.name",
		opencorporates: "firmographic.name",
		businessDetails: "name",
		business: async (_, truliooResponse: any): Promise<string | undefined> => {
			const businessData = truliooResponse?.clientData?.businessData;
			return businessData?.name || undefined;
		}
	},
	kyb_submitted: {
		calculated: {
			dependencies: ["addresses"],
			fn: async (engine): Promise<boolean> => {
				const middesk = engine.getSource("middesk");
				const opencorporates = engine.getSource("opencorporates");
				const zoominfo = engine.getSource("zoominfo");
				const canadaOpen = engine.getSource("canadaopen");
				return (
					Boolean(middesk?.confidence) ||
					Boolean(opencorporates?.confidence) ||
					Boolean(zoominfo?.confidence) ||
					Boolean(canadaOpen?.confidence)
				);
			}
		}
	},
	minority_owned: {
		schema: z.boolean().nullish(),
		equifax_supplemental: async (_, efx) => normalizeEquifaxFlag(efx?.minority_business_enterprise),
		equifax: async (_, efx: EquifaxCombined) => normalizeEquifaxFlag(efx?.efx_mbe)
	},
	veteran_owned: {
		schema: z.boolean().nullish(),

		equifax_supplemental: async (_, equifax): Promise<boolean | undefined> =>
			normalizeEquifaxFlag(equifax?.veteran_owned_enterprise),
		equifax: async (_, efx: EquifaxCombined) => normalizeEquifaxFlag(efx?.efx_vet)
	},
	woman_owned: {
		schema: z.boolean().nullish(),
		equifax_supplemental: async (_, equifax): Promise<boolean | undefined> =>
			normalizeEquifaxFlag(equifax?.woman_owned_enterprise),
		equifax: async (_, efx: EquifaxCombined) => normalizeEquifaxFlag(efx?.efx_wbe)
	},
	email: {
		schema: z.email().nullish(),
		equifax: "efx_email"
	},
	website_found: {
		schema: z.preprocess(val => {
			if (typeof val === "string") {
				const url = val.startsWith("http://") || val.startsWith("https://") ? val : `http://${val}`;
				return [url];
			}
			if (Array.isArray(val)) {
				return val.map(item => {
					if (typeof item === "string") {
						return item.startsWith("http://") || item.startsWith("https://") ? item : `http://${item}`;
					}
					return item;
				});
			}
			return val;
		}, z.array(z.url())),
		zoominfo: "firmographic.zi_c_url",
		serp: "businessWebsite",
		verdataRaw: "seller.domain_name",
		equifax: "efx_web",
		AIWebsiteEnrichment: "response.company_website.url",
		normalize: async (engine, value) => {
			if (!Array.isArray(value)) {
				value = [value];
			}
			const cleanedSet = new Set<string>();
			const validWebsites = value.filter((w): w is string => w != null && typeof w === "string");
			validWebsites.forEach(website => {
				// Trim trailing slashes
				const lower = website.trim().toLowerCase().replace(/\/$/, "");
				// Add http:// if its missing that or https
				cleanedSet.add(lower.startsWith("http") || lower.startsWith("https") ? lower : `http://${lower}`);
			});
			return Array.from(cleanedSet);
		}
	},
	phone_found: {
		schema: z.preprocess(
			val => {
				if (typeof val === "number") {
					return val.toString();
				}
				if (Array.isArray(val)) {
					return val.map(item => (typeof item === "number" ? item.toString() : item));
				}
				return val;
			},
			z.union([z.string(), z.array(z.string())])
		),
		zoominfo: "firmographic.zi_c_phone",
		serp: "businessMatch.phone",
		verdataRaw: "seller.phone",
		middeskRaw: "phone_numbers[0].phone_number",
		equifax: "efx_phone",
		normalize: async (engine, value: string[] | string) => {
			const cleanedPhones = new Set<string>();
			if (!Array.isArray(value)) {
				value = [value];
			}
			// Preprocess: convert numbers to strings before validation
			value.forEach(phone => {
				if (typeof phone === "number") {
					phone = (phone as number).toString();
				}
				if (typeof phone === "string") {
					const cleaned = phone.replace(/\D/g, "");
					if (cleaned.length === 10) {
						// Convert to (XXX) XXX-XXXX format
						const formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
						cleanedPhones.add(formatted);
					} else {
						cleanedPhones.add(cleaned);
					}
				}
			});
			return cleanedPhones.size > 0 ? Array.from(cleanedPhones) : undefined;
		}
	},
	dba_found: {
		opencorporates: async (_, oc: OpenCorporateResponse): Promise<string[] | undefined> => {
			const dbaNames = new Set<string>();
			oc?.names?.forEach(({ source, name }) => {
				if (source === "alternate" && name.toLowerCase() !== oc.firmographic?.name?.toLowerCase()) {
					dbaNames.add(name);
				}
			});
			return dbaNames.size > 0 ? Array.from(dbaNames) : undefined;
		},
		zoominfo: async (_, zi: ZoomInfoResponse): Promise<string[] | undefined> =>
			collectZiNames(zi, ["firmographic.zi_c_company_name"]),
		canadaopen: async (_, canadaOpen: CanadaOpenEntityMatchTask): Promise<string[] | undefined> => {
			const names: string[] = [];
			if (canadaOpen.business?.other_names) {
				canadaOpen.business.other_names.split("|").forEach(name => names.push(name.trim()));
			}
			return names.length > 0 ? names : undefined;
		},
		verdataRaw: "seller.dba_name",
		businessDetails: async (_, details) => {
			const dba = details.business_names.filter(
				(name: any) => name.is_primary === false && name.name.toLowerCase() !== details.name.toLowerCase()
			);
			return dba?.map((name: any) => name.name);
		}
	},
	names_found: {
		zoominfo: async (_, zi) => collectZiNames(zi, ["firmographic.zi_c_name", "firmographic.zi_c_company_name"]),
		serp: "businessMatch.name",
		verdataRaw: "seller.name",
		middesk: async (_, middesk) => middesk?.names?.filter(name => name.submitted === false).map(({ name }) => name),
		opencorporates: async (_, oc: OpenCorporateResponse): Promise<string[] | undefined> =>
			oc?.names?.map(name => name.name),
		canadaopen: async (_, canadaOpen: CanadaOpenEntityMatchTask): Promise<string[] | undefined> => {
			const names: string[] = [];
			if (canadaOpen.business) {
				names.push(canadaOpen.business.name);
				if (canadaOpen.business.other_names) {
					canadaOpen.business.other_names.split("|").forEach(name => names.push(name.trim()));
				}
			}
			return names.length > 0 ? names : undefined;
		},
		businessDetails: async (_, details) => {
			return details.name ?? undefined;
		},
		business: async (_, truliooResponse: any): Promise<string[] | undefined> => {
			const businessData = truliooResponse?.clientData?.businessData;
			return businessData?.name ? [businessData.name] : undefined;
		}
	},
	countries: {
		calculated: {
			dependencies: ["addresses"],
			fn: async (engine): Promise<string[] | undefined> => {
				const foundCountries = new Set<string>();
				const addresses = engine.getResolvedFact("addresses")?.value;
				logger.debug(addresses);
				if (Array.isArray(addresses)) {
					const normalizedAddresses = addresses.map(addr => AddressUtil.normalizeString(addr));
					const combinedAddresses = [...normalizedAddresses, ...addresses];
					if (combinedAddresses.some(addr => isCanadianAddress(addr))) {
						foundCountries.add("CA");
					}
					if (combinedAddresses.some(addr => AddressUtil.isUSAddress(addr))) {
						foundCountries.add("US");
					}
					if (combinedAddresses.some(addr => AddressUtil.isUkAddress(addr))) {
						foundCountries.add("UK");
					}
				}
				const countries: string[] = Array.from(foundCountries);
				return countries.length > 0 ? countries : undefined;
			}
		}
	},
	stock_symbol: {
		equifax: "efx_tcksym",
		zoominfo: "firmographic.zi_c_stock_symbol"
	},
	tin_submitted: {
		description: "The TIN provided for the business",
		businessDetails: async (_, details) => {
			return details.tin ? maskString(details.tin) : undefined;
		},
		middesk: async (_, middesk: GetBusinessEntityReview): Promise<string | undefined> => {
			const tin = middesk?.businessEntityVerification?.tin;
			try {
				if (tin) {
					const decryptedTin = tin && safeDecrypt(tin ?? "");
					if (decryptedTin) {
						return decryptedTin;
					}
				}
			} catch (ex) {}
			if (tin) {
				return maskString(tin);
			}
		},
		middeskRaw: async (_, middesk) => {
			if (middesk.submitted?.tin?.tin) {
				return maskString(middesk.submitted.tin.tin);
			}
		},
		manualCustomer: async (engine, manualCustomer) => {
			if (manualCustomer.tin) {
				return maskString(manualCustomer.tin);
			}
		}
	},
	tin_match: {
		description:
			"An object containing details about if the Tax Identification Number submitted matches the best business candidate we found",
		schema: z.object({
			status: z.enum(["success", "failure"]).nullish(),
			message: z.string(),
			sublabel: z.string()
		}),
		middesk: async (_: FactEngine, middesk): Promise<{ status: string; message: string; sublabel: string }> => {
			const tin = middesk?.reviewTasks?.find((task: IBusinessEntityReviewTask) => task.key === "tin");
			return (
				tin && {
					status: tin?.status,
					message: tin?.message,
					sublabel: tin?.sublabel
				}
			);
		},
		business: async (
			engine: FactEngine,
			truliooResponse: any
		): Promise<{ status: string; message: string; sublabel: string } | undefined> => {
			if (!truliooResponse?.clientData) return undefined;
			const truliooTin = extractRegistrationNumberFromTruliooResponse(truliooResponse);
			if (!truliooTin) return undefined;

			const submittedTins = findFieldInInputArray(truliooResponse, ["InputFields", "Value"]).filter(
				entry => entry.item?.FieldName === "BusinessRegistrationNumber" && typeof entry.value === "string"
			);

			if (submittedTins.length === 0) {
				return undefined;
			}
			const normalizeTin = (tin: string): string => {
				return tin.replace(/[\s-]/g, "").toUpperCase();
			};

			const normalizedTruliooTin = normalizeTin(truliooTin);
			const submittedTin = submittedTins.find(tin => normalizeTin(tin.value) === normalizedTruliooTin);
			if (submittedTin) {
				return {
					status: "success",
					message: "Match Found",
					sublabel: ""
				};
			}
			return {
				status: "failure",
				message: "No Match",
				sublabel: ""
			};
		}
	},
	tin_match_boolean: {
		schema: z.boolean(),
		description:
			"A boolean value indicating if the business Tax Identification Number matches the TIN submitted by the user",
		calculated: {
			dependencies: ["tin_match"],
			fn: async (engine): Promise<boolean> =>
				engine.getResolvedFact("tin_match")?.value === "success" ||
				engine.getResolvedFact("tin_match")?.value?.status === "success"
		}
	},
	idv_status: {
		schema: z.record(z.enum(Object.keys(IDV_STATUS)), z.number()),
		description: "Overall status counts for owner identity verification attempts on this business",
		plaidIdv: async (
			_,
			idv: Array<IIdentityVerification<PlaidIdentityVerification>>
		): Promise<Record<keyof typeof IDV_STATUS, number>> => {
			// Get a flipped map: ID : Label (was Label:ID)
			const IdvStatusIdToIdvStatusKey: Record<keyof typeof IDV_STATUS, IdvStatusId> = Object.entries(IDV_STATUS).reduce(
				(acc, [key, value]) => {
					acc[value] = key;
					return acc;
				},
				{} as Record<keyof typeof IDV_STATUS, IdvStatusId>
			);

			// Initialize the output object with all possible statuses set to 0
			const out: Record<keyof typeof IDV_STATUS, number> = Object.values(IdentityVerificationStatus).reduce(
				(acc, plaidStatus) => {
					const worthStatusId: IdvStatusId = convertPlaidToWorth("status", plaidStatus) ?? IDV_STATUS.PENDING;
					// Get the status name from the IDV_STATUS object
					const worthStatus: keyof typeof IDV_STATUS = IdvStatusIdToIdvStatusKey[worthStatusId];
					acc[worthStatus] = 0;
					return acc;
				},
				{} as Record<keyof typeof IDV_STATUS, number>
			);
			// Get counts of IDV statuses for the business
			for (const record of idv) {
				const key = IdvStatusIdToIdvStatusKey[record.status];
				out[key] = (out[key] ?? 0) + 1;
			}
			return out;
		}
	},
	idv_passed: {
		schema: z.number(),
		description: "Count of successful identity verification attempts on this business - undefined if not enough data",
		calculated: {
			dependencies: ["idv_status"],
			fn: async (engine): Promise<number | undefined> => {
				const idvStatus = engine.getResolvedFact("idv_status")?.value as
					| Record<keyof typeof IDV_STATUS, number>
					| undefined;
				return idvStatus?.SUCCESS;
			}
		}
	},
	idv_passed_boolean: {
		schema: z.boolean(),
		description: "Whether the business has passed identity verification true or false - undefined if not enough data",
		calculated: {
			dependencies: ["idv_passed"],
			fn: async (engine): Promise<boolean | undefined> => {
				const idvPassed = engine.getResolvedFact("idv_passed")?.value as number | undefined;
				return idvPassed ? true : false;
			}
		}
	},
	is_sole_prop: {
		description: "Whether the business is a sole proprietorship: true or false - null if not enough data",
		calculated: {
			dependencies: ["tin_submitted", "idv_passed_boolean"],
			fn: async (engine): Promise<boolean | null> => {
				// Possible sources of TIN (not just doing simple fact resolution because we need the full TIN available to us)
				const businessDetails = engine.getSource("businessDetails")?.rawResponse;
				const middeskRaw = engine.getSource("middeskRaw")?.rawResponse;
				const customerFile = engine.getSource("manualCustomer")?.rawResponse;
				const tin = businessDetails?.tin ?? middeskRaw?.submitted?.tin?.tin ?? customerFile?.tin;
				const owners = businessDetails?.owners;

				if (!owners || owners.length === 0 || !tin) {
					// No tin or owners defined so cannot make determination - return null
					return null;
				}
				// Dedupe owners
				const uniqueOwners = owners.filter(
					(owner, index, self) => self.findIndex(t => t.name === owner.name) === index
				);
				if (uniqueOwners && uniqueOwners.length > 1) {
					// More than one owner so not a sole prop
					return false;
				}
				const idvStatus: Record<keyof typeof IDV_STATUS, number> | undefined =
					engine.getResolvedFact("idv_status")?.value;
				if (!idvStatus) {
					// No IDV rows so not feature enabled for IDV -- return null
					return null;
				}
				if (idvStatus.SUCCESS === 0) {
					// No successful IDV records so not a sole prop
					return false;
				}
				/*
				 Each retry is a new record, so we need to check each one and return right away if we find a match
				 it isn't enough to just check the first record so we need to instead compare a successful response with the business' TIN
				 If we exhaust the list of successful responses and don't find a match, then we return false
				 */
				const idvResponse =
					engine.getSource<IIdentityVerification<PlaidIdentityVerification>[]>("plaidIdv")?.rawResponse;
				const successfulResponsesWithIDNumber = idvResponse?.filter(
					record => record.meta.status === IdentityVerificationStatus.Success && record.meta?.user?.id_number?.value
				);
				if (!successfulResponsesWithIDNumber || successfulResponsesWithIDNumber.length == 0) {
					return null;
				}
				for (const record of successfulResponsesWithIDNumber) {
					if (record.meta?.user?.id_number) {
						// Shouldn't arrive here (should be caught by idvStatus.SUCCESS == 0 above) but just in case...
						const { type, value } = record.meta.user.id_number;
						// Get the type of id number and compare as appropriate
						if (type === IDNumberType.UsSsn && value === tin) {
							return true;
						} else if (type === IDNumberType.UsSsnLast4 && value === tin.slice(-4)) {
							return true;
						} else if (type === IDNumberType.CaSin && value === tin) {
							return true;
						}
					}
				}
				// If we got here, we looped through all the successful responses and didn't find a match for IDV-provided ID# === business TIN
				return false;
			}
		}
	},
	verification_status: {
		schema: z.string().nullish(),
		description: "Verification status from business verification",
		business: async (_, truliooResponse: any): Promise<string | undefined> => {
			return truliooResponse?.clientData?.status || undefined;
		}
	}
};

/*  Using the "Addresses" fact, we can create a new fact called "Found Addresses" that will return the addresses that are not submitted
	The only major difference is that we need to filter out Middesk addresses that are "submitted"
*/
simpleFacts.addresses_found = { ...simpleFacts.addresses };
delete simpleFacts.addresses_found.businessDetails;
simpleFacts.addresses_found.middesk = async (_, middesk) =>
	middesk?.addressSources
		?.filter(address => address.submitted === false)
		.map(address => address.full_address && address.full_address);

const factsFromSimpleFacts = simpleFactToFacts(simpleFacts, sources);

const facts: readonly Fact[] = factAbbreviatedToFact<any>({
	formation_state: [
		{
			source: sources.middesk,
			path: "businessEntityVerification.formation_state"
		},
		{
			source: sources.opencorporates,
			path: "firmographic.home_jurisdiction_text"
		}
	],
	formation_date: [
		{
			source: sources.middesk,
			fn: async (_, middesk: any): Promise<string | undefined> => {
				return middesk?.businessEntityVerification?.formation_date
					? middesk.businessEntityVerification.formation_date.toISOString()
					: undefined;
			}
		},
		{ source: sources.opencorporates, path: "firmographic.incorporation_date" },
		{
			source: sources.zoominfo,
			confidence: 0.2,
			fn: async (_, zi: ZoomInfoResponse): Promise<string | undefined> =>
				zi?.firmographic?.zi_c_year_founded && Number.isInteger(parseInt(zi.firmographic.zi_c_year_founded))
					? dayjs().set("year", parseInt(zi.firmographic.zi_c_year_founded)).startOf("year").format("YYYY-MM-DD")
					: undefined
		},
		{
			source: sources.business,
			fn: async (_, truliooResponse: any): Promise<string | undefined> => {
				const clientData = truliooResponse?.clientData;
				if (!clientData) return undefined;
				return extractIncorporationDateFromTrulioo(clientData);
			}
		}
	],
	year_established: [
		{
			source: sources.middesk,
			fn: async (_, middesk: any): Promise<string | undefined> => {
				return middesk?.businessEntityVerification?.formation_date
					? dayjs(middesk.businessEntityVerification.formation_date).year().toString()
					: undefined;
			}
		},
		{
			source: sources.opencorporates,
			fn: async (_, opencorporates: OpenCorporateResponse): Promise<string | undefined> => {
				return opencorporates?.firmographic?.incorporation_date
					? dayjs(opencorporates.firmographic.incorporation_date).year().toString()
					: undefined;
			}
		},
		{
			source: sources.zoominfo,
			fn: async (_, zi: ZoomInfoResponse): Promise<string | undefined> => {
				return Number.isInteger(parseInt(zi?.firmographic?.zi_c_year_founded ?? ""))
					? zi?.firmographic?.zi_c_year_founded?.toString()
					: undefined;
			}
		},
		{
			source: sources.business,
			fn: async (_, truliooResponse: any): Promise<string | undefined> => {
				const clientData = truliooResponse?.clientData;
				if (!clientData) return undefined;
				return extractYearOfIncorporationFromTrulioo(clientData);
			}
		},
		{
			source: sources.equifax,
			fn: async (_, efx: EquifaxCombined): Promise<string | undefined> =>
				efx.efx_yrest?.toString() ?? efx.max_year_est?.toString()
		},
		{ path: "year_created", source: sources.manual }
	],
	sos_filings: [
		{
			source: sources.middesk,
			fn: async (engine, middesk: GetBusinessEntityReview): Promise<SoSRegistration[]> => {
				return Promise.all(
					((middesk?.registrations as IBusinessEntityRegistration[]) || []).map(
						async ({
							id,
							external_id,
							name,
							jurisdiction,
							entity_type,
							status,
							registration_date,
							registration_state,
							source
						}) => {
							let officers = [];

							const peopleFact = engine.getFactDefinitionByNameAndSource("people", sources.middesk.name);
							if (peopleFact?.fn) {
								const allPeople = await peopleFact.fn(engine, middesk);
								officers = allPeople?.filter(
									({ jurisdictions }) =>
										Array.isArray(jurisdictions) &&
										jurisdictions.some(j => j?.toLowerCase() === "us::" + (registration_state?.toLowerCase() ?? ""))
								);
							}

							const jurisdictionLowerCase = jurisdiction?.toLowerCase();
							const foreignDomestic =	jurisdictionLowerCase === "foreign" || jurisdictionLowerCase === "domestic" 
								? jurisdictionLowerCase 
								: undefined;

							return {
								jurisdiction: "us::" + (registration_state?.toLowerCase() ?? ""),
								id: external_id,
								internal_reference: id,
								filing_date: registration_date,
								entity_type: entity_type,
								active: status === "active",
								foreign_domestic: foreignDomestic,
								state: registration_state,
								non_profit: undefined,
								url: source,
								filing_name: name,
								registration_date: registration_date,
								officers: officers ?? []
							};
						}
					)
				);
			}
		},
		{
			source: sources.opencorporates,
			fn: async (engine: FactEngine, oc: OpenCorporateResponse): Promise<unknown | undefined> => {
				const allSosFilings = oc.sosFilings ? [...oc.sosFilings] : [];
				if (Array.isArray(oc.sosFilings) && oc.firmographic) {
					const existingSosFilings = oc.sosFilings.find(
						filing =>
							filing.company_number === oc.firmographic?.company_number &&
							filing.jurisdiction_code === oc.firmographic?.jurisdiction_code
					);
					if (!existingSosFilings) {
						allSosFilings.push(oc.firmographic);
					}
				}
				const sosFilings = allSosFilings?.map(
					async ({
						company_number,
						name,
						company_type,
						home_jurisdiction_code,
						jurisdiction_code,
						incorporation_date,
						inactive,
						current_status,
						dissolution_date,
						has_been_liquidated,
						registry_url
					}) => {
						let foreign_domestic: SoSRegistration["foreign_domestic"] = undefined;
						if (company_type.toLowerCase().includes("foreign")) {
							foreign_domestic = "foreign";
						} else if (company_type.toLowerCase().includes("domestic")) {
							foreign_domestic = "domestic";
						} else if (company_type === "DLLC") {
							foreign_domestic = "domestic";
						} else if (home_jurisdiction_code && home_jurisdiction_code === jurisdiction_code) {
							foreign_domestic = "domestic";
						} else if (home_jurisdiction_code && home_jurisdiction_code !== jurisdiction_code) {
							foreign_domestic = "foreign";
						}

						const jurisdictionCodeToState = (jurisdictionCode: string) => {
							// If there's an underscore, use the second part as the state and capitalize it -- works for US & Canadian Jurisdictions as-is
							if (typeof jurisdictionCode === "string" && jurisdictionCode.includes("_")) {
								return jurisdictionCode.split("_")?.[1]?.toUpperCase();
							}
							// Otherwise just use what was given to us
							return jurisdictionCode;
						};

						const state = jurisdictionCodeToState(jurisdiction_code);
						let entity_type: string | undefined = undefined;
						if (
							["llc", "limited liability company", "limited liability corporation", "l.l.c."].some(sub =>
								company_type.toLowerCase().includes(sub)
							)
						) {
							entity_type = "llc";
						} else if (["corporation", "inc", "incorporated"].some(sub => company_type.toLowerCase().includes(sub))) {
							entity_type = "corporation";
						} else if (["llp", "limited liability partnership"].some(sub => company_type.toLowerCase().includes(sub))) {
							entity_type = "llp";
						} else if (["lp", "limited partnership"].some(sub => company_type.toLowerCase().includes(sub))) {
							entity_type = "lp";
						} else if (
							["sole proprietorship", "sole proprietor", "entreprise individuelle"].some(sub =>
								company_type.toLowerCase().includes(sub)
							)
						) {
							entity_type = "sole proprietorship";
						}
						let non_profit: SoSRegistration["non_profit"] = undefined;
						if (
							["non profit", "non-profit", "not profit", "not for profit", "not-for-profit"].some(sub =>
								company_type.toLowerCase().includes(sub)
							)
						) {
							non_profit = true;
						} else if (["profit"].some(sub => company_type.toLowerCase().includes(sub))) {
							non_profit = false;
						}

						let people = [];

						const peopleFact = engine.getFactDefinitionByNameAndSource("people", sources.opencorporates.name);
						if (peopleFact?.fn) {
							people = await peopleFact.fn(engine, oc);
						}
						const status = current_status?.toLowerCase();
						const dissolved = !!dissolution_date;
						const liquidated = has_been_liquidated === true;
						let active: boolean | undefined;

						if (inactive === true || statusMatch(status, OC_INACTIVE_STATUSES) || dissolved || liquidated) {
							active = false;
						} else if (inactive === false || statusMatch(status, OC_ACTIVE_STATUSES)) {
							active = true;
						} else {
							active = undefined;
						}
						return {
							id: `${jurisdiction_code}-${company_number}`,
							filing_date: incorporation_date,
							registration_date: incorporation_date,
							entity_type,
							filing_name: name,
							active: active,
							foreign_domestic: foreign_domestic,
							state,
							url: registry_url,
							non_profit: non_profit,
							jurisdiction: ocJurisdictionToJurisdiction(jurisdiction_code),
							officers: jurisdiction_code === oc.firmographic?.jurisdiction_code ? people : []
						};
					}
				);
				if (Array.isArray(sosFilings) && sosFilings.length > 0) {
					return Promise.all(sosFilings);
				}
				return undefined;
			}
		},
		{
			source: sources.business,
			fn: async (engine: FactEngine, truliooResponse: any): Promise<SoSRegistration[] | undefined> => {
				const clientData = truliooResponse?.clientData;
				if (!clientData) {
					return undefined;
				}

				const filings: SoSRegistration[] = [];

				let businessName = engine.getResolvedFact("legal_name")?.value || clientData.businessData?.name;
				if (!businessName) {
					businessName = extractFieldFromTruliooServiceData(clientData, "BusinessName");
				}

				if (!businessName) {
					return undefined;
				}

				const registrationNumber = extractRegistrationNumberFromTruliooResponse(truliooResponse);

				let formationDate = engine.getResolvedFact("formation_date")?.value;
				if (!formationDate) {
					formationDate = extractIncorporationDateFromTrulioo(clientData);
				}

				let jurisdiction = clientData.businessData?.state || clientData.businessData?.country;
				let state = extractFieldFromTruliooServiceData(clientData, "JurisdictionOfIncorporation");
				let country = extractFieldFromTruliooServiceData(clientData, "Country");
				let entityType = extractFieldFromTruliooServiceData(clientData, "BusinessLegalForm");

				if (!state) {
					state = clientData.businessData?.state;
				}
				if (!country) {
					country = clientData.businessData?.country;
				}
				const businessStatus = extractFieldFromTruliooServiceData(clientData, "BusinessStatus");
				let active: boolean | undefined = businessStatus ? businessStatus.toLowerCase() === "active" : undefined;

				const jurisdictionCode =
					country && country.toUpperCase() === "CA" && state
						? `ca::${state.toLowerCase()}`
						: country && country.toUpperCase() === "US" && state
							? `us::${state.toLowerCase()}`
							: country
								? country.toLowerCase()
								: "unknown";

				if (formationDate && state) {
					const serviceDataArray = getServiceDataArray(clientData);
					const serviceCountry = serviceDataArray[0]?.transactionInfo?.countryCode || clientData.countryCode || country;
					const jurisdiction = serviceCountry ? serviceCountry.toLowerCase() : undefined;
					const officers = extractDirectorsOfficersFromTrulioo(clientData, jurisdiction);

					const filingId = registrationNumber
						? `${state}-${registrationNumber}`
						: `${state}-${businessName.replace(/\s+/g, "-")}`;
					const filingJurisdiction = jurisdictionCode !== "unknown" ? jurisdictionCode : undefined;

					// Get registry URL from Trulioo-specific logic
					const registryUrl = getTruliooRegistryUrl(country, state);

					filings.push({
						id: filingId,
						internal_reference: registrationNumber || undefined,
						filing_name: businessName,
						entity_type: entityType,
						registration_date: formationDate,
						filing_date: formationDate,
						active: active,
						state: state,
						url: registryUrl,
						officers: officers,
						jurisdiction: filingJurisdiction
					} as any);
				}

				return filings.length > 0 ? filings : undefined;
			}
		}
	],
	primary_address: {
		dependencies: ["addresses"],
		fn: async (engine): Promise<BusinessAddress | undefined> => {
			const businessDetails = engine.getSource("businessDetails")?.rawResponse;
			if (businessDetails) {
				const primaryAddress = businessDetails.business_addresses?.find(
					(address: BusinessAddress) => address.is_primary === true
				);
				if (primaryAddress) {
					return {
						line_1: businessDetails.address_line_1,
						apartment: businessDetails.address_line_2,
						city: businessDetails.address_city,
						state: businessDetails.address_state,
						country: businessDetails.address_country,
						postal_code: businessDetails.address_postal_code,
						mobile: businessDetails.mobile,
						is_primary: true
					};
				}
			}
			const addresses = engine.getResolvedFact("addresses")?.value;
			if (addresses && Array.isArray(addresses) && addresses.length > 0) {
				const parsedAddress = AddressUtil.stringToParts(addresses[0]);
				const { line_1, line_2, city, state, postal_code, country } = parsedAddress;
				if (line_1 && city && state && postal_code) {
					return {
						line_1,
						apartment: line_2,
						city,
						state,
						postal_code,
						country: country ?? businessDetails?.address_country,
						is_primary: true,
						mobile: businessDetails?.mobile
					};
				}
			}
		},
		source: null
	},
	address_verification: [
		{
			source: sources.middesk,
			fn: async (_, review: GetBusinessEntityReview) => {
				const addresses =
					review?.addressSources?.map(({ full_address }) => AddressUtil.normalizeString(full_address)) ?? [];
				// Base addresses are derived from the already-normalized addresses (not the raw DB values)
				// to ensure consistency with the frontend's normalizeString output.
				// They strip unit designators + numbers entirely, allowing the frontend to match
				// an address that omits the unit (e.g. from Google/SERP) against a verified one.
				const baseAddresses = addresses.map(addr => AddressUtil.normalizeToBaseAddress(addr));
				const task = (review?.reviewTasks as IBusinessEntityReviewTask[])?.find(
					task => task.category === "address" && task.key === "address_verification"
				);
				return {
					addresses,
					baseAddresses,
					status: task?.status,
					message: task?.message,
					label: task?.label,
					sublabel: task?.sublabel
				};
			}
		},
		{
			source: sources.business,
			fn: async (_, review: GetBusinessEntityReview) => {
				const addresses =
					review?.addressSources?.map(({ full_address }) => AddressUtil.normalizeString(full_address)) ?? [];
				const baseAddresses = addresses.map(addr => AddressUtil.normalizeToBaseAddress(addr));
				const task = (review?.reviewTasks as IBusinessEntityReviewTask[])?.find(
					task => task.category === "address" && task.key === "address_verification"
				);
				return {
					addresses,
					baseAddresses,
					status: task?.status,
					message: task?.message,
					label: task?.label,
					sublabel: task?.sublabel
				};
			}
		}
	],
	address_verification_boolean: {
		source: null,
		dependencies: ["address_verification"],
		fn: async (engine): Promise<boolean> => engine.getResolvedFact("address_verification")?.value?.status === "success"
	},
	addresses_deliverable: {
		source: sources.middesk,
		fn: async (_, middesk): Promise<string[]> =>
			middesk?.addressSources
				?.filter(({ deliverable }) => deliverable)
				.map(({ full_address }) => AddressUtil.normalizeString(full_address))
	},
	tin: [
		{
			source: sources.middesk,
			fn: async (_, middesk: GetBusinessEntityReview): Promise<string | undefined> => {
				const tin = middesk?.businessEntityVerification?.tin;
				try {
					if (tin) {
						const decryptedTin = tin && safeDecrypt(tin ?? "");
						if (decryptedTin) {
							return decryptedTin;
						}
					}
				} catch (ex) {}
				return tin || undefined;
			}
		},
		{ source: sources.opencorporates, path: "firmographic.business_number" },
		{
			source: sources.canadaopen,
			fn: async (_, canada: CanadaOpenEntityMatchTask) =>
				canada.business?.business_number ?? canada.business?.corporate_id
		},
		{
			source: sources.businessDetails,
			fn: async (_, details) => {
				return details.tin || undefined;
			}
		},
		{
			source: sources.business,
			fn: async (_, truliooResponse: any): Promise<string | undefined> => {
				return extractRegistrationNumberFromTruliooResponse(truliooResponse);
			}
		}
	],
	people: [
		{
			source: sources.middesk,
			fn: async (
				_,
				middesk: GetBusinessEntityReview
			): Promise<
				| Array<{ name: string; titles: string[]; submitted?: boolean; source?: string[]; jurisdictions?: string[] }>
				| undefined
			> => {
				return middesk?.people?.map(({ name, titles, submitted, source }) => {
					let jurisdictions = source
						.filter(({ type }) => type === "registration")
						?.map(({ metadata }) => (metadata?.state ? "us::" + metadata?.state?.toLowerCase() : "us::"));
					return { name, titles, submitted, source: source.map(({ id }) => id), jurisdictions };
				});
			}
		},
		{
			source: sources.business,
			fn: async (
				_,
				truliooResponse: any
			): Promise<Array<{ name: string; titles: string[]; jurisdictions?: string[] }> | undefined> => {
				const clientData = truliooResponse?.clientData;
				if (!clientData) return undefined;

				const people: Array<{ name: string; titles: string[]; jurisdictions?: string[] }> = [];

				const businessData = clientData.businessData;
				if (businessData) {
					const country = businessData.country || businessData.address?.country;
					const jurisdiction = country ? country.toLowerCase() : undefined;

					if (Array.isArray(businessData.directors)) {
						businessData.directors.forEach((director: any) => {
							const name =
								director.fullName || director.name || `${director.firstName || ""} ${director.lastName || ""}`.trim();
							if (name) {
								people.push({
									name,
									titles: director.title ? [director.title] : ["Director"],
									jurisdictions: jurisdiction ? [jurisdiction] : undefined
								});
							}
						});
					}

					if (Array.isArray(businessData.ubos)) {
						businessData.ubos.forEach((ubo: any) => {
							const name = ubo.fullName || ubo.name || `${ubo.firstName || ""} ${ubo.lastName || ""}`.trim();
							if (name) {
								people.push({
									name,
									titles: ubo.title ? [ubo.title] : ["UBO"],
									jurisdictions: jurisdiction ? [jurisdiction] : undefined
								});
							}
						});
					}
				}

				const serviceDataArray = getServiceDataArray(clientData);

				if (people.length === 0 && serviceDataArray.length > 0) {
					const country = serviceDataArray[0]?.transactionInfo?.countryCode || clientData.countryCode;
					const jurisdiction = country ? country.toLowerCase() : undefined;
					const extractedOfficers = extractDirectorsOfficersFromTrulioo(clientData, jurisdiction);
					people.push(...extractedOfficers);
				}

				if (people.length > 0) {
					const seen = new Set<string>();
					const uniquePeople = people.filter(person => {
						const key = person.name.toLowerCase().trim();
						if (seen.has(key)) {
							return false;
						}
						seen.add(key);
						return true;
					});
					return uniquePeople.length > 0 ? uniquePeople : undefined;
				}

				return undefined;
			}
		},
		{
			source: sources.opencorporates,
			fn: async (_, oc: OpenCorporateResponse) =>
				oc?.officers?.map(officer => ({
					jurisdictions: [ocJurisdictionToJurisdiction(oc?.firmographic?.jurisdiction_code)],
					name: officer.name,
					titles: officer.title ? [officer.title] : [],
					address: {
						street: officer.officer_address_street,
						locality: officer.officer_address_locality,
						region: officer.officer_address_region,
						postal_code: officer.officer_address_postal_code,
						country: officer.officer_address_country,
						full_address: officer.officer_address_full
					},
					first_name: officer.officer_first_name,
					last_name: officer.officer_last_name,
					status: officer.officer_status,
					start_date: officer.officer_start_date,
					officer_type: officer.officer_type
				}))
		},
		{
			source: sources.verdataRaw,
			confidence: 0.1,
			fn: async (_, verdata: VerdataType.Record) =>
				verdata?.principals?.map(person => {
					let jurisdiction = "us::";
					if (person?.state && typeof person.state === "string") {
						jurisdiction = "us::" + person.state.toLowerCase();
					}
					return {
						name: `${person.first_name} ${person.last_name}`,
						titles: person.principal_type && [person.principal_type],
						jurisdictions: [jurisdiction]
					};
				})
		},
		{
			source: sources.equifax,
			confidence: 0.1,
			fn: async (
				_,
				efx: EquifaxCombined
			): Promise<
				| Array<{ name: string; titles: string[]; submitted?: boolean; source?: string[]; jurisdictions?: string[] }>
				| undefined
			> => {
				type Person = { name: string; titles: string[]; jurisdictions?: string[] };
				const people = new Set<Person>();
				let jurisdiction = "us::";
				if (efx.efx_contct && efx.efx_titledesc) {
					people.add({ name: efx.efx_contct, titles: [efx.efx_titledesc], jurisdictions: [jurisdiction] });
				}
				if (efx.efx_ceoname && efx.efx_ceotitledesc) {
					people.add({ name: efx.efx_ceoname, titles: [efx.efx_ceotitledesc], jurisdictions: [jurisdiction] });
				}
				if (efx.efx_cioname && efx.efx_ciotitledesc) {
					people.add({ name: efx.efx_cioname, titles: [efx.efx_ciotitledesc], jurisdictions: [jurisdiction] });
				}
				if (efx.efx_cfoname && efx.efx_cfotitledesc) {
					people.add({ name: efx.efx_cfoname, titles: [efx.efx_cfotitledesc], jurisdictions: [jurisdiction] });
				}
				if (efx.efx_cioname && efx.efx_ciotitledesc) {
					people.add({ name: efx.efx_cioname, titles: [efx.efx_ciotitledesc], jurisdictions: [jurisdiction] });
				}
				return people.size ? Array.from(people) : undefined;
			}
		},
		{
			source: sources.person,
			fn: async (
				_,
				truliooPersonResponse: any
			): Promise<
				| Array<{ name: string; titles: string[]; submitted?: boolean; source?: string[]; jurisdictions?: string[] }>
				| undefined
			> => {
				return extractPeopleFromTruliooPerson(truliooPersonResponse);
			}
		}
	],
	name_match: [
		{
			source: sources.middesk,
			fn: async (engine, middesk): Promise<{ status: string; message: string; sublabel: string }> => {
				const name = middesk?.reviewTasks?.find((task: IBusinessEntityReviewTask) => task.key === "name");
				return (
					name && {
						status: name?.status,
						message: name?.message,
						sublabel: name?.sublabel
					}
				);
			}
		},
		{
			source: sources.opencorporates,
			fn: async (_, oc: OpenCorporateResponse): Promise<{ status: string; message: string; sublabel: string }> =>
				Array.isArray(oc?.names) && oc.names?.length > 0
					? { status: "success", message: "Match Found", sublabel: "" }
					: { status: "failure", message: "No Match", sublabel: "" }
		},
		{
			source: sources.business,
			fn: async (
				_,
				review: GetBusinessEntityReview
			): Promise<{ status: string; message: string; sublabel: string } | undefined> => {
				const task = (review?.reviewTasks as IBusinessEntityReviewTask[])?.find(
					task => task.category === "name" && task.key === "name"
				);
				return task && task.status
					? {
							status: task.status,
							message: task.message || "",
							sublabel: task.sublabel || ""
						}
					: undefined;
			}
		}
	] as Fact<{ status: string; message: string; sublabel: string }>[],
	name_match_boolean: {
		source: null,
		dependencies: ["name_match"],
		fn: async (engine): Promise<boolean> => {
			const nameMatchValue = engine.getResolvedFact("name_match")?.value;
			return nameMatchValue === "success" || nameMatchValue?.status === "success";
		}
	},
	/* Note that these are only using middesk names at the moment on purpose */
	names_submitted: {
		source: sources.middesk,
		fn: async (_, middesk: GetBusinessEntityReview): Promise<Array<{ name: string; submitted: boolean }> | undefined> =>
			middesk?.names?.map(({ name, submitted }) => ({ name, submitted }))
	},
	address_match: [
		{
			source: null,
			dependencies: ["address_verification"],
			confidence: 0.9,
			fn: async function (engine): Promise<IBusinessEntityReviewTask["status"]> {
				// Use address_verification review task status (like Middesk does)
				// This is more reliable than Levenshtein distance since we always create a review task when addresses exist
				const addressVerification = engine.getResolvedFact("address_verification");
				if (addressVerification?.value) {
					const verificationValue = addressVerification.value as { status?: string; addresses?: string[] };
					if (verificationValue.status === "success" || verificationValue.status === "failure") {
						return verificationValue.status;
					}
				}
				// If no review task status is available, return failure
				return "failure";
			}
		}
	],
	address_match_boolean: {
		source: null,
		dependencies: ["address_match"],
		fn: async (engine): Promise<boolean> => engine.getResolvedFact("address_match")?.value === "success"
	},
	address_registered_agent: [
		{
			source: sources.middesk,
			fn: async (_, middesk): Promise<{ status: string; message: string }> => {
				const addressRegisteredAgent = middesk?.reviewTasks?.find(
					(task: IBusinessEntityReviewTask) => task.key === "address_registered_agent"
				);
				return (
					addressRegisteredAgent && {
						status: addressRegisteredAgent?.status,
						message: addressRegisteredAgent?.message
					}
				);
			}
		}
	],
	sos_match: [
		{
			source: sources.middesk,
			fn: async (engine, middesk): Promise<IBusinessEntityReviewTask["status"]> =>
				middesk?.reviewTasks?.find((task: IBusinessEntityReviewTask) => task.key === "sos_match")?.status
		},
		{
			source: sources.opencorporates,
			fn: async (_, oc: OpenCorporateResponse): Promise<"success" | "failure"> => {
				if (oc.firmographic?.company_number) {
					return "success";
				}
				if (Array.isArray(oc?.sosFilings) && oc.sosFilings?.length > 0) {
					return "success";
				}
				return "failure";
			}
		},
		{
			source: sources.business,
			fn: async (engine: FactEngine, truliooResponse: any): Promise<"success" | "failure"> => {
				const clientData = truliooResponse?.clientData;
				if (!clientData) return "failure";

				// Check if we have essential data for a filing (registration number, formation date, state)
				const registrationNumber = extractRegistrationNumberFromTruliooResponse(truliooResponse);
				if (!registrationNumber) return "failure";

				let formationDate = engine.getResolvedFact("formation_date")?.value;
				if (!formationDate) {
					formationDate = extractIncorporationDateFromTrulioo(clientData);
				}

				let state = extractFieldFromTruliooServiceData(clientData, "JurisdictionOfIncorporation");
				if (!state) {
					state = clientData.businessData?.state;
				}

				if (registrationNumber && formationDate && state) {
					const businessStatus = extractFieldFromTruliooServiceData(clientData, "BusinessStatus");
					if (businessStatus) {
						return businessStatus.toLowerCase() === "active" ? "success" : "failure";
					}
					return "success";
				}

				return "failure";
			}
		}
	],
	sos_match_boolean: {
		source: null,
		dependencies: ["sos_match"],
		fn: async (engine): Promise<boolean> => engine.getResolvedFact("sos_match")?.value === "success"
	},
	sos_active: {
		dependencies: ["sos_filings"],
		fn: async (engine): Promise<boolean | undefined> => {
			const filings = engine.getResolvedFact("sos_filings")?.value;

			if (!filings || !Array.isArray(filings) || filings.length === 0) {
				return undefined;
			}
			return filings.some(filing => filing.active === true || filing.status === "active");
		}
	},

	watchlist_raw: [
		{
			source: sources.middesk,
			fn: async (_, middesk: GetBusinessEntityReview): Promise<WatchlistValue | undefined> => {
				const watchlist = (middesk?.reviewTasks as IBusinessEntityReviewTask[])?.find(task => task.key === "watchlist");
				if (!watchlist) return undefined;

				const metadata = ensureBusinessEntityType(watchlist.metadata as WatchlistValueMetadatum[] | undefined);

				return {
					metadata,
					message: watchlist.message || ""
				};
			}
		},
		{
			source: sources.business,
			fn: async (_, truliooResponse: any): Promise<WatchlistValue | undefined> => {
				let watchlistResults = truliooResponse?.clientData?.watchlistResults;
				logger.debug(`watchlistResults: ${JSON.stringify(watchlistResults)}`);

				if (!watchlistResults || !Array.isArray(watchlistResults) || watchlistResults.length === 0) {
					if (truliooResponse?.clientData) {
						const extracted = extractWatchlistResultsFromTruliooResponse(truliooResponse.clientData);
						if (extracted && extracted.length > 0) {
							watchlistResults = extracted;
							if (!truliooResponse.clientData.watchlistResults) {
								truliooResponse.clientData.watchlistResults = extracted;
							}
						}
					}
				}

				// Fallback: read from reviewTasks (where the data was saved by the webhook)
				if (!watchlistResults || !Array.isArray(watchlistResults) || watchlistResults.length === 0) {
					const watchlistTask = (truliooResponse?.reviewTasks as IBusinessEntityReviewTask[])?.find(
						task => task.key === "watchlist"
					);
					if (watchlistTask?.metadata) {
						const metadata = ensureBusinessEntityType(watchlistTask.metadata as WatchlistValueMetadatum[] | undefined);

						return {
							metadata,
							message: watchlistTask.message || ""
						};
					}
				}

				if (!watchlistResults || !Array.isArray(watchlistResults) || watchlistResults.length === 0) {
					return undefined;
				}

				// Transform raw Trulioo watchlist results to WatchlistValueMetadatum format
				// watchlistResults comes from Trulioo API and may have varying structures
				const metadata = transformTruliooBusinessWatchlistResults(
					watchlistResults as Parameters<typeof transformTruliooBusinessWatchlistResults>[0]
				);

				return {
					metadata,
					message: watchlistResults.length > 0 ? `Found ${watchlistResults.length} watchlist hit(s)` : ""
				};
			}
		}
	],
	watchlist: {
		schema: z.object({
			metadata: z.array(
				z.object({
					id: z.string(),
					type: z.string(),
					entity_type: z.string().optional(),
					metadata: z.object({
						abbr: z.string(),
						title: z.string(),
						agency: z.string(),
						agency_abbr: z.string(),
						entity_name: z.string()
					}),
					url: z.string().nullish(),
					list_url: z.string().nullish(),
					agency_information_url: z.string().nullish(),
					agency_list_url: z.string().nullish(),
					list_country: z.string().nullish(),
					list_region: z.string().nullish(),
					entity_aliases: z.array(z.string()).optional(),
					addresses: z.array(z.object({ full_address: z.string() })).optional(),
					listed_at: z.string().nullish(),
					categories: z.array(z.string()).optional(),
					score: z.number().optional()
				})
			),
			message: z.string()
		}),
		source: null,
		dependencies: ["watchlist_raw", "screened_people"],
		fn: calculateConsolidatedWatchlist,
		description: "Consolidated watchlist hits from business (KYB) and person (PSC) screenings"
	},
	watchlist_hits: {
		source: null,
		dependencies: ["watchlist"],
		fn: async (engine): Promise<number | undefined> => {
			const watchlistValue = engine.getResolvedFact("watchlist")?.value;
			if (!watchlistValue) return undefined;

			// Now each metadata entry represents one individual hit
			// So the total number of hits is the length of the metadata array
			return watchlistValue.metadata?.length;
		}
	},
	/**
	 * Adverse media hits count: Trulioo business watchlist + adverse_media table.
	 * No dependencies; values come directly from business and adverseMediaDetails sources.
	 */
	adverse_media_hits: [
		{
			source: sources.business,
			fn: async (_, truliooResponse: any): Promise<number> => {
				const watchlistResults = truliooResponse?.clientData?.watchlistResults;
				if (!Array.isArray(watchlistResults)) return 0;
				return watchlistResults.filter(
					(hit: any) =>
						(hit?.listType || "").toLowerCase() === WATCHLIST_HIT_TYPE.ADVERSE_MEDIA
				).length;
			}
		},
		{
			source: sources.adverseMediaDetails,
			fn: async (_, adverseMediaData: { records?: { total_risk_count?: number }[] } | undefined): Promise<number> => {
				if (!adverseMediaData?.records?.length) return 0;
				const totalRiskCount = adverseMediaData.records[0]?.total_risk_count;
				return typeof totalRiskCount === "number" ? totalRiskCount : 0;
			}
		}
	],
	corporation: [
		{
			source: sources.zoominfo,
			fn: async (_, zi: ZoomInfoResponse): Promise<string | null> => {
				const isPublic = zi?.firmographic?.zi_c_is_public;
				return corporationType(isPublic);
			}
		},
		{
			source: sources.equifax,
			fn: async (_, equifax: EquifaxCombined): Promise<string | undefined | null> => {
				if (equifax.efx_public != null) {
					const publicFlag = equifax.efx_public;
					// 1 HQ is Public, 2 Branch is Public, otherwise "unknown" (so treat as Private)
					const isPublic: 0 | 1 = publicFlag === 1 || publicFlag === 2 ? 1 : 0;
					return corporationType(isPublic);
				}
			}
		}
	],
	npi: [
		{
			source: sources.npiHealthcare,
			description: "NPI number from healthcare provider information",
			fn: async (_, npiData: any): Promise<string | undefined> => {
				return npiData?.submitted_npi ?? undefined;
			}
		}
	],
	/**
	 * Process completion data for KYB category (id=7)
	 * Returns KYB category timestamp
	 */
	process_completion_data: [
		{
			schema: z.string().nullable(),
			source: sources.categoryCompletions,
			fn: async (_, categoryMap: Record<number, string> | null) =>
				categoryMap?.[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || null
		}
	]
});
export const kybFacts = [...facts, ...factsFromSimpleFacts, ...truliooFacts];
