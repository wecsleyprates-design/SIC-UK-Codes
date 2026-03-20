import { sources } from "../sources";
import { simpleFactToFacts, type Fact, type SimpleFact } from "../types";
import {
	normalizeVerdataStatus,
	prepareVerdataBLJ,
	hasPossibleRecords,
	findMostRecentRecord,
	checkEquifaxStatus,
	calculateTotalActiveAmount
} from "./utils";
import { sanitizeNumericString } from "#utils/sanitizeNumericString";
import { convertAgeToDate } from "#lib/equifax/util";
import type { FactEngine } from "..";
import type { Bankruptcy, Judgement, Lien } from "./types";
import type { EquifaxCombined } from "#lib/equifax/types";
import type {
	Record as VerdataRecord,
	Bankruptcy as VerdataBankruptcy,
	Judgement as VerdataJudgement,
	Lien as VerdataLien,
	BLJ
} from "#lib/verdata/types";
import z from "zod-v4";

/* Set Verdata fact confidence higher than Equifax when they are similar */
const preferVerdata = (engine: FactEngine): number | undefined => {
	const threshold = 0.2;

	const verdataConfidence = engine.getSource("verdataRaw")?.confidence;
	const efxConfidence = engine.getSource("equifax")?.confidence;

	if (verdataConfidence == null || verdataConfidence == 0) {
		return;
	}
	if (efxConfidence == null || efxConfidence == 0 || verdataConfidence > efxConfidence) {
		return verdataConfidence;
	}
	if (efxConfidence - verdataConfidence <= threshold) {
		// Set to slightly higher than efxConfidence to avoid a tie
		return efxConfidence + 0.01;
	}
	return verdataConfidence;
};

