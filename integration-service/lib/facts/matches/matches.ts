import { INTEGRATION_ID } from "#constants";
import type { IEquifaxJudgementsLiens } from "#lib/equifax/types";
import type { OpenCorporateResponse } from "#lib/opencorporates/types";
import type { ZoomInfoResponse } from "#lib/zoominfo/types";
import type { IDBConnection } from "#types/db";
import z from "zod-v4";
import { MAX_CONFIDENCE_INDEX, sources } from "../sources";
import { simpleFactToFacts, type Fact, type SimpleFact } from "../types";
import { cloneDeep } from "lodash";

const simpleFacts: SimpleFact = {
	all_google_place_ids: {
		calculated: {
			dependencies: ["google_place_id", "serp_id"],
			fn: async engine => {
				const serpId = engine.getResolvedFact("serp_id")?.value;
				const googlePlaceId = engine.getResolvedFact("google_place_id")?.value;
				return [googlePlaceId, serpId].filter(Boolean) as string[];
			}
		}
	},
	customer_ids: {
		businessCustomers: {
			confidence: 0.9,
			path: "customer_ids"
		},
		manual: {
			confidence: 0.8,
			path: "external_id"
		}
	},
	canadaopen_confidence: {
		canadaopen: "prediction"
	},
	canadaopen_id: {
		canadaopen: "business.corporate_id"
	},
	canadaopen_match_mode: {
		canadaopen: "match_mode"
	},
	equifax_confidence: {
		equifax: async engine => engine.getSource("equifax")?.confidence
	},
	equifax_id: {
		equifax: async (engine, efx) => efx.report?.efx_id ?? efx.efx_id
	},
	equifax_match_mode: {
		equifax: "match_mode"
	},
	external_id: {
		manual: {
			confidence: 1,
			path: "external_id"
		}
	},
	google_place_id: {
		connectionConfigs: async (_, connections: IDBConnection[]) =>
			connections.find(c => c.platform_id === INTEGRATION_ID.GOOGLE_PLACES_REVIEWS)?.configuration?.place_id
	},
	middesk_confidence: {
		calculated: {
			dependencies: ["middesk_id"],
			fn: async engine => engine.getResolvedFact("middesk_id")?.source?.confidence
		}
	},
	middesk_id: {
		middesk: "businessEntityVerification.external_id"
	},
	opencorporates_confidence: {
		opencorporates: async (_, oc: OpenCorporateResponse) => oc.match && oc.match.index / MAX_CONFIDENCE_INDEX
	},
	opencorporates_id: {
		opencorporates: async (_, oc: OpenCorporateResponse) =>
			oc.match && `${oc.match.jurisdiction_code}::${oc.match.company_number}`
	},
	opencorporates_match_mode: {
		opencorporates: "match_mode"
	},
	serp_id: {
		serp: "businessMatch.place_id"
	},
	verdata_confidence: {
		verdataRaw: async (_, verdata) => JSON.stringify(verdata?.match_score)
	},
	verdata_id: {
		verdataRaw: async (_, verdata) => verdata?.seller_id
	},
	zoominfo_confidence: {
		zoominfo: async (_, zi: ZoomInfoResponse) => zi.match?.index && zi.match.index / MAX_CONFIDENCE_INDEX,
		schema: z.number().min(0).max(1).nullish()
	},
	zoominfo_id: {
		zoominfo: "firmographic.zi_c_company_id",
		schema: z.string()
	},
	zoominfo_match_mode: {
		zoominfo: "match_mode"
	},
	/** Add all internal platform matches here to track how many matches we have */
	internal_platform_matches: {
		zoominfo: "firmographic.zi_c_company_id",
		opencorporates: "match.company_number",
		equifax: async (engine, efx) => efx.report?.efx_id ?? efx.efx_id,
		canadaopen: async (engine, canadaOpen) => canadaOpen.business?.corporate_id
	},
	internal_platform_matches_count: {
		calculated: {
			dependencies: ["internal_platform_matches_combined"],
			fn: async (engine): Promise<number> =>
				Object.values(engine.getResolvedFact("internal_platform_matches_combined")?.value ?? {}).filter(Boolean)
					.length ?? 0
		}
	}
};
simpleFacts.internal_platform_matches_combined = cloneDeep(simpleFacts.internal_platform_matches);

export const matchingFacts: Fact[] = simpleFactToFacts(simpleFacts, sources);
