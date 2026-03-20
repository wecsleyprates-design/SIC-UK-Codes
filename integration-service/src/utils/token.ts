import { envConfig } from "#configs/index";
import { ERROR_CODES } from "#constants/index";
import { cognito } from "#lib/index";
import { JwkWithKid } from "aws-jwt-verify/jwk";
import { StatusCodes } from "http-status-codes";
import jwt, { JwtPayload } from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";

export const verifyToken = async token => {
	try {
		const decodedToken = await cognito.verifyCognitoToken(token, "id");

		return decodedToken;
	} catch (err) {
		if (err && typeof err == "object") {
			if ((err as any).name === "TokenExpiredError") {
				(err as any).message = "User Session Expired";
			}

			(err as any).status = StatusCodes.UNAUTHORIZED;
			(err as any).errorCode = ERROR_CODES.UNAUTHENTICATED;
		}
		throw err;
	}
};
export const verifyCognitoToken = async token => {
	try {
		const decodedToken = await cognito.verifyAppCognitoToken(token, "id");
		return decodedToken;
	} catch (err) {
		if (err instanceof Error) {
			if (err.name === "TokenExpiredError") {
				err.message = "User Session Expired";
			}
			(err as any).status = StatusCodes.UNAUTHORIZED;
			(err as any).errorCode = ERROR_CODES.UNAUTHENTICATED;
		}
		throw err;
	}
};

export const decodeToken = (token: string, options: jwt.DecodeOptions): JwtPayload => {
	return jwt.decode(token, options) as JwtPayload;
};

export const verifyPlaidToken = (token: string, key: JwkWithKid) => {
	const pem = jwkToPem(key);
	jwt.verify(token, pem, { algorithms: ["ES256"] });
};

export const jwtSign = data => {
	const signedData = jwt.sign(data, envConfig.JWT_SECRET_KEY);

	return signedData;
};
