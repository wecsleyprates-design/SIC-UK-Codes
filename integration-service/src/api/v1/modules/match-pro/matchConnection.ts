import { secretsManagerService } from "#api/v1/modules/secrets/secrets";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { envConfig } from "#configs";
import { ERROR_CODES } from "#constants/error-codes.constant";
import { logger } from "#helpers";
import { CertificateMetadata } from "#lib/fileHandler";
import { ExtractPrivateKeyFileHandler } from "#lib/fileHandler/ExtractPrivateKeyFileHandler";
import {
	Secrets,
	connectionStatus,
	connectionResult,
	ResponseBody,
	ICAInput,
	ICAObject,
	TerminationInquiryResponse,
	MatchErrorResponse
} from "#lib/match/types";
import { checkHTMLTag, removeHTMLTags } from "#utils";
import axios from "axios";
import { StatusCodes } from "http-status-codes";
import oauth from "mastercard-oauth1-signer";
import { isObject } from "util";
import { ErrorMatchResponse } from "./error";
import { parseICAs } from "./utils";

class MatchConnection {
	/**
	 * Create Sign from Mastercard Match
	 */
	static createAuthorizationHeader(url: string, method: string, body: string, customerCredentials: Secrets) {
		const authHeader = oauth.getAuthorizationHeader(
			url,
			method,
			body,
			customerCredentials.consumerKey,
			customerCredentials.privateKey
		);
		return authHeader;
	}

	/**
	 * Make Axios request
	 */
	static async createRequestAxios(bodyParse: string, url: string, method: string, authHeader: string) {
		const axiosConfig = <any>{
			method,
			url: url,
			headers: {
				Authorization: authHeader,
				"Content-Type": "application/json",
				Accept: "application/json",
				"User-Agent": "MastercardMatchClient/3.0"
			},
			timeout: 30000, // 30 seconds timeout
			validateStatus: null // Don't throw on any status code
		};

		// Add body data for POST/PUT requests
		axiosConfig.data = bodyParse;

		return await axios(axiosConfig);
	}

	/**
	 * Get Customer Keys from AWS Secrets
	 */
	public async getCustomerCredentials(customerId: string): Promise<Secrets | null> {
		// Connect to AWS Secrets and retrieve Keys
		try {
			const secrets = await secretsManagerService.getSecret(customerId);
			if (secrets?.storage_data) {
				const { storage_data } = secrets;
				let parsedSecrets: Secrets;
				try {
					parsedSecrets = JSON.parse(storage_data);
				} catch (err) {
					logger.error({ error: err, customerId }, "getCustomerCredentials: Failed to parse secrets JSON");
					return null;
				}

				if (typeof parsedSecrets.icas === "string") {
					parsedSecrets.icas = parseICAs(parsedSecrets.icas);
				}

				// Migration: if icas is missing or empty, use acquirerId if available
				if ((!parsedSecrets.icas || parsedSecrets.icas.length === 0) && parsedSecrets.acquirerId) {
					parsedSecrets.icas = [{ ica: parsedSecrets.acquirerId, isDefault: true }];
				}

				return parsedSecrets;
			}
			return null;
		} catch (error) {
			logger.warn({ error, customerId }, "getCustomerCredentials: Failed to retrieve secrets for customer");
			return null;
		}
	}

	/**
	 * Create request to Match
	 */
	public async makeAuthenticatedRequest(
		task: { id: string },
		body: string,
		customerCredentials: Secrets
	): Promise<TerminationInquiryResponse | MatchErrorResponse | false> {
		try {
			const url = this.getMatchUrl();
			const method = "post";

			if (!url) {
				logger.error({ taskId: task.id }, "makeAuthenticatedRequest: The Match URL is not configured");
				return false;
			}
			// Generate OAuth authorization header
			const authHeader = MatchConnection.createAuthorizationHeader(url, method, body, customerCredentials);

			// Make request
			const response = await MatchConnection.createRequestAxios(body, url, method, authHeader);

			// Check if the response has HTML structure
			if (!isObject(response.data) && checkHTMLTag(response.data)) {
				const error = new ErrorMatchResponse("HTML", removeHTMLTags(response.data));
				return error.toJSON();
			}
			// Handle all responses
			return response.data;
		} catch (error) {
			logger.error({ error, taskId: task.id }, "makeAuthenticatedRequest: The API Mastercard authorization failed");
			const errorMsj = new ErrorMatchResponse("AUTHENTICATION", "The API Mastercard authorization failed");
			return errorMsj.toJSON();
		}
	}

