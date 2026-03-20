import {
	INTEGRATION_CATEGORIES,
	INTEGRATION_ID,
	type IntegrationCategoryId,
	type IntegrationPlatformId,
	type TaskCode
} from "#constants/integrations.constant";
import type { TaskType } from "#helpers/integrationsCompletionTracker";
import type { IBusinessIntegrationTaskEnriched } from "#types";

// Flexible task type that can handle both integration tasks and KYB tasks
export type TaskMap = Record<IntegrationCategoryId, Array<IBusinessIntegrationTaskEnriched<any>>>;

// Integration categories mapping using PROCESS_TYPE constants
type CategoryCompletionRequirements =
	| Record<TaskCode, Array<IntegrationPlatformId | "*">>
	| { isComplete?: (tasks: IBusinessIntegrationTaskEnriched<any>[]) => boolean };
export type ProcessCompletionPlatformMapping = Partial<
	Record<IntegrationCategoryId, Partial<CategoryCompletionRequirements>>
>;

export const PLATFORM_PROCESS_MAPPING: ProcessCompletionPlatformMapping = {
	[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: {
		fetch_public_records: [
			INTEGRATION_ID.VERDATA,
			INTEGRATION_ID.EQUIFAX,
			INTEGRATION_ID.SERP_SCRAPE,
			INTEGRATION_ID.GOOGLE_BUSINESS_REVIEWS
		],
		fetch_adverse_media: [INTEGRATION_ID.ADVERSE_MEDIA]
	},
	[INTEGRATION_CATEGORIES.BUREAU]: {
		fetch_bureau_score_owners: [INTEGRATION_ID.EQUIFAX],
		fetch_public_records: [INTEGRATION_ID.EQUIFAX]
	},
	[INTEGRATION_CATEGORIES.VERIFICATION]: {
		fetch_identity_verification: [INTEGRATION_ID.PLAID_IDV],
		fetch_healthcare_provider_verification: [INTEGRATION_ID.NPI]
	},
	[INTEGRATION_CATEGORIES.BANKING]: {
		fetch_assets_data: ["*"]
	},
	[INTEGRATION_CATEGORIES.ACCOUNTING]: {
		fetch_accounting_records: ["*"],
		fetch_accounting_business_info: ["*"],
		fetch_balance_sheet: ["*"],
		fetch_profit_and_loss_statement: ["*"],
		fetch_cash_flow: ["*"],
		fetch_accounting_accounts: ["*"]
	},
	[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION]: {
		fetch_business_entity_verification: [
			INTEGRATION_ID.CANADA_OPEN,
			INTEGRATION_ID.ZOOMINFO,
			INTEGRATION_ID.OPENCORPORATES,
			INTEGRATION_ID.MIDDESK,
			INTEGRATION_ID.MATCH,
			INTEGRATION_ID.TRULIOO,
			INTEGRATION_ID.BASELAYER
		],
		fetch_public_records: [INTEGRATION_ID.EQUIFAX, INTEGRATION_ID.VERDATA],
		fetch_worth_business_entity_website_details: [INTEGRATION_ID.WORTH_WEBSITE_SCANNING]
	}
};
// Types for completion tracking
interface ProcessCompletionDetails {
	completed: number;
	total: number;
	failed: number;
	taskTypes: TaskType[];
}
export interface ProcessCompletionResult {
	isComplete: boolean;
	percentage: number;
	timestamp: string;
	details: ProcessCompletionDetails;
	completion?: Partial<Record<IntegrationCategoryId | "all", ProcessCompletionDetails>>;
}
