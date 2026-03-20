import { envConfig } from "#configs/index";
import { logger } from "#helpers";
import { CognitoJwtVerifier } from "aws-jwt-verify";

class Cognito {
	constructor() {
		this.userIdVerifier = null;
		this.userAccessVerifier = null;
		this.isUserVerifierInitialized = false;
		this.appIdVerifier = null;
		this.appAccessVerifier = null;
		this.isAppVerifierInitialized = false;
	}

	initializeUserVerifiers() {
		if (!envConfig.APPLICANT_USER_POOL_ID || !envConfig.WORTH_ADMIN_USER_POOL_ID || !envConfig.CUSTOMER_USER_POOL_ID) {
			logger.warn("Cognito verifier environment variables not found, skipping verifier initialization");
			return;
		}

		try {
			this.userAccessVerifier = CognitoJwtVerifier.create([
				{
					userPoolId: envConfig.APPLICANT_USER_POOL_ID,
					clientId: envConfig.APPLICANT_CLIENT_ID,
					tokenUse: "access"
				},
				{
					userPoolId: envConfig.WORTH_ADMIN_USER_POOL_ID,
					clientId: envConfig.WORTH_ADMIN_CLIENT_ID,
					tokenUse: "access"
				},
				{
					userPoolId: envConfig.CUSTOMER_USER_POOL_ID,
					clientId: envConfig.CUSTOMER_CLIENT_ID,
					tokenUse: "access"
				}
			]);

			this.userIdVerifier = CognitoJwtVerifier.create([
				{
					userPoolId: envConfig.APPLICANT_USER_POOL_ID,
					clientId: envConfig.APPLICANT_CLIENT_ID,
					tokenUse: "id"
				},
				{
					userPoolId: envConfig.WORTH_ADMIN_USER_POOL_ID,
					clientId: envConfig.WORTH_ADMIN_CLIENT_ID,
					tokenUse: "id"
				},
				{
					userPoolId: envConfig.CUSTOMER_USER_POOL_ID,
					clientId: envConfig.CUSTOMER_CLIENT_ID,
					tokenUse: "id"
				}
			]);

			this.isUserVerifierInitialized = true;
		} catch (error) {
			logger.error({ error }, "Failed to initialize Cognito verifiers");
		}
	}

	async verifyCognitoToken(token, tokenUse) {
		try {
			if (!this.userIdVerifier) {
				this.initializeUserVerifiers();
			}
			if (!this.isUserVerifierInitialized) {
				throw new Error("Cognito verifiers not initialized - check environment variables");
			}

			const verifier = tokenUse === "access" ? this.userAccessVerifier : this.userIdVerifier;
			if (!verifier) {
				throw new Error(`No verifier available for token use: ${tokenUse}`);
			}

			const decodedToken = await verifier.verify(token);
			return decodedToken;
		} catch (error) {
			throw error;
		}
	}

	initializeAppVerifiers() {
		if (!envConfig.AWS_APP_CLIENT_ID) {
			logger.warn("Cognito app verifier environment variables not found, skipping verifier initialization");
			return;
		}

		try {
			this.appAccessVerifier = CognitoJwtVerifier.create([
				{
					clientId: envConfig.AWS_APP_CLIENT_ID,
					tokenUse: "access"
				}
			]);

			this.appIdVerifier = CognitoJwtVerifier.create([
				{
					clientId: envConfig.AWS_APP_CLIENT_ID,
					tokenUse: "id"
				}
			]);

			this.isAppVerifierInitialized = true;
		} catch (error) {
			logger.error({ error }, "Failed to initialize Cognito app verifiers");
		}
	}

	async verifyAppCognitoToken(token, tokenUse) {
		try {
			if (!this.appIdVerifier) {
				this.initializeAppVerifiers();
			}
			if (!this.isAppVerifierInitialized) {
				throw new Error("Cognito app verifiers not initialized - check environment variables");
			}

			const verifier = tokenUse === "access" ? this.appAccessVerifier : this.appIdVerifier;
			if (!verifier) {
				throw new Error(`No app verifier available for token use: ${tokenUse}`);
			}

			const decodedToken = await verifier.verify(token);
			return decodedToken;
		} catch (error) {
			throw error;
		}
	}
}

export const cognito = new Cognito();