	/**
	 * Check connection status to Mastercard Match API
	 * @param customerId - The customer ID to check connection for
	 * @returns Promise<connectionResult> - Connection status with details
	 */
	public async checkConnection(customerId: string): Promise<connectionResult> {
		try {
			// Get customer credentials
			let customerCredentials: Secrets | null = null;
			try {
				customerCredentials = await this.getCustomerCredentials(customerId);
				logger.info(`checkConnection: Retrieved credentials for customer ${customerId}`);
			} catch (error) {
				logger.error(error, "checkConnection: Failed to retrieve credentials");
				return {
					status: connectionStatus.ERROR,
					message: "Failed to retrieve customer credentials",
					details: { error: error instanceof Error ? error.message : String(error) }
				};
			}

			if (!customerCredentials) {
				logger.warn(`checkConnection: No credentials found for customer ${customerId}`);
				return {
					status: connectionStatus.NOT_CONNECTED,
					message: "Match Pro is not configured",
					details: {
						error: "No credentials found",
						isActive: false
					}
				};
			}

			// Get expiry date
			const expiryDate = customerCredentials?.metadata?.validity?.notAfter;
			// Check certificate expiration first
			const isExpired = this.checkExpiredDate(customerCredentials);

			if (!customerCredentials.isActive) {
				logger.warn(`checkConnection: Customer ${customerId} is not active`);
				return {
					status: connectionStatus.NOT_CONNECTED,
					message: "Customer does not have Match Pro active",
					details: {
						error: "Customer does not have Match Pro active",
						isActive: customerCredentials.isActive,
						expiresAt: expiryDate?.toString(),
						certificateExpiry: expiryDate?.toString()
					}
				};
			}

			if (isExpired) {
				logger.warn(`checkConnection: Certificate expired, expiry=${expiryDate}`);
				return {
					status: connectionStatus.EXPIRED,
					message: "Certificate has expired",
					details: {
						expiresAt: expiryDate?.toString(),
						certificateExpiry: expiryDate?.toString(),
						isActive: customerCredentials.isActive
					}
				};
			}

			const url = this.getMatchUrl();
			if (!url) {
				logger.error("checkConnection: CONFIG MATCH URL is not configured");
				return {
					status: connectionStatus.ERROR,
					message: "Match API URL not configured",
					details: {
						error: "CONFIG MATCH URL is not configured",
						isActive: customerCredentials.isActive
					}
				};
			}

			const method = "post";
			const icas =
				customerCredentials.icas ?? (customerCredentials.acquirerId ? parseICAs(customerCredentials.acquirerId) : []);
			const bodyMock = JSON.stringify(this.mockPayloadSandbox(icas));

			// Generate OAuth authorization header
			let authHeader: string;
			try {
				authHeader = MatchConnection.createAuthorizationHeader(url, method, bodyMock, customerCredentials);
			} catch (error) {
				logger.error({ error }, "checkConnection: Failed to create authorization header");
				return {
					status: connectionStatus.ERROR,
					message: "Failed to generate authentication header",
					details: {
						error: error instanceof Error ? error.message : String(error),
						isActive: customerCredentials.isActive
					}
				};
			}

			// Make request to Match API
			let response;
			try {
				response = await MatchConnection.createRequestAxios(bodyMock, url, method, authHeader);
			} catch (error) {
				logger.error({ error }, "checkConnection: API request failed");
				return {
					status: connectionStatus.ERROR,
					message: "Failed to connect to Match API",
					details: {
						error: error instanceof Error ? error.message : String(error),
						isActive: customerCredentials.isActive
					}
				};
			}

			// Analyze response status
			if (response.status >= 200 && response.status < 300) {
				logger.info({ statusCode: response.status }, "checkConnection: Successful connection");
				return {
					status: connectionStatus.CONNECTED,
					message: "Successfully connected to Match API",
					details: {
						statusCode: response.status,
						expiresAt: expiryDate?.toString(),
						isActive: customerCredentials.isActive
					}
				};
			} else if (response.status === StatusCodes.BAD_REQUEST) {
				// Business validation errors (400) indicate the connection and auth worked
				logger.info({ statusCode: response.status }, "checkConnection: Connected (with business validation error)");
				return {
					status: connectionStatus.CONNECTED,
					message: "Successfully connected to Match API",
					details: {
						statusCode: response.status,
						expiresAt: expiryDate?.toString(),
						isActive: customerCredentials.isActive,
						error: response.data ? JSON.stringify(response.data) : "Business validation error"
					}
				};
			} else if (response.status === StatusCodes.UNAUTHORIZED || response.status === StatusCodes.FORBIDDEN) {
				logger.warn({ statusCode: response.status }, "checkConnection: Authentication failed");
				return {
					status: connectionStatus.NOT_CONNECTED,
					message: "Authentication failed - invalid credentials or unauthorized access",
					details: {
						statusCode: response.status,
						expiresAt: expiryDate?.toString(),
						error: response.data ? JSON.stringify(response.data) : "No error details available",
						isActive: customerCredentials.isActive
					}
				};
			} else {
				logger.error({ statusCode: response.status }, "checkConnection: Unexpected response");
				return {
					status: connectionStatus.ERROR,
					message: "Unexpected response from Match API",
					details: {
						statusCode: response.status,
						error: response.data ? JSON.stringify(response.data) : "Unexpected server response",
						isActive: customerCredentials.isActive
					}
				};
			}
		} catch (error) {
			logger.error({ error }, "checkConnection: Unexpected error");
			return {
				status: connectionStatus.ERROR,
				message: "Unexpected error occurred during connection check",
				details: { error: error instanceof Error ? error.message : String(error) }
			};
		}
	}

