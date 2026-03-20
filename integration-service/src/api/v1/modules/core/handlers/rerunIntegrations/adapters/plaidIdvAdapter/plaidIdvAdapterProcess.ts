import type { IntegrationProcessFunction } from "../types";
import { logger } from "#helpers/logger";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import type { PlaidIdvMetadata } from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Custom process function for Plaid IDV that enrolls each owner individually.
 *
 * Unlike other integrations that create a single task per integration run,
 * Plaid IDV creates one task per owner/applicant via the enrollApplicant method.
 *
 * This function:
 * 1. Validates that the platform is PlaidIdv
 * 2. Ensures PlaidIdv is properly initialized with connection configuration
 * 3. Enrolls each owner individually via enrollApplicant()
 * 4. Returns the task IDs of the created/processed tasks
 *
 * @returns The task IDs of the created/processed tasks
 * @throws Error if the platform is not PlaidIdv or enrollment fails
 */
export const plaidIdvAdapterProcess: IntegrationProcessFunction<PlaidIdvMetadata> = async params => {
	const { platform, connection_id, business_id, metadata } = params;
	const trace_id = uuidv4();

	/** 1. Validate platform type */
	if (!(platform instanceof PlaidIdv))
		throw new Error(`Expected PlaidIdv platform instance, got ${platform.constructor.name}`);

	/** 2. Validate metadata */
	if (!metadata?.owners || !Array.isArray(metadata.owners) || metadata.owners.length === 0)
		throw new Error(`No valid owners in metadata for Plaid IDV - business ${business_id}`);

	/** 3. Ensure PlaidIdv is initialized with connection configuration */
	const plaidIdv = await platform.initializePlaidIdvConnectionConfiguration();

	logger.info(
		{ trace_id, business_id, connection_id, ownerCount: metadata.owners.length },
		`Starting Plaid IDV enrollment for ${metadata.owners.length} owner(s)`
	);

	let lastTaskId: string | undefined;
	const enrollmentResults: Array<{ ownerId: string; success: boolean; taskId?: string; error?: string }> = [];

	/** 4. Enroll each owner individually */
	for (const owner of metadata.owners) {
		try {
			logger.debug({ trace_id, business_id, ownerId: owner.id }, `Enrolling owner in Plaid IDV`);

			/** 5. Enroll or get existing IDV record - handles checking if info has changed */
			const enrollmentResult = await plaidIdv.enrollApplicantOrGetExistingIdvRecord(owner);

			if (enrollmentResult.previousSuccess)
				logger.info(
					{ trace_id, business_id, ownerId: owner.id, task_id: enrollmentResult.taskId },
					`Owner ${owner.id} has already completed IDV with unchanged information`
				);

			if (enrollmentResult.taskId) lastTaskId = enrollmentResult.taskId;

			enrollmentResults.push({
				ownerId: owner.id,
				success: true,
				taskId: enrollmentResult.taskId
			});

			logger.info(
				{
					trace_id,
					business_id,
					ownerId: owner.id,
					taskId: enrollmentResult.taskId,
					taskStatus: enrollmentResult.taskStatus,
					previousSuccess: enrollmentResult.previousSuccess
				},
				`Owner enrollment result`
			);
		} catch (error) {
			logger.error(
				{ trace_id, business_id, ownerId: owner.id, error },
				`Failed to enroll owner in Plaid IDV: ${error instanceof Error ? error.message : "Unknown error"}`
			);
			enrollmentResults.push({
				ownerId: owner.id,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error"
			});
		}
	}

	/** 7. Check if any enrollment succeeded */
	const successfulEnrollments = enrollmentResults.filter(r => r.success);
	if (successfulEnrollments.length === 0)
		throw new Error(`Failed to enroll any owners for business ${business_id} in Plaid IDV`);

	logger.info(
		{
			trace_id,
			business_id,
			connection_id,
			totalOwners: metadata.owners.length,
			successful: successfulEnrollments.length,
			failed: enrollmentResults.length - successfulEnrollments.length
		},
		`Completed Plaid IDV enrollment`
	);

	return enrollmentResults.map(r => r.taskId as string).filter(Boolean);
};
