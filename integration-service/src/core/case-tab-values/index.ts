/**
 * Case tab values domain: existing values for the 18 decisioning/onboarding result properties.
 * @see cursor/feature_docs/decisioning-results-on-case/02-case-tab-values-single-endpoint-architecture.md
 */

export * from "./types";
export * from "./caseTabValuesRepository";
export {
	getCaseTabValues,
	recordCaseResultsExecutionCompleted,
	type GetCaseTabValuesParams,
} from "./caseTabValuesManager";
export { toApiResponse } from "./mappers";