const simpleBJLFacts: SimpleFact = {
	num_liens: {
		schema: z.int().min(0),
		calculated: {
			dependencies: ["liens"],
			fn: async (engine): Promise<number | null> => {
				const liens = engine.getResolvedFact("liens")?.value;
				return liens?.count ?? null;
			}
		}
	},
	num_judgements: {
		schema: z.int().min(0),
		calculated: {
			dependencies: ["judgements"],
			fn: async (engine): Promise<number | null> => {
				const judgements = engine.getResolvedFact("judgements")?.value;
				return judgements?.count ?? null;
			}
		}
	},
	num_bankruptcies: {
		schema: z.int().min(0),

		calculated: {
			dependencies: ["bankruptcies"],
			fn: async (engine): Promise<number | null> => {
				const bankruptcies = engine.getResolvedFact("bankruptcies")?.value;
				return bankruptcies?.count ?? null;
			}
		}
	},
	bankruptcies: {
		description: "Bankruptcies associated to this business",
		equifax: async function (this: Fact, engine: FactEngine, efx: EquifaxCombined): Promise<undefined | Bankruptcy> {
			// Equifax bankruptcy is just an indicator -- so it's either going to be a 0 or 1 or null
			const numberBankruptcies = sanitizeNumericString(efx.efxbma_pubrec_bkp_ind);
			const validNumbers = [0, 1];
			// Require bankruptcy indicator to be present and be either 0 or 1
			if (numberBankruptcies == null || !validNumbers.includes(numberBankruptcies)) {
				return;
			}

			// If the bankruptcy indicator is 0, then there are no bankruptcies so we send a 0 for count and null for the other attributes
			if (numberBankruptcies === 0) {
				return {
					count: 0,
					most_recent: null,
					most_recent_status: null
				};
			}

			return {
				count: 1,
				most_recent: convertAgeToDate(efx.efxbma_pubrec_age_bkp, efx.efxbma_extract_date, efx.extract_month),
				most_recent_status: "active"
			};
		},
		verdataRaw: async function (
			this: Fact,
			engine: FactEngine,
			verdata: VerdataRecord
		): Promise<undefined | Bankruptcy> {
			this.confidence = preferVerdata(engine);

			const bljArray: BLJ[] | null = prepareVerdataBLJ(verdata);
			if (!bljArray) return;

			// Check if summary has possible bankruptcies
			const hasBankruptcies = bljArray.some(blj =>
				hasPossibleRecords<Bankruptcy>(blj, [
					"summary.bankruptcy_subject_count",
					"summary.bankruptcy_creditor_count",
					"bankruptcies[0].filing_date"
				])
			);
			if (!hasBankruptcies) return;

			const allBankruptcies = bljArray.flatMap(b => b.bankruptcies).filter(b => "filing_date" in b);
			const mostRecentBankruptcy = findMostRecentRecord<VerdataBankruptcy>(allBankruptcies, "filing_date");
			return {
				count: allBankruptcies.length,
				most_recent: mostRecentBankruptcy?.filing_date ? new Date(mostRecentBankruptcy.filing_date) : null,
				most_recent_status: normalizeVerdataStatus(mostRecentBankruptcy?.status)
			};
		}
	},
	liens: {
		description: "Liens associated to this business",
		equifax: async (_, efx: EquifaxCombined): Promise<undefined | Lien> => {
			const earlyReturn = checkEquifaxStatus<Lien>(efx.efxbma_pubrec_status_fi, {
				count: 0,
				most_recent: null,
				most_recent_status: null,
				most_recent_amount: null,
				total_open_lien_amount: null
			});
			if (earlyReturn !== null) return earlyReturn;

			const totalOpenLienAmount = sanitizeNumericString(efx.efxbma_pubrec_total_cur_liab_lien);

			return {
				count: efx.efxbma_pubrec_status_fi,
				most_recent: convertAgeToDate(efx.efxbma_pubrec_age_lien, efx.efxbma_extract_date, efx.extract_month),
				most_recent_status: "active",
				most_recent_amount: null,
				total_open_lien_amount: totalOpenLienAmount === 999999999 ? null : totalOpenLienAmount
			};
		},
		verdataRaw: async function (this: Fact, engine: FactEngine, verdata: VerdataRecord): Promise<undefined | Lien> {
			this.confidence = preferVerdata(engine);

			const bljArray: BLJ[] | null = prepareVerdataBLJ(verdata);
			if (!bljArray) return;

			// Check if summary has possible liens
			const hasLiens = bljArray.some(blj =>
				hasPossibleRecords<Lien>(blj, [
					"summary.lien_debtor_count",
					"summary.lien_holder_count",
					"liens[0].filing_date"
				])
			);
			if (!hasLiens) return;

			const allLiens = bljArray.flatMap(b => b.liens).filter(l => "filing_date" in l);
			const mostRecentLien = findMostRecentRecord<VerdataLien>(allLiens, "filing_date");

			return {
				count: allLiens.length,
				most_recent: mostRecentLien?.filing_date ? new Date(mostRecentLien.filing_date) : null,
				most_recent_status: normalizeVerdataStatus(mostRecentLien?.status),
				most_recent_amount: mostRecentLien?.lien_amount ?? null,
				total_open_lien_amount: calculateTotalActiveAmount(allLiens, "lien_amount")
			};
		}
	},
	judgements: {
		description: "Judgements associated to this business",
		equifax: async (_, efx: EquifaxCombined): Promise<undefined | Judgement> => {
			const earlyReturn = checkEquifaxStatus<Judgement>(efx.efxbma_pubrec_status_ju, {
				count: 0,
				most_recent: null,
				most_recent_status: null,
				most_recent_amount: null,
				total_judgement_amount: null
			});
			if (earlyReturn !== null) return earlyReturn;

			const totalJudgementAmount = sanitizeNumericString(efx.efxbma_pubrec_total_cur_liab_judg);
			return {
				count: efx.efxbma_pubrec_status_ju,
				most_recent: convertAgeToDate(efx.efxbma_pubrec_age_judg, efx.efxbma_extract_date, efx.extract_month),
				most_recent_status: "unknown",
				most_recent_amount: null,
				total_judgement_amount: totalJudgementAmount === 999999999 ? null : totalJudgementAmount
			};
		},
		verdataRaw: async function (
			this: Fact,
			engine: FactEngine,
			verdata: VerdataRecord
		): Promise<undefined | Judgement> {
			this.confidence = preferVerdata(engine);

			const bljArray: BLJ[] | null = prepareVerdataBLJ(verdata);
			if (!bljArray) return;

			// Check if summary has possible judgements
			const hasJudgements = bljArray.some(blj =>
				hasPossibleRecords(blj, [
					"summary.judgement_creditor_count",
					"summary.judgement_debtor_count",
					"judgements[0].filing_date"
				])
			);
			if (!hasJudgements) return;

			const allJudgements = bljArray.flatMap(b => b.judgements);
			const totalJudgements = allJudgements.reduce((acc, curr) => acc + (curr.amount_awarded ?? 0), 0);
			const mostRecentJudgement = findMostRecentRecord<VerdataJudgement>(allJudgements, "filing_date");

			return {
				count: allJudgements.length,
				most_recent: mostRecentJudgement?.filing_date ? new Date(mostRecentJudgement.filing_date) : null,
				most_recent_status: normalizeVerdataStatus(mostRecentJudgement?.status),
				most_recent_amount: mostRecentJudgement?.amount_awarded ?? null,
				total_judgement_amount: totalJudgements
			};
		}
	}
};

export const bjlFacts: Fact[] = simpleFactToFacts(simpleBJLFacts, sources);
