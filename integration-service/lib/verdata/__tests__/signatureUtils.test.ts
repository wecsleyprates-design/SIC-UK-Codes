import crypto from "crypto";
import { generateSignedCallbackUrl, verifyVerdataSignature } from "../signatureUtils";

// Mock the environment config
jest.mock("#configs/index", () => ({
	envConfig: {
		VERDATA_CALLBACK_SECRET: "test-secret-for-unit-tests-32-characters",
		VERDATA_SIGNATURE_MAX_AGE_SECONDS: 3600
	}
}));

// Mock the logger
jest.mock("#helpers/index", () => ({
	logger: {
		warn: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

describe("Verdata Signature Utils", () => {
	const mockBusinessId = "1e3a2bdd-f569-430e-85c0-0f065c41ae8a";
	const mockTaskId = "b7124d87-bfec-46c1-92b3-0d40a4a8636c";
	const testSecret = "test-secret-for-unit-tests-32-characters";

	describe("generateSignedCallbackUrl", () => {
		it("should generate a valid signed URL with all required parameters", () => {
			const baseUrl = "https://api.example.com/webhook";
			const result = generateSignedCallbackUrl(baseUrl, {
				business_id: mockBusinessId,
				task_id: mockTaskId
			});

			expect(result.url).toContain(baseUrl);
			expect(result.url).toContain(`business_id=${mockBusinessId}`);
			expect(result.url).toContain(`task_id=${mockTaskId}`);
			expect(result.url).toContain("ts=");
			expect(result.url).toContain("sig=");
			expect(result.signature).toHaveLength(64); // SHA256 hex = 64 chars
			expect(result.timestamp).toBeGreaterThan(0);
		});

		it("should generate a signature that is 64 characters (SHA256 hex)", () => {
			const baseUrl = "https://api.example.com/webhook";
			const result = generateSignedCallbackUrl(baseUrl, {
				business_id: mockBusinessId,
				task_id: mockTaskId
			});

			expect(result.signature).toMatch(/^[a-f0-9]{64}$/);
		});

		it("should include timestamp in the URL", () => {
			const baseUrl = "https://api.example.com/webhook";
			const beforeTime = Math.floor(Date.now() / 1000);
			const result = generateSignedCallbackUrl(baseUrl, {
				business_id: mockBusinessId,
				task_id: mockTaskId
			});
			const afterTime = Math.floor(Date.now() / 1000);

			expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
			expect(result.timestamp).toBeLessThanOrEqual(afterTime);
		});

		it("should generate different signatures for different business_ids", () => {
			const baseUrl = "https://api.example.com/webhook";

			const result1 = generateSignedCallbackUrl(baseUrl, {
				business_id: mockBusinessId,
				task_id: mockTaskId
			});

			const result2 = generateSignedCallbackUrl(baseUrl, {
				business_id: "00000000-0000-0000-0000-000000000000",
				task_id: mockTaskId
			});

			expect(result1.signature).not.toBe(result2.signature);
		});

		it("should generate different signatures for different task_ids", () => {
			const baseUrl = "https://api.example.com/webhook";

			const result1 = generateSignedCallbackUrl(baseUrl, {
				business_id: mockBusinessId,
				task_id: mockTaskId
			});

			const result2 = generateSignedCallbackUrl(baseUrl, {
				business_id: mockBusinessId,
				task_id: "00000000-0000-0000-0000-000000000000"
			});

			expect(result1.signature).not.toBe(result2.signature);
		});

		it("should generate a URL that can be parsed correctly", () => {
			const baseUrl = "https://api.example.com/webhook";
			const result = generateSignedCallbackUrl(baseUrl, {
				business_id: mockBusinessId,
				task_id: mockTaskId
			});

			const url = new URL(result.url);
			expect(url.searchParams.get("business_id")).toBe(mockBusinessId);
			expect(url.searchParams.get("task_id")).toBe(mockTaskId);
			expect(url.searchParams.get("ts")).toBe(result.timestamp.toString());
			expect(url.searchParams.get("sig")).toBe(result.signature);
		});
	});

	describe("verifyVerdataSignature", () => {
		function generateValidSignature(businessId: string, taskId: string, timestamp: number): string {
			const dataToSign = `${businessId}:${taskId}:${timestamp}`;
			return crypto.createHmac("sha256", testSecret).update(dataToSign).digest("hex");
		}

		it("should return valid for a correct signature", () => {
			const timestamp = Math.floor(Date.now() / 1000);
			const signature = generateValidSignature(mockBusinessId, mockTaskId, timestamp);

			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, timestamp.toString(), signature);

			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should return MISSING_SIGNATURE when sig is undefined", () => {
			const timestamp = Math.floor(Date.now() / 1000);

			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, timestamp.toString(), undefined);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("MISSING_SIGNATURE");
		});

		it("should return MISSING_SIGNATURE when ts is undefined", () => {
			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, undefined, "somesignature");

			expect(result.valid).toBe(false);
			expect(result.error).toBe("MISSING_SIGNATURE");
		});

		it("should return MISSING_SIGNATURE when both sig and ts are undefined", () => {
			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, undefined, undefined);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("MISSING_SIGNATURE");
		});

		it("should return INVALID_SIGNATURE when business_id is undefined", () => {
			const timestamp = Math.floor(Date.now() / 1000);
			const signature = generateValidSignature(mockBusinessId, mockTaskId, timestamp);

			const result = verifyVerdataSignature(undefined, mockTaskId, timestamp.toString(), signature);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("INVALID_SIGNATURE");
		});

		it("should return INVALID_SIGNATURE when task_id is undefined", () => {
			const timestamp = Math.floor(Date.now() / 1000);
			const signature = generateValidSignature(mockBusinessId, mockTaskId, timestamp);

			const result = verifyVerdataSignature(mockBusinessId, undefined, timestamp.toString(), signature);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("INVALID_SIGNATURE");
		});

		it("should return INVALID_SIGNATURE when timestamp is not a number", () => {
			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, "not-a-number", "somesignature");

			expect(result.valid).toBe(false);
			expect(result.error).toBe("INVALID_SIGNATURE");
		});

		it("should return SIGNATURE_EXPIRED for timestamp older than max age", () => {
			// Timestamp from 2 hours ago (max age is 1 hour)
			const oldTimestamp = Math.floor(Date.now() / 1000) - 7200;
			const signature = generateValidSignature(mockBusinessId, mockTaskId, oldTimestamp);

			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, oldTimestamp.toString(), signature);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("SIGNATURE_EXPIRED");
		});

		it("should return SIGNATURE_MISMATCH for incorrect signature", () => {
			const timestamp = Math.floor(Date.now() / 1000);
			const wrongSignature = "0000000000000000000000000000000000000000000000000000000000000000";

			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, timestamp.toString(), wrongSignature);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("SIGNATURE_MISMATCH");
		});

		it("should return SIGNATURE_MISMATCH when business_id is tampered", () => {
			const timestamp = Math.floor(Date.now() / 1000);
			// Generate signature for original business_id
			const signature = generateValidSignature(mockBusinessId, mockTaskId, timestamp);

			// Verify with different business_id (tampered)
			const result = verifyVerdataSignature(
				"00000000-0000-0000-0000-000000000000",
				mockTaskId,
				timestamp.toString(),
				signature
			);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("SIGNATURE_MISMATCH");
		});

		it("should return SIGNATURE_MISMATCH when task_id is tampered", () => {
			const timestamp = Math.floor(Date.now() / 1000);
			// Generate signature for original task_id
			const signature = generateValidSignature(mockBusinessId, mockTaskId, timestamp);

			// Verify with different task_id (tampered)
			const result = verifyVerdataSignature(
				mockBusinessId,
				"00000000-0000-0000-0000-000000000000",
				timestamp.toString(),
				signature
			);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("SIGNATURE_MISMATCH");
		});

		it("should return SIGNATURE_MISMATCH when timestamp is tampered", () => {
			const originalTimestamp = Math.floor(Date.now() / 1000);
			const tamperedTimestamp = originalTimestamp - 60; // 1 minute earlier
			// Generate signature for original timestamp
			const signature = generateValidSignature(mockBusinessId, mockTaskId, originalTimestamp);

			// Verify with different timestamp (tampered)
			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, tamperedTimestamp.toString(), signature);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("SIGNATURE_MISMATCH");
		});

		it("should return SIGNATURE_MISMATCH for malformed hex signature", () => {
			// Note: Buffer.from(sig, "hex") doesn't throw for invalid hex - it ignores invalid chars
			// This results in a different length buffer, so we get SIGNATURE_MISMATCH
			const timestamp = Math.floor(Date.now() / 1000);

			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, timestamp.toString(), "not-valid-hex!");

			expect(result.valid).toBe(false);
			expect(result.error).toBe("SIGNATURE_MISMATCH");
		});

		it("should return SIGNATURE_MISMATCH for signature with wrong length", () => {
			const timestamp = Math.floor(Date.now() / 1000);
			// Valid hex but wrong length
			const shortSignature = "abcd1234";

			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, timestamp.toString(), shortSignature);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("SIGNATURE_MISMATCH");
		});

		it("should accept signature that is just within max age", () => {
			// Timestamp from 59 minutes ago (just within 1 hour max age)
			const recentTimestamp = Math.floor(Date.now() / 1000) - 3540;
			const signature = generateValidSignature(mockBusinessId, mockTaskId, recentTimestamp);

			const result = verifyVerdataSignature(mockBusinessId, mockTaskId, recentTimestamp.toString(), signature);

			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});

	describe("Integration: generateSignedCallbackUrl and verifyVerdataSignature", () => {
		it("should generate a URL that can be verified successfully", () => {
			const baseUrl = "https://api.example.com/webhook";
			const { url } = generateSignedCallbackUrl(baseUrl, {
				business_id: mockBusinessId,
				task_id: mockTaskId
			});

			// Parse the URL to extract parameters
			const parsedUrl = new URL(url);
			const business_id = parsedUrl.searchParams.get("business_id");
			const task_id = parsedUrl.searchParams.get("task_id");
			const ts = parsedUrl.searchParams.get("ts");
			const sig = parsedUrl.searchParams.get("sig");

			// Verify the signature
			const result = verifyVerdataSignature(business_id!, task_id!, ts!, sig!);

			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});
});
