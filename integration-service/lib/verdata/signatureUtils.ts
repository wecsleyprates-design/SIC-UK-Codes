import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";
import { createHmacSha256, timingSafeHexCompare } from "#utils/encryption";

interface CallbackPayload {
	business_id: string;
	task_id: string;
}

interface SignedCallbackResult {
	url: string;
	timestamp: number;
	signature: string;
}

interface VerificationResult {
	valid: boolean;
	error?: "MISSING_SIGNATURE" | "INVALID_SIGNATURE" | "SIGNATURE_EXPIRED" | "SIGNATURE_MISMATCH";
}

/**
 * Generate a signed callback URL for Verdata requests.
 * This creates a self-signed signature that we can verify when Verdata calls us back.
 *
 * @param baseUrl - The base webhook URL (e.g., https://api.joinworth.com/integration/api/v1/verdata/webhook)
 * @param payload - The business_id and task_id to include in the signature
 * @returns Object containing the full signed URL, timestamp, and signature
 */
export function generateSignedCallbackUrl(baseUrl: string, payload: CallbackPayload): SignedCallbackResult {
	const secret = envConfig.VERDATA_CALLBACK_SECRET;

	if (!secret) {
		logger.error("VERDATA_CALLBACK_SECRET is not configured");
		throw new Error("VERDATA_CALLBACK_SECRET is required for signing callback URLs");
	}

	const timestamp = Math.floor(Date.now() / 1000);
	const dataToSign = `${payload.business_id}:${payload.task_id}:${timestamp}`;
	const signature = createHmacSha256(dataToSign, secret);

	const url = `${baseUrl}?business_id=${payload.business_id}&task_id=${payload.task_id}&ts=${timestamp}&sig=${signature}`;

	return { url, timestamp, signature };
}

/**
 * Verify a Verdata webhook signature.
 * This validates that the signature in the callback URL matches what we generated.
 *
 * @param business_id - The business ID from the query string
 * @param task_id - The task ID from the query string
 * @param ts - The timestamp from the query string
 * @param sig - The signature from the query string
 * @returns VerificationResult indicating if the signature is valid
 */
export function verifyVerdataSignature(
	business_id: string | undefined,
	task_id: string | undefined,
	ts: string | undefined,
	sig: string | undefined
): VerificationResult {
	const secret = envConfig.VERDATA_CALLBACK_SECRET;

	if (!secret) {
		logger.error("VERDATA_CALLBACK_SECRET is not configured for verification");
		return { valid: false, error: "INVALID_SIGNATURE" };
	}

	if (!sig || !ts) {
		return { valid: false, error: "MISSING_SIGNATURE" };
	}

	if (!business_id || !task_id) {
		return { valid: false, error: "INVALID_SIGNATURE" };
	}

	const timestamp = parseInt(ts, 10);
	if (isNaN(timestamp)) {
		return { valid: false, error: "INVALID_SIGNATURE" };
	}

	const maxAgeSeconds = envConfig.VERDATA_SIGNATURE_MAX_AGE_SECONDS || 3600; // Default: 1 hour
	const now = Math.floor(Date.now() / 1000);

	if (now - timestamp > maxAgeSeconds) {
		logger.warn(
			{
				business_id,
				task_id,
				signature_age: now - timestamp,
				max_age: maxAgeSeconds
			},
			"Verdata webhook signature expired"
		);
		return { valid: false, error: "SIGNATURE_EXPIRED" };
	}

	const dataToSign = `${business_id}:${task_id}:${timestamp}`;
	const expectedSignature = createHmacSha256(dataToSign, secret);

	const valid = timingSafeHexCompare(sig, expectedSignature);
	return {
		valid,
		error: valid ? undefined : "SIGNATURE_MISMATCH"
	};
}
