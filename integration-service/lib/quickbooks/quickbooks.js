import { envConfig } from "#configs/index";
const OAuthClient = require("intuit-oauth");

export const quickBooksConfigurations = {
	clientId: envConfig.QUICKBOOKS_CLIENT_ID,
	clientSecret: envConfig.QUICKBOOKS_SECRET,
	environment: envConfig.QUICKBOOKS_ENVIRONMENT,
	redirectUri: envConfig.QUICKBOOKS_REDIRECT_URI
};

class Quickbooks {
	constructor() {
		this.quicbooksOAuthClient = new OAuthClient(quickBooksConfigurations);
	}

	async authorizeUri() {
		try {
			const authorizationUrl = await this.quicbooksOAuthClient.authorizeUri({
				scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId]
			});

			return authorizationUrl;
		} catch (error) {
			throw error;
		}
	}

	async getToken(url) {
		try {
			const token = await this.quicbooksOAuthClient.createToken(url);

			return token;
		} catch (error) {
			throw error;
		}
	}
}

export const quickBooks = new Quickbooks();
