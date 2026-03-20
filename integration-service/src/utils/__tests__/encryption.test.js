import CryptoJS from "crypto-js";
import { encryptData, decryptData } from "../encryption";
import { envConfig } from "#configs/index";

// Mock the config
jest.mock("#configs/index", () => ({
	envConfig: {
		CRYPTO_SECRET_KEY: "test-secret-key",
		CRYPTO_IV: "test-iv-16bytes",
		CRYPTO_SECRET_KEY_V2: "test-secret-key-v2",
		CRYPTO_IV_V2: "test-iv2-16bytes"
	}
}));

jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		info: jest.fn()
	}
}));

describe("Encryption Utils - customerKey parameter", () => {
	const testData = { sensitive: "data", id: 123 };
	const customKey = "custom-customer-key";

	describe("encryptData", () => {
		it("should encrypt data using default key when customerKey is not provided", () => {
			const encrypted = encryptData(testData);

			expect(encrypted).toBeTruthy();
			expect(typeof encrypted).toBe("string");
			expect(encrypted).not.toContain("sensitive");
		});

		it("should encrypt data using customerKey when provided", () => {
			const encrypted = encryptData(testData, customKey);

			expect(encrypted).toBeTruthy();
			expect(typeof encrypted).toBe("string");
			expect(encrypted).not.toContain("sensitive");
		});

		it("should produce different ciphertext with different keys", () => {
			const encryptedDefault = encryptData(testData);
			const encryptedCustom = encryptData(testData, customKey);

			expect(encryptedDefault).not.toBe(encryptedCustom);
		});

		it("should encrypt string data", () => {
			const stringData = "simple string";
			const encrypted = encryptData(stringData);

			expect(encrypted).toBeTruthy();
			expect(encrypted).not.toBe(stringData);
		});

		it("should encrypt number data", () => {
			const numberData = 12345;
			const encrypted = encryptData(numberData);

			expect(encrypted).toBeTruthy();
			expect(typeof encrypted).toBe("string");
		});

		it("should encrypt array data", () => {
			const arrayData = [1, 2, 3, "test"];
			const encrypted = encryptData(arrayData);

			expect(encrypted).toBeTruthy();
			expect(typeof encrypted).toBe("string");
		});

		it("should handle null customerKey (uses default)", () => {
			const encrypted = encryptData(testData, null);

			expect(encrypted).toBeTruthy();
			expect(typeof encrypted).toBe("string");
		});

		it("should throw error if encryption fails", () => {
			// Mock CryptoJS.AES.encrypt to throw
			const originalEncrypt = CryptoJS.AES.encrypt;
			CryptoJS.AES.encrypt = jest.fn(() => {
				throw new Error("Encryption failed");
			});

			expect(() => encryptData(testData)).toThrow("Encryption failed");

			// Restore original
			CryptoJS.AES.encrypt = originalEncrypt;
		});
	});

	describe("decryptData", () => {
		it("should decrypt data using default key when customerKey is not provided", () => {
			const encrypted = encryptData(testData);
			const decrypted = decryptData(encrypted);

			expect(decrypted).toEqual(testData);
		});

		it("should decrypt data using customerKey when provided", () => {
			const encrypted = encryptData(testData, customKey);
			const decrypted = decryptData(encrypted, customKey);

			expect(decrypted).toEqual(testData);
		});

		it("should fail to decrypt with wrong key", () => {
			const encrypted = encryptData(testData, customKey);

			expect(() => decryptData(encrypted, "wrong-key")).toThrow();
		});

		it("should decrypt string data", () => {
			const stringData = "simple string";
			const encrypted = encryptData(stringData);
			const decrypted = decryptData(encrypted);

			expect(decrypted).toBe(stringData);
		});

		it("should decrypt number data", () => {
			const numberData = 12345;
			const encrypted = encryptData(numberData);
			const decrypted = decryptData(encrypted);

			expect(decrypted).toBe(numberData);
		});

		it("should decrypt array data", () => {
			const arrayData = [1, 2, 3, "test"];
			const encrypted = encryptData(arrayData);
			const decrypted = decryptData(encrypted);

			expect(decrypted).toEqual(arrayData);
		});

		it("should handle null customerKey (uses default)", () => {
			const encrypted = encryptData(testData, null);
			const decrypted = decryptData(encrypted, null);

			expect(decrypted).toEqual(testData);
		});

		it("should fallback to V2 key if V1 decryption fails", () => {
			// Encrypt with V2 key directly
			const encryptedWithV2 = CryptoJS.AES.encrypt(JSON.stringify(testData), envConfig.CRYPTO_SECRET_KEY_V2, {
				iv: envConfig.CRYPTO_IV_V2,
				padding: CryptoJS.pad.Pkcs7,
				mode: CryptoJS.mode.CBC
			}).toString();

			const decrypted = decryptData(encryptedWithV2);

			expect(decrypted).toEqual(testData);
		});

		it("should throw error if both V1 and V2 decryption fail", () => {
			const invalidCiphertext = "invalid-encrypted-data";

			expect(() => decryptData(invalidCiphertext)).toThrow("Invalid Request while decrypting token");
		});

		it("should throw error if crypto keys are undefined", () => {
			const originalKey = envConfig.CRYPTO_SECRET_KEY;
			envConfig.CRYPTO_SECRET_KEY = undefined;

			expect(() => decryptData("some-ciphertext")).toThrow("Crypto secret key or IV is not defined");

			envConfig.CRYPTO_SECRET_KEY = originalKey;
		});
	});

	describe("encryptData and decryptData integration", () => {
		it("should successfully encrypt and decrypt complex nested objects", () => {
			const complexData = {
				user: {
					name: "John Doe",
					ssn: "123-45-6789",
					address: {
						street: "123 Main St",
						city: "New York"
					}
				},
				items: [1, 2, 3],
				metadata: null
			};

			const encrypted = encryptData(complexData);
			const decrypted = decryptData(encrypted);

			expect(decrypted).toEqual(complexData);
		});

		it("should work with custom key end-to-end", () => {
			const data = { secret: "customer-specific-data" };
			const customerKey = "customer-xyz-key";

			const encrypted = encryptData(data, customerKey);
			const decrypted = decryptData(encrypted, customerKey);

			expect(decrypted).toEqual(data);
		});

		it("should maintain data integrity for multiple encrypt/decrypt cycles", () => {
			let data = { value: "test" };

			for (let i = 0; i < 5; i++) {
				const encrypted = encryptData(data);
				data = decryptData(encrypted);
			}

			expect(data).toEqual({ value: "test" });
		});
	});
});
