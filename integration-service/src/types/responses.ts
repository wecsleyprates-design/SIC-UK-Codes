import type { Bankruptcy, Judgement, Lien } from "#lib/facts/bjl/types";

export interface BusinessBJLResponse {
	num_liens: {
		name: "num_liens";
		value: number | null;
		alternatives: Array<{
			value: number | null;
			source: number;
			confidence: number;
		}>;
	};
	num_judgements: {
		name: "num_judgements";
		value: number | null;
		alternatives: Array<{
			value: number | null;
			source: number;
			confidence: number;
		}>;
	};
	num_bankruptcies: {
		name: "num_bankruptcies";
		value: number | null;
		alternatives: Array<{
			value: number | null;
			source: number;
			confidence: number;
		}>;
	};
	bankruptcies: {
		name: "bankruptcies";
		value: Bankruptcy | null;
		alternatives: Array<{
			value: Bankruptcy | null;
			source: number;
			confidence: number;
		}>;
	};
	liens: {
		name: "liens";
		value: Lien | null;
		alternatives: Array<{
			value: Lien | null;
			source: number;
			confidence: number;
		}>;
	};
	judgements: {
		name: "judgements";
		value: Judgement | null;
		alternatives: Array<{
			value: Judgement | null;
			source: number;
			confidence: number;
		}>;
	};
}
