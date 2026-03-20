import { TIN_BEHAVIOR } from "../constants";
import { decryptEin, maskString } from "./encryption";

export const decryptAndTransformTin = (
	probablyEncryptedTin: string | null | undefined,
	tinBehavior: TIN_BEHAVIOR | `${TIN_BEHAVIOR}`
) => {
	/**
	 * If the tinBehavior is ENCRYPT, there's nothing to do.
	 * Return the (probably) encrypted tin.
	 */
	if (+tinBehavior === TIN_BEHAVIOR.ENCRYPT) return probablyEncryptedTin;

	let probablyDecryptedTin = probablyEncryptedTin;
	// If TIN is >9 chars, the value is encrypted, so we must decrypt.
	if (probablyDecryptedTin && probablyDecryptedTin.length > 9) {
		try {
			probablyDecryptedTin = probablyEncryptedTin ? decryptEin(probablyEncryptedTin) : probablyEncryptedTin;
		} catch (_ex) {
			// Intentionally swallowed error to avoid overlogging
		}
	}

	if (+tinBehavior === TIN_BEHAVIOR.PLAIN) {
		/**
		 * If the tinBehavior is PLAIN (plain text), return the decrypted tin.
		 */
		return probablyDecryptedTin;
	} else {
		/**
		 * If the tinBehavior is MASK (or in case of invalid tinBehavior), return the masked (decrypted) tin.
		 */
		return probablyDecryptedTin ? maskString(probablyDecryptedTin) : probablyDecryptedTin;
	}
};