	/**
	 * Normalizes ICAs by parsing from comma-separated string if needed
	 * @param icas - Array of ICA objects or comma-separated string
	 * @returns Normalized array of ICA objects
	 */

	private normalizeICAs(icas: Array<ICAInput> | string | undefined): Array<ICAObject> {
		const rawICAs = parseICAs(icas);

		return rawICAs
			.map(item => ({
				ica: item.ica.trim(),
				isDefault: Boolean(item.isDefault)
			}))
			.filter(item => item.ica.length > 0);
	}

	/**
	 * Builds a properly structured secrets data object for storage
	 * @param privateKey - The extracted private key
	 * @param body - The request body containing credential information
	 * @returns JSON stringified secrets data
	 */
	public buildSecretsData(privateKey: string | null, metadata: CertificateMetadata | null, body: ResponseBody) {
		const isActive = body.isActive;

		// Normalize ICAs first (handles both string and array inputs from FormData)
		const normalizedICAs = this.normalizeICAs(body.icas);

		// Validate required fields only when isActive is true
		if (isActive) {
			if (!privateKey) {
				throw new Error("Private key is required when isActive is true");
			}

			if (!body.customerName || !body.consumerKey || normalizedICAs.length === 0) {
				throw new Error(
					"Missing required credential fields: customerName, consumerKey, or ICA values when isActive is true"
				);
			}
		}

		const secretsData = {
			customerName: body.customerName?.trim() || "",
			icas: normalizedICAs,
			consumerKey: body.consumerKey?.trim() || "",
			privateKey: privateKey?.trim() || "",
			keyPassword: body.keyPassword || "",
			isActive: isActive,
			metadata: metadata || null
		};

		return JSON.stringify(secretsData);
	}

	/**
	 * Filters sensitive data from secret response, specifically excluding privateKey
	 * @param secretData - The secret data object (can be stringified or parsed)
	 * @returns Filtered object without privateKey
	 */
	public filterSecretResponse(secretData: any) {
		if (!secretData) {
			return null;
		}

		let parsedData = { ...secretData };

		// If secretData has storage_data string, parse it
		if (typeof secretData.storage_data === "string") {
			try {
				const storageData = JSON.parse(secretData.storage_data);
				parsedData = {
					...secretData,
					storage_data: storageData
				};
			} catch (error) {
				// If parsing fails, log warning and return original data
				return secretData;
			}
		}

		// Remove privateKey from storage_data if it exists
		if (parsedData.storage_data && typeof parsedData.storage_data === "object") {
			const { arn, version, accessedAt, operation, ...filteredData } = parsedData;
			const { privateKey, keyPassword, metadata, isActive, ...filteredStorageData } = parsedData.storage_data;
			return {
				...filteredData,
				storage_data: {
					...filteredStorageData,
					isActive: this.toBoolean(isActive)
				}
			};
		}

		return parsedData;
	}

