import { envConfig } from "#configs";
import { OAuth2Client } from "google-auth-library";

class OAuthClient {
	private client: OAuth2Client;

	constructor() {
		this.client = new OAuth2Client(envConfig.GOOGLE_BUSINESS_CLIENT_ID, envConfig.GOOGLE_BUSINESS_CLIENT_SECRET, envConfig.GOOGLE_BUSINESS_REDIRECT_URI);
	}

	getAuthUrl() {
		return this.client.generateAuthUrl({
			access_type: "offline",
			scope: ["https://www.googleapis.com/auth/userinfo.profile"]
		});
	}

	generateBusinessConsentUrl() {
		// Google My Business API scopes
		const scopes = ["https://www.googleapis.com/auth/business.manage"];
		return this.client.generateAuthUrl({
			access_type: "offline", // Request refresh token for longer access
			scope: scopes,
			prompt: "consent" // Force user to see consent screen
		});
	}

	async getGoogleAccountFromCode(code: string) {
		const { tokens } = await this.client.getToken(code);
		this.client.setCredentials(tokens);
		// const { data } = await google.oauth2({ version: "v2", auth: this.client }).userinfo.get();
		return tokens;
	}

	async refreshTokens(refreshToken: string) {
		this.client.setCredentials({ refresh_token: refreshToken });
		const tokens = await this.client.refreshAccessToken();
		this.client.setCredentials(tokens?.res?.data);
		return tokens;
	}

	async getOAuthTokens(code: string) {
		const tokens = await this.client.getToken(code);
		this.client.setCredentials(tokens.tokens);
		return tokens;
	}

	getClient() {
    const client = this.client;
		return client;
	}
}

export const oauthClient = new OAuthClient();