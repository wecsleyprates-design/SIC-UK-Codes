import CryptoJS from "crypto-js";
import crypto from "crypto";
import { envConfig } from "#configs/index";
import { logger } from "#helpers/logger";

/**
 * Create an HMAC-SHA256 signature
 * @param {string} data - The data to sign
 * @param {string} secret - The secret key
 * @returns {string} Hex-encoded HMAC signature
 */
export const createHmacSha256 = (data, secret) => {
	return crypto.createHmac("sha256", secret).update(data).digest("hex");
};

/**
 * Timing-safe comparison for hex-encoded signatures.
 * Prevents timing attacks by ensuring constant-time comparison.
 * @param {string} a - First hex signature
 * @param {string} b - Second hex signature
 * @returns {boolean} True if signatures match
 */
export const timingSafeHexCompare = (a, b) => {
	try {
		const bufA = Buffer.from(a, "hex");
		const bufB = Buffer.from(b, "hex");
		if (bufA.length !== bufB.length) return false;
		return crypto.timingSafeEqual(bufA, bufB);
	} catch {
		return false;
	}
};

export const encryptData = (data, customerKey = null) => {
	try {
		const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), customerKey ?? envConfig.CRYPTO_SECRET_KEY_V2, {
			iv: envConfig.CRYPTO_IV_V2,
			padding: CryptoJS.pad.Pkcs7,
			mode: CryptoJS.mode.CBC
		}).toString();
		return ciphertext;
	} catch (error) {
		throw error;
	}
};

export const decryptData = (ciphertext, customerKey = null, silent = false) => {
	if (envConfig.CRYPTO_SECRET_KEY === undefined || envConfig.CRYPTO_IV === undefined) {
		throw new Error("Crypto secret key or IV is not defined");
	}
	try {
		const bytes = CryptoJS.AES.decrypt(ciphertext, customerKey ?? envConfig.CRYPTO_SECRET_KEY, {
			iv: envConfig.CRYPTO_IV,
			padding: CryptoJS.pad.Pkcs7,
			mode: CryptoJS.mode.CBC
		});
		const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
		return decryptedData;
	} catch (_error) {
		// If we throw the first time then it isn't a big deal, we'll just try the other key
		try {
			const bytes = CryptoJS.AES.decrypt(ciphertext, customerKey ?? envConfig.CRYPTO_SECRET_KEY_V2, {
				iv: envConfig.CRYPTO_IV_V2,
				padding: CryptoJS.pad.Pkcs7,
				mode: CryptoJS.mode.CBC
			});
			const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
			return decryptedData;
		} catch (error) {
			if (!silent) {
				logger.error({ error, ciphertext }, "Error in decryptData");
			}
			const updatedError = new Error("Invalid Request while decrypting token");
			updatedError.status = 400;
			throw updatedError;
		}
	}
};

/**
 * Safely decrypts a value.
 * If the value is not encrypted, returns the value as is.
 * @param value {string} The value to decrypt
 * @returns {string | null} The decrypted value or null if the value is not encrypted
 */
export const safeDecrypt = (value, cryptoKey = null) => {
	if (!value) return null;
	try {
		return decryptData(value, cryptoKey, true);
	} catch {
		return value; // Already decrypted or invalid
	}
};

/**
 * This function makes sure that the first N number of digits from given string are hidded
 * @param str {string}
 * @param maskLength {number} Digits to hide from given string (default is 5)
 * @returns {string} Masked string
 */
export const maskString = (str, maskLength = 5) => {
	try {
		if (maskLength <= 0 || maskLength > str.length) {
			throw new Error("Invalid mask length");
		}

		const mask = "X".repeat(maskLength);

		const maskedString = mask + str.substring(maskLength);
		return maskedString;
	} catch (error) {
		logger.error("Could not mask given string: ", JSON.parse(error));
		throw error;
	}
};