	public extractPrivateKeyFromKeyFile(keyFile: Express.Multer.File, keyPassword: string) {
		const privateKey = ExtractPrivateKeyFileHandler.loadPrivateKey(keyFile, keyPassword);
		const metadata = ExtractPrivateKeyFileHandler.extractCertificateMetadata(keyFile, keyPassword);
		if (!privateKey) {
			throw new VerificationApiError("Private key not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return { privateKey, metadata };
	}

	private checkExpiredDate(customerCredentials: Secrets) {
		try {
			const notAfter = customerCredentials?.metadata?.validity?.notAfter;
			if (!notAfter) {
				return false;
			}

			const currentDate = new Date();
			const expiredDate = new Date(notAfter);

			// Handle Invalid Date
			if (isNaN(expiredDate.getTime())) {
				logger.warn(
					{ customerId: customerCredentials.customerId },
					"checkExpiredDate: Invalid expiration date found in metadata"
				);
				return false;
			}

			return currentDate > expiredDate;
		} catch (error) {
			logger.error(error, "checkExpiredDate: Error checking certificate expiration");
			return false;
		}
	}

	private getMatchUrl(): string {
		switch (envConfig.MATCH_ENV?.toLowerCase()) {
			case "production":
				return envConfig.MATCH_PRODUCTION_URL || "";
			case "mtf":
				return envConfig.MATCH_MTF_URL || envConfig.MATCH_SANDBOX_URL || "";
			default:
				return envConfig.MATCH_SANDBOX_URL || "";
		}
	}

	private toBoolean(value) {
		if (typeof value === "string") {
			return value.toLowerCase() === "true";
		}
		return Boolean(value); // fallback for numbers, objects, etc.
	}

	/**
	 * Gets the first (default) ICA from the array for API requests
	 * Handles both new string array format and legacy object format for backwards compatibility
	 * @param icas - Array of ICAs, comma-separated string, or legacy array of ICA objects
	 * @returns First ICA (the default), or empty string if none
	 */
	public getDefaultICA(icas: Array<ICAInput> | string | undefined): string {
		const normalizedICAs = parseICAs(icas);

		if (normalizedICAs.length === 0) {
			return "";
		}

		// Find the one marked as default, or fallback to the first one
		const defaultItem = normalizedICAs.find(item => item.isDefault) || normalizedICAs[0];
		return defaultItem.ica;
	}

	private mockPayloadSandbox(icas: Array<ICAInput>) {
		// Use the first ICA (default) for connection testing
		const acquirerId = this.getDefaultICA(icas);
		return {
			terminationInquiryRequest: {
				acquirerId,
				merchant: {
					name: "THE BAIT SHOP",
					doingBusinessAsName: "BAIT R US",
					merchantId: "ABED-1234",
					subMerchantId: "ABED-1234-1",
					address: {
						addressLineOne: "42 ELM AVENUE",
						addressLineTwo: "SUITE 201",
						city: "CHICAGO",
						isOtherCity: "N",
						countrySubdivision: "IL",
						country: "USA",
						postalCode: "66579"
					},
					phoneNumber: "3165557625",
					altPhoneNumber: "3165557625",
					merchantCategory: "0742",
					nationalTaxId: "",
					countrySubdivisionTaxId: "",
					urls: ["www.merchant.com"],
					principals: [
						{
							firstName: "DAVID",
							middleInitial: "P",
							lastName: "SMITH",
							address: {
								addressLineOne: "42 ELM AVENUE",
								addressLineTwo: "SUITE 201",
								city: "CHICAGO",
								isOtherCity: "N",
								countrySubdivision: "IL",
								postalCode: "66579",
								country: "USA"
							},
							phoneNumber: "3165557625",
							altPhoneNumber: "3165557625",
							email: "Abc@xxx.com",
							driversLicense: {
								number: "",
								countrySubdivision: "",
								country: ""
							},
							dateOfBirth: "2021-07-14",
							nationalId: ""
						}
					],
					searchCriteria: {
						minPossibleMatchCount: "3"
					}
				}
			}
		};
	}
}

export const matchConnection = new MatchConnection();
