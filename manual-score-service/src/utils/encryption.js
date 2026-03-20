const CryptoJS = require("crypto-js");
import { envConfig } from "#configs/index";

export const encryptData = data => {
	try {
		const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), envConfig.CRYPTO_SECRET_KEY, {
			iv: envConfig.CRYPTO_IV,
			padding: CryptoJS.pad.Pkcs7,
			mode: CryptoJS.mode.CBC
		}).toString();
		return ciphertext;
	} catch (error) {
		throw error;
	}
};

export const decryptData = ciphertext => {
	try {
		const bytes = CryptoJS.AES.decrypt(ciphertext, envConfig.CRYPTO_SECRET_KEY, {
			iv: envConfig.CRYPTO_IV,
			padding: CryptoJS.pad.Pkcs7,
			mode: CryptoJS.mode.CBC
		});
		const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
		return decryptedData;
	} catch (err) {
		const error = new Error("Invalid Request while decrypting token");
		error.status = 400;
		throw error;
	}
};
