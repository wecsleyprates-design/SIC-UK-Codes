import { decryptEin, maskString } from "../encryption";
import { decryptAndTransformTin } from "../decryptAndTransformTin";
import { TIN_BEHAVIOR } from "../../constants";

jest.mock("../encryption");
const mockDecryptEin = decryptEin as jest.MockedFunction<typeof decryptEin>;
const mockMaskString = maskString as jest.MockedFunction<typeof maskString>;

describe("decryptAndTransformTin", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("when tinBehavior is ENCRYPT", () => {
		it("should return the input unchanged for encrypted TIN", () => {
			/** Arrange */
			const encryptedTin = "some-long-encrypted-string-longer-than-9-chars";

			/** Act */
			const result = decryptAndTransformTin(encryptedTin, TIN_BEHAVIOR.ENCRYPT);

			/** Assert */
			expect(result).toBe(encryptedTin);
			expect(mockDecryptEin).not.toHaveBeenCalled();
			expect(mockMaskString).not.toHaveBeenCalled();
		});

		it("should return the input unchanged for short TIN", () => {
			/** Arrange */
			const shortTin = "123456789";

			/** Act */
			const result = decryptAndTransformTin(shortTin, TIN_BEHAVIOR.ENCRYPT);

			/** Assert */
			expect(result).toBe(shortTin);
			expect(mockDecryptEin).not.toHaveBeenCalled();
			expect(mockMaskString).not.toHaveBeenCalled();
		});

		it("should work with string enum value", () => {
			/** Arrange */
			const tin = "some-tin-value";

			/** Act */
			const result = decryptAndTransformTin(tin, `${TIN_BEHAVIOR.ENCRYPT}`);

			/** Assert */
			expect(result).toBe(tin);
		});
	});

	describe("when tinBehavior is PLAIN", () => {
		it("should return decrypted TIN for long encrypted input", () => {
			/** Arrange */
			const encryptedTin = "long-encrypted-string-over-9-chars";
			const decryptedTin = "123456789";
			mockDecryptEin.mockReturnValueOnce(decryptedTin);

			/** Act */
			const result = decryptAndTransformTin(encryptedTin, TIN_BEHAVIOR.PLAIN);

			/** Assert */
			expect(result).toBe(decryptedTin);
			expect(mockDecryptEin).toHaveBeenCalledWith(encryptedTin);
			expect(mockMaskString).not.toHaveBeenCalled();
		});

		it("should return input unchanged for short TIN (already decrypted)", () => {
			/** Arrange */
			const shortTin = "123456789";

			/** Act */
			const result = decryptAndTransformTin(shortTin, TIN_BEHAVIOR.PLAIN);

			/** Assert */
			expect(result).toBe(shortTin);
			expect(mockDecryptEin).not.toHaveBeenCalled();
			expect(mockMaskString).not.toHaveBeenCalled();
		});

		it("should handle decryption errors gracefully", () => {
			/** Arrange */
			const encryptedTin = "invalid-encrypted-string-over-9-chars";
			mockDecryptEin.mockImplementation(() => {
				throw new Error("Decryption failed");
			});

			/** Act */
			const result = decryptAndTransformTin(encryptedTin, TIN_BEHAVIOR.PLAIN);

			/** Assert */
			expect(result).toBe(encryptedTin); // Should return original if decryption fails
			expect(mockDecryptEin).toHaveBeenCalledWith(encryptedTin);
			expect(mockMaskString).not.toHaveBeenCalled();
		});

		it("should work with string enum value", () => {
			/** Arrange */
			const tin = "123456789";

			/** Act */
			const result = decryptAndTransformTin(tin, `${TIN_BEHAVIOR.PLAIN}`);

			/** Assert */
			expect(result).toBe(tin);
		});
	});

	describe("when tinBehavior is MASK", () => {
		it("should return masked decrypted TIN for long encrypted input", () => {
			/** Arrange */
			const encryptedTin = "long-encrypted-string-over-9-chars";
			const decryptedTin = "123456789";
			const maskedTin = "XXXXX6789";
			mockDecryptEin.mockReturnValueOnce(decryptedTin);
			mockMaskString.mockReturnValueOnce(maskedTin);

			/** Act */
			const result = decryptAndTransformTin(encryptedTin, TIN_BEHAVIOR.MASK);

			/** Assert */
			expect(result).toBe(maskedTin);
			expect(mockDecryptEin).toHaveBeenCalledWith(encryptedTin);
			expect(mockMaskString).toHaveBeenCalledWith(decryptedTin);
		});

		it("should return masked TIN for short input (already decrypted)", () => {
			/** Arrange */
			const shortTin = "123456789";
			const maskedTin = "XXXXX6789";
			mockMaskString.mockReturnValueOnce(maskedTin);

			/** Act */
			const result = decryptAndTransformTin(shortTin, TIN_BEHAVIOR.MASK);

			/** Assert */
			expect(result).toBe(maskedTin);
			expect(mockDecryptEin).not.toHaveBeenCalled();
			expect(mockMaskString).toHaveBeenCalledWith(shortTin);
		});

		it("should handle decryption errors gracefully and mask original", () => {
			/** Arrange */
			const encryptedTin = "invalid-encrypted-string-over-9-chars";
			const maskedTin = "XXXXXring-over-9-chars";
			mockDecryptEin.mockImplementation(() => {
				throw new Error("Decryption failed");
			});
			mockMaskString.mockReturnValueOnce(maskedTin);

			/** Act */
			const result = decryptAndTransformTin(encryptedTin, TIN_BEHAVIOR.MASK);

			/** Assert */
			expect(result).toBe(maskedTin);
			expect(mockDecryptEin).toHaveBeenCalledWith(encryptedTin);
			expect(mockMaskString).toHaveBeenCalledWith(encryptedTin);
		});

		it("should work with string enum value", () => {
			/** Arrange */
			const tin = "123456789";
			const maskedTin = "XXXXX6789";
			mockMaskString.mockReturnValueOnce(maskedTin);

			/** Act */
			const result = decryptAndTransformTin(tin, `${TIN_BEHAVIOR.MASK}`);

			/** Assert */
			expect(result).toBe(maskedTin);
			expect(mockMaskString).toHaveBeenCalledWith(tin);
		});
	});

	describe("edge cases", () => {
		it("should handle empty string input", () => {
			/** Arrange */
			const emptyTin = "";

			/** Act - should default to MASK behavior for non-ENCRYPT/PLAIN */
			const result = decryptAndTransformTin(emptyTin, TIN_BEHAVIOR.MASK);

			/** Assert */
			expect(result).toBe(emptyTin); // Returns empty string directly due to falsy check
			expect(mockDecryptEin).not.toHaveBeenCalled(); // Length <= 9
			expect(mockMaskString).not.toHaveBeenCalled(); // Empty string is falsy, so not masked
		});

		it("should handle null/undefined-like input", () => {
			/** Arrange */
			const nullishTin = null as any;

			/** Act */
			const result = decryptAndTransformTin(nullishTin, TIN_BEHAVIOR.PLAIN);

			/** Assert */
			expect(result).toBe(nullishTin);
			expect(mockDecryptEin).not.toHaveBeenCalled();
		});

		it("should handle invalid tinBehavior by defaulting to MASK", () => {
			/** Arrange */
			const tin = "123456789";
			const maskedTin = "XXXXX6789";
			const invalidBehavior = 999 as TIN_BEHAVIOR;
			mockMaskString.mockReturnValueOnce(maskedTin);

			/** Act */
			const result = decryptAndTransformTin(tin, invalidBehavior);

			/** Assert */
			expect(result).toBe(maskedTin);
			expect(mockMaskString).toHaveBeenCalledWith(tin);
		});

		it("should handle exactly 9 character TIN (boundary case)", () => {
			/** Arrange */
			const nineTin = "123456789"; // Exactly 9 chars - should not decrypt
			const maskedTin = "XXXXX6789";
			mockMaskString.mockReturnValueOnce(maskedTin);

			/** Act */
			const result = decryptAndTransformTin(nineTin, TIN_BEHAVIOR.MASK);

			/** Assert */
			expect(result).toBe(maskedTin);
			expect(mockDecryptEin).not.toHaveBeenCalled(); // Length not > 9
			expect(mockMaskString).toHaveBeenCalledWith(nineTin);
		});

		it("should handle 10 character TIN (just over boundary)", () => {
			/** Arrange */
			const tenTin = "1234567890"; // 10 chars - should attempt decrypt
			const decryptedTin = "987654321";
			const maskedTin = "XXXXX4321";
			mockDecryptEin.mockReturnValueOnce(decryptedTin);
			mockMaskString.mockReturnValueOnce(maskedTin);

			/** Act */
			const result = decryptAndTransformTin(tenTin, TIN_BEHAVIOR.MASK);

			/** Assert */
			expect(result).toBe(maskedTin);
			expect(mockDecryptEin).toHaveBeenCalledWith(tenTin);
			expect(mockMaskString).toHaveBeenCalledWith(decryptedTin);
		});

		it("should not throw an error if decryption fails", () => {
			/** Arrange */
			const encryptedTin = "invalid-encrypted-string-over-9-chars";
			mockDecryptEin.mockImplementation(() => {
				throw new Error("Decryption failed");
			});

			/** Act */
			const result = decryptAndTransformTin(encryptedTin, TIN_BEHAVIOR.PLAIN);

			/** Assert */
			expect(result).toBe(encryptedTin);
			expect(mockDecryptEin).toHaveBeenCalledWith(encryptedTin);
			expect(mockMaskString).not.toHaveBeenCalled();
		});
	});
});
