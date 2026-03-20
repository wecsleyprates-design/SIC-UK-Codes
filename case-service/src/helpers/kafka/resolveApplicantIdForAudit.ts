import { UUID } from "@joinworth/types/dist/utils/utilityTypes";

/**
 * Resolves the correct applicant ID for audit messages.
 *
 * When an application edit is submitted by a guest owner, we need to use the applicant ID
 * of the user who initiated the application edit, not the guest owner's user ID.
 *
 * @param params - Parameters for resolving the applicant ID
 * @param params.userInfo - User information from the request
 * @param params.cachedApplicationEditInvite - Optional cached application edit invite data
 * @returns The resolved applicant ID to use in audit messages
 *
 * @example
 * const cachedInvite = await caseManager.getCachedApplicationEditInvite(caseId, customerId);
 * const applicantId = resolveApplicantIdForAudit({
 *   userInfo,
 *   cachedApplicationEditInvite: cachedInvite
 * });
 */
export function resolveApplicantIdForAudit(params: {
	userInfo: {
		user_id: string | UUID;
		is_guest_owner?: boolean;
		issued_for?: { user_id?: string | UUID } | null;
	};
	cachedApplicationEditInvite?: { applicantID: string | UUID } | null;
}): string | UUID | undefined {
	const { userInfo, cachedApplicationEditInvite } = params;

	/**
	 * Use the applicant ID from the cached application edit invite if:
	 * 1. The invite exists (the getCachedApplicationEditInvite function returned something)
	 * 2. The current user is a guest owner
	 *
	 * This ensures audit messages reflect the actual user who initiated the application edit
	 * and not the temporary guest owner user.
	 *
	 * i.e. We want the audit messages to read something like this:
	 * "Case for Stemma Craft Coffee has been updated by DJ Johnson."
	 *
	 * NOT:
	 * "Case for Stemma Craft Coffee has been updated by Guest Owner."
	 */
	if (cachedApplicationEditInvite && userInfo.is_guest_owner) return cachedApplicationEditInvite.applicantID;

	if (userInfo.is_guest_owner) return userInfo.issued_for?.user_id;

	return userInfo.user_id;
}
