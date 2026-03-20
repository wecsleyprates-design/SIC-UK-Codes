const jwt = require("jsonwebtoken");
const fs = require("fs");
import { envConfig, tokenConfig } from "#configs/index";
import { ERROR_CODES } from "#constants/index";
import { StatusCodes } from "http-status-codes";
import { cognito } from "#lib/index";

// eslint-disable-next-line no-unused-vars
let accessTokenPrivkey, accessTokenPubkey, refreshTokenPrivkey, refreshTokenPubkey;

// eslint-disable-next-line no-unused-vars
const readTokenKeys = () => {
	accessTokenPrivkey = fs.readFileSync("./keys/access_token/privKey.pem", "utf8");
	accessTokenPubkey = fs.readFileSync("./keys/access_token/pubKey.pem", "utf8");

	refreshTokenPrivkey = fs.readFileSync("./keys/refresh_token/privKey.pem", "utf8");
	refreshTokenPubkey = fs.readFileSync("./keys/refresh_token/pubKey.pem", "utf8");
};

// readTokenKeys();

export const generateToken = tokenData => {
	const token = jwt.sign({ data: tokenData }, accessTokenPrivkey, {
		algorithm: "RS256",
		issuer: envConfig.SUBDOMAIN,
		expiresIn: tokenConfig.TOKEN_LIFE
	});
	return token;
};

export const generateRefreshToken = tokenData => {
	const refreshToken = jwt.sign({ data: tokenData }, refreshTokenPrivkey, {
		algorithm: "RS256",
		issuer: envConfig.SUBDOMAIN,
		expiresIn: tokenConfig.REFRESH_TOKEN_LIFE
	});
	return refreshToken;
};

export const verifyToken = async token => {
	try {
		const decodedToken = await cognito.verifyCognitoToken(token, "id");

		return decodedToken;
	} catch (err) {
		if (err.name === "TokenExpiredError") {
			err.message = "User Session Expired";
		}
		err.status = StatusCodes.UNAUTHORIZED;
		err.errorCode = ERROR_CODES.UNAUTHENTICATED;
		throw err;
	}
};

export const verifyRefreshTokenWithoutExp = refreshToken => {
	try {
		const decodedData = jwt.verify(refreshToken, refreshTokenPubkey, { algorithms: ["RS256"], ignoreExpiration: true });
		return decodedData;
	} catch (err) {
		throw err;
	}
};

export const verifyRefreshToken = token => {
	try {
		const decodedData = jwt.verify(token, refreshTokenPubkey, { algorithms: ["RS256"] });
		return decodedData;
	} catch (err) {
		if (err.name === "TokenExpiredError") {
			err.message = "Refresh Token Expired";
			err.status = StatusCodes.BAD_REQUEST;
			err.errorCode = ERROR_CODES.INVALID;
			throw err;
		}
		throw err;
	}
};
