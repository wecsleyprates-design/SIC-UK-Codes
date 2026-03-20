import { decryptEin, maskString } from "./encryption";

export const decryptAndMaskTin = (tin: string | null): string | null => {
	if (!tin) return null;

	try {
		return maskString(decryptEin(tin));
	} catch (_error) {
		/**
		 * No need to log the error here; decryptEin already handles logging.
		 * If decryption fails, just return null.
		 */
		return null;
	}
};
