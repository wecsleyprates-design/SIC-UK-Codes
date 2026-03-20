const cryptoJS = require("crypto-js");
import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";

// Function to encrypt TIN/SSN (supports international Tax IDs up to 22 characters)
export const encryptEin = (ein: string, logError: boolean = true) => {
	try {
		if (!ein || ein.length <= 0 || ein.length > 22) {
			throw new Error(`Invalid string: ${ein}`);
		}

		const key = cryptoJS.enc.Hex.parse(envConfig.EIN_ENCRYPTION_CRYPTO_SECRET_KEY); // 128-bit key
		const iv = cryptoJS.enc.Hex.parse(envConfig.EIN_ENCRYPTION_CRYPTO_IV); // 128-bit IV

		const encrypted = cryptoJS.AES.encrypt(ein, key, {
			iv: iv,
			mode: cryptoJS.mode.ECB,
			padding: cryptoJS.pad.Pkcs7
		});

		return encrypted.toString();
	} catch (error: any) {
		if (logError) {
			logger.error({ error }, "Error encrypting EIN");
		}
		throw error;
	}
};

// Function to decrypt TIN/SSN
export const decryptEin = (encrypted: string, logError: boolean = true) => {
	try {
		if (!encrypted) {
			throw new Error(`Invalid string: ${encrypted}`);
		}

		const key = cryptoJS.enc.Hex.parse(envConfig.EIN_ENCRYPTION_CRYPTO_SECRET_KEY); // 128-bit key
		const iv = cryptoJS.enc.Hex.parse(envConfig.EIN_ENCRYPTION_CRYPTO_IV); // 128-bit IV

		const decrypted = cryptoJS.AES.decrypt(encrypted, key, {
			iv: iv,
			mode: cryptoJS.mode.ECB,
			padding: cryptoJS.pad.Pkcs7
		});

		return decrypted.toString(cryptoJS.enc.Utf8);
	} catch (error: any) {
		if (logError) {
			logger.error({ error }, "Error decrypting EIN");
		}
		throw error;
	}
};

export const encryptData = data => {
	try {
		const ciphertext = cryptoJS.AES.encrypt(JSON.stringify(data), envConfig.CRYPTO_SECRET_KEY, {
			iv: envConfig.CRYPTO_IV,
			padding: cryptoJS.pad.Pkcs7,
			mode: cryptoJS.mode.CBC
		}).toString();
		return ciphertext;
	} catch (error) {
		throw error;
	}
};

export const decryptData = ciphertext => {
	try {
		const bytes = cryptoJS.AES.decrypt(ciphertext, envConfig.CRYPTO_SECRET_KEY, {
			iv: envConfig.CRYPTO_IV,
			padding: cryptoJS.pad.Pkcs7,
			mode: cryptoJS.mode.CBC
		});
		const decryptedData = JSON.parse(bytes.toString(cryptoJS.enc.Utf8));
		return decryptedData;
	} catch (_error) {
		const error = new Error("Invalid Request while decrypting token");
		throw error;
	}
};

export const encryptFields = (object: Object, rubric: FieldsToEncrypt) => {
	for (const field of Object.keys(rubric)) {
		if (Object.hasOwn(object, field)) {
			if (object[field]) {
				if (rubric[field] && rubric[field].field && rubric[field].fn) {
					const newField = rubric[field].field;
					const translationFunction = rubric[field].fn;
					if (newField && translationFunction) {
						let value = object[field];
						try {
							value = safeDecrypt(value, decryptEin);
						} catch (_error) {
							//couldn't decrypt it, so just use the value as is
						}
						object[newField] = translationFunction(value);
					}
				}
				if (field === "ssn" || field === "tin") {
					object[field] = encryptData(decryptEin(object[field]))
				} else {
					object[field] = safeEncrypt(object[field], encryptData, decryptData);
				}
			}
		}
	}
	return object;
};

export type FieldsToEncrypt = {
	[keyof: string]: {
		//real key in the object
		fn?: (any) => any; //function to use that will take the plain text value as an input and return some sort of other value -- example: take the full ssn and return the last 4 digits
		field?: string; //the field name to use for the function above
	};
};

/**
 * This function makes sure that the first N number of digits from given string are hidden
 * @param str {string}
 * @param maskLength {number} Digits to hide from given string (default is 5)
 * @returns {string} Masked string
 */
export const maskString = (str: string, maskLength: number = 5) => {
	try {
		if (maskLength <= 0) {
			throw new Error("Invalid mask length");
		}

		if (maskLength > str.length) {
			maskLength = str.length;
		}

		const mask = "X".repeat(maskLength);

		const maskedString = mask + str.substring(maskLength);
		return maskedString;
	} catch (error: any) {
		logger.error({ error }, "Could not mask given string");
		throw error;
	}
};

/**
 * Check if a value is encrypted
 * @param value 
 * @param decryptor 
 * @returns 
 */
export const isEncrypted = (value: string, decryptor: (value: string, log: boolean) => string) => {
	// Try to decrypt; consider it encrypted only if decrypt succeeds and yields a different, non-empty value.
	try {
		const decrypted = decryptor(value, false);
		if (decrypted === value || decrypted == null || decrypted == undefined) return false;
		if (typeof decrypted === "string" && decrypted.length === 0) return false;
		return true;
	} catch {
		return false;
	}
};

/**
 * Only encrypt if the value is not already encrypted.
 * If the value is already encrypted, return the value as is.
 * @param value
 * @param encryptor
 * @param decryptor
 * @returns
 */
export const safeEncrypt = (
	value: string,
	encryptor: (value: string, log: boolean) => string,
	decryptor: (value: string, log: boolean) => string
) => {
	//only encrypt if the value is not already encrypted
	if (isEncrypted(value, decryptor)) {
		return value;
	}
	return encryptor(value, false);
};

/**
 * Only decrypt if the value is encrypted.
 * If the value is not encrypted, return the value as is.
 * @param value
 * @param decryptor
 * @returns
 */
export const safeDecrypt = (value: string, decryptor: (value: string, log: boolean) => string) => {
	//only decrypt if the value is encrypted
	if (!isEncrypted(value, decryptor)) {
		return value;
	}
	return decryptor(value, false);
};
