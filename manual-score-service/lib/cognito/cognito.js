import { envConfig } from "#configs/index";
import { CognitoJwtVerifier } from "aws-jwt-verify";

class Cognito {
	async verifyCognitoToken(token, tokenUse) {
		try {
			const verifier = CognitoJwtVerifier.create([
				{
					userPoolId: envConfig.APPLICANT_USER_POOL_ID,
					clientId: envConfig.APPLICANT_CLIENT_ID,
					tokenUse
				},
				{
					userPoolId: envConfig.WORTH_ADMIN_USER_POOL_ID,
					clientId: envConfig.WORTH_ADMIN_CLIENT_ID,
					tokenUse
				},
				{
					userPoolId: envConfig.CUSTOMER_USER_POOL_ID,
					clientId: envConfig.CUSTOMER_CLIENT_ID,
					tokenUse
				}
			]);

			const decodedToken = await verifier.verify(token);

			return decodedToken;
		} catch (error) {
			throw error;
		}
	}
}

export const cognito = new Cognito();
