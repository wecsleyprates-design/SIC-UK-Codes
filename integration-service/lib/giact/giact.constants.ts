/**
 * GIACT API Constants
 * Shared constants for GIACT API endpoints and configuration
 */

export const GIACT_API_PATHS = {
	/**
	 * GIACT API endpoint for verification services
	 * Used by both production and sandbox strategies
	 */
	VERIFICATION_SERVICES: "/verificationservices/web_api/inquiries_v5_9"
} as const;

export const GIACT_SERVICE_FLAGS = {
	VERIFY: "verify",
	AUTHENTICATE: "authenticate"
} as const;
