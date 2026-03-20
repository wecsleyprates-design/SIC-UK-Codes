import type { IntegrationFactGetMetadata } from "../types";
import { type BusinessAddress, getBusinessDetails } from "#helpers/api";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import type { FactEngine } from "#lib/facts";
import { FactName } from "#lib/facts/types";
import type { MiddeskAddress, MiddeskCreateBusinessPayload, MiddeskPeople } from "#api/v1/modules/verification/types";
import { getStateCodeByStateName } from "us-state-codes";
import { AddressUtil, type NormalizedAddress } from "#utils";
import { fetchBusinessDetailsPeople } from "./fetchBusinessDetailsPeople";
import { logger } from "#helpers/logger";
import { createAdapter } from "../shared/createAdapter";

const getStateCode = (state: string | null) =>
	(state ? getStateCodeByStateName(state) || state : "").slice(0, 2).toUpperCase();

const FACT_NAMES: FactName[] = [
	"business_name",
	"dba",
	"primary_address",
	"primary_address_string",
	"addresses",
	"tin",
	"website",
	"business_addresses_submitted"
];

type MiddeskTaskMetadata = MiddeskCreateBusinessPayload & { forceRun?: boolean };

// Collect addresses from fact engine (includes overrides). Deduped by fingerprint.
function getAddressesFromFactEngine(factEngine: FactEngine): MiddeskAddress[] {
	const map = new Map<string, MiddeskAddress>();
	const add = (addr: NormalizedAddress | BusinessAddress) => {
		const fp = AddressUtil.toFingerprint(addr);
		if (!map.has(fp)) map.set(fp, normalizedAddressToMiddeskAddress(addr));
	};
	const primaryAddressString = factEngine.getResolvedFact<string>("primary_address_string")?.value;
	if (typeof primaryAddressString === "string" && primaryAddressString.trim()) {
		try {
			add(AddressUtil.stringToParts(primaryAddressString));
		} catch (err) {
			logger.warn({ err, primaryAddressString }, "Middesk adapter: failed to parse primary_address_string fact value string");
		}
	}
	const primaryAddress = factEngine.getResolvedFact<BusinessAddress>("primary_address")?.value;
	if (primaryAddress) add(primaryAddress);
	factEngine.getResolvedFact<BusinessAddress[]>("business_addresses_submitted")?.value?.forEach(add);
	factEngine.getResolvedFact<string[]>("addresses")?.value?.forEach(addr => {
		try {
			add(AddressUtil.stringToParts(addr));
		} catch (err) {
			logger.warn({ err, addr }, "Middesk adapter: failed to parse primary_address fact value string");
		}
	});
	return Array.from(map.values());
}

// Fallback: addresses from case-service when fact engine has none.
async function getAddressesFromCaseService(businessID: string): Promise<MiddeskAddress[]> {
	try {
		const res = await getBusinessDetails(businessID);
		if (res.status !== "success" || !res.data) return [];
		const data = res.data;
		if (data.address_line_1?.trim()) {
			return [
				normalizedAddressToMiddeskAddress({
					line_1: data.address_line_1,
					line_2: data.address_line_2 ?? null,
					city: data.address_city,
					state: data.address_state,
					postal_code: data.address_postal_code
				} as NormalizedAddress)
			];
		}
		if (data.business_addresses?.length) {
			return data.business_addresses.map(addr => normalizedAddressToMiddeskAddress(addr));
		}
	} catch (error) {
		logger.warn({ err: error, businessID }, "Middesk adapter: could not fetch business details from case-service");
	}
	return [];
}

const getMetadata: IntegrationFactGetMetadata<MiddeskTaskMetadata> = async businessID => {
	const facts = allFacts.filter(fact => FACT_NAMES.includes(fact.name));
	const factEngine = new FactEngineWithDefaultOverrides(facts, { business: businessID });
	await factEngine.applyRules(FactRules.factWithHighestConfidence);

	// Resolved facts (includes overrides from Case Management, e.g. business name / primary_address_string)
	const businessName = factEngine.getResolvedFact<string>("business_name")?.value;
	const dba = factEngine.getResolvedFact<string[]>("dba")?.value;
	const tin = factEngine.getResolvedFact<string>("tin")?.value;
	const website = factEngine.getResolvedFact<string>("website")?.value;
	let people: MiddeskPeople[] | undefined;

	/**
	 * Within case management, the data source for owners (people) is the case service and *not* facts.
	 * Owners are fetched and edited via the case service, which means that, unlike other fields,
	 * we need to fetch the owner (people) data from the case service and *not* facts.
	 */
	try {
		people = await fetchBusinessDetailsPeople(businessID);
	} catch (error) {
		logger.error({ err: error, businessID }, "Error fetching people for business");
	}

	if (!people) {
		const peopleFactValue = factEngine.getResolvedFact<{ name: string }[]>("people")?.value;
		people = peopleFactValue?.map(person => ({ name: person.name }));
	}

	const metadata: MiddeskTaskMetadata = { name: "", addresses: [], forceRun: true };
	if (businessName) metadata.name = businessName;
	if (dba?.length) metadata.names = dba.map(name => ({ name, name_type: "dba" })) ?? [];

	// Addresses: Checks fact engine first for override values, then case-service as a fallback
	let addresses = getAddressesFromFactEngine(factEngine);
	if (addresses.length === 0) addresses = await getAddressesFromCaseService(businessID);
	metadata.addresses = addresses;

	if (tin) metadata.tin = { tin };
	if (website) metadata.website = { url: website };
	if (people) metadata.people = people;

	if (!metadata.name || metadata.addresses.length === 0) return undefined;

	return metadata;
};

const normalizedAddressToMiddeskAddress = (address: NormalizedAddress | BusinessAddress): MiddeskAddress => {
	const isBusinessAddress = (addr: NormalizedAddress | BusinessAddress): addr is BusinessAddress => {
		return "apartment" in addr;
	};

	return {
		address_line1: address.line_1 ?? "",
		address_line2: (isBusinessAddress(address) ? address.apartment : address.line_2) ?? undefined,
		city: address.city ?? "",
		state: getStateCode(address.state) ?? "",
		postal_code: address.postal_code?.slice(0, 5) || ""
	};
};

/** Attach fact dependencies metadata to the adapter */
export const middeskAdapter = createAdapter<MiddeskTaskMetadata>({
	getMetadata,
	factNames: FACT_NAMES
});
