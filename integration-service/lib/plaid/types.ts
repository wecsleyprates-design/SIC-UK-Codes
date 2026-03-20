import type { BankingTaskAction } from "#api/v1/modules/banking/types";
import type { IdvStatus, TaskStatus } from "#constants";
import type { TDateISO } from "#types/datetime";
import { IIdentityVerification } from "#types/db";
import type { UUID } from "crypto";
import { AssetReportCreateResponse } from "plaid";

interface IdentityVerificationWebhook {
	webhook_type: "IDENTITY_VERIFICATION";
	webhook_code: "STATUS_UPDATED";
	identity_verification_id: string;
	environment: "production" | "sandbox" | "development";
}

export namespace IPlaidIDV {
	/**
	 * Represents a document from Plaid's documentary_verification.documents array
	 * @see https://plaid.com/docs/api/products/identity-verification/#identity_verification-list-response-identity-verifications-documentary-verification-documents
	 */
	export interface DocumentaryVerificationDocument {
		status: "success" | "failed" | "manually_approved" | "pending_review" | "pending";
		attempt: number;
		id?: string;
		extracted_data?: {
			category?: string;
			expiration_date?: string;
			issuing_country?: string;
			issuing_region?: string;
		};
		images?: {
			original_front?: string;
			original_back?: string;
			cropped_front?: string;
			cropped_back?: string;
			face?: string;
		};
	}

	export type EnrollApplicantResponse = {
		taskId: UUID;
		taskStatus: TaskStatus;
		previousSuccess?: boolean;
		record?: IIdentityVerification;
	};

	export type ApplicantRiskCheckResult = {
		name?: string;
		address?: {
			summary?: string;
			po_box?: string;
			type?: string;
		};
		dob?: string;
		ssn?: string; // not an actual SSN, but rather the status of the SSN verification
		phone?: {
			summary?: string;
			area_code?: string;
			linked_services?: string[];
		};
		email?: {
			is_deliverable?: string;
			breach_count?: number | null;
			first_breached_at?: string | null;
			last_breached_at?: string | null;
			domain_registered_at?: string | null;
			domain_is_free_provider?: string;
			domain_is_custom?: string;
			domain_is_disposable?: string;
			top_level_domain_is_suspicious?: string;
			linked_services?: string[];
		};
		error?: string;
		user_interactions?: string;
		fraud_ring_detected?: string;
		bot_detected?: string;
		synthetic_identity_risk_score?: number;
		stolen_identity_risk_score?: number;
		steps?: {
			accept_tos?: string;
			verify_sms?: string;
			kyc_check?: string;
			documentary_verification?: string;
			selfie_check?: string;
			watchlist_screening?: string;
			risk_check?: string;
		};
		ip_spam_list_count?: number;
		documents_verification?: string;
	};

	export type IdentityDocument = {
		type?: string;
		status?: string;
		document_id?: string;
		original_front_url?: string | null;
		original_back_url?: string | null;
		extracted_data?: DocumentaryVerificationDocument["extracted_data"];
	};

	export type GetApplicantResponse = {
		applicant: {
			id: UUID;
			status: IdvStatus;
			updated_at: TDateISO;
			risk_check_result: ApplicantRiskCheckResult;
		};
		identity_verification_attempted: boolean;
		documents?: IdentityDocument[];
	};
}

export namespace IPlaid {
	export interface CreateAssetReport {
		access_tokens: string[];
		business_id: string | UUID;
		business_integration_task_id: string | UUID;
		/**
		 * When true, requests the Plaid "Fast Assets" add-on.
		 *
		 * **Fast Assets behavior:**
		 * Plaid generates TWO separate asset reports from this request:
		 * 1. A **fast report**: limited-scope data (typically identity + balances)
		 *    that is available sooner and is intended to unblock onboarding flows.
		 * 2. A **full report**: the complete asset report (including transactions
		 *    and other details) that may take longer for Plaid to prepare.
		 *
		 * **Fast vs full reports:**
		 * - Fast report:
		 *   - Optimized for speed; contains enough information for early decisions
		 *     such as initial risk checks or pre-qualification.
		 *   - Should be treated as **partial / provisional** data.
		 *   - Missing: merchant names, enhanced transaction details, full insights.
		 * - Full report:
		 *   - Contains the full asset dataset and is the **authoritative** source.
		 *   - May arrive minutes after the fast report, depending on the institution.
		 *
		 * **Webhook behavior and ordering:**
		 * - When enabled, Plaid sends separate webhooks for FAST and FULL reports
		 * - Expected order: FAST arrives first, then FULL (institution-dependent)
		 * - Webhook handlers MUST handle:
		 *   - Fast report arriving significantly earlier than full report
		 *   - Both reports arriving with the same business_integration_task_id
		 *   - Full report superseding any provisional data from fast report
		 *
		 * **Processing implications:**
		 * - On fast report: process immediately for quick onboarding decisions
		 * - On full report: if task already SUCCESS (from fast report), skip duplicate processing
		 * - Downstream: ensure full report data is treated as authoritative, replacing fast report data
		 */
		use_fast_assets?: boolean;
	}
	export interface RefreshAssetReport {
		asset_report_token: string;
		business_id: string | UUID;
		business_integration_task_id: string | UUID;
	}
	export interface TaskMeta extends AssetReportCreateResponse {
		requestedDays?: number;
		taskAction?: BankingTaskAction;
	}
}
