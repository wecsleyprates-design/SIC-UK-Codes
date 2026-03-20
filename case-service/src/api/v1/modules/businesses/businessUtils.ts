import { logger } from "#helpers/logger";

class BusinessUtils {
	constructor() {
		throw new Error("This class should not be instantiated");
	}
	/**
	 * Check if the business verification (TIN Match) is valid
	 * Returns tuple of:
	 *  true if valid, false if not
	 *  tin verification failure message if failed
	 * @deprecated -- use assertTinValid instead
	 */
	public static isBusinessVerificationValid(businessVerificationDetails): [boolean, string?] {
		const { reviewTasks } = businessVerificationDetails;

		// For future: tin is in businessEntityVerification.businessEntityVerification.tin
		if (reviewTasks) {
			// find tin verification task
			const tinVerificationTask = reviewTasks.find(task => task.category == "tin" && task.category == "tin");
			const failureSubLabels: Lowercase<string>[] = ["not found", "not issued", "mismatch", "error"];
			// fail the verification if the tin verification task is failed and it is one of the enumerated sublabels that are considered fatal
			if (
				tinVerificationTask &&
				tinVerificationTask.status === "failure" &&
				failureSubLabels.includes(tinVerificationTask?.sublabel?.toLowerCase() as Lowercase<string>)
			) {
				logger.error(
					`businessVerification=${businessVerificationDetails.id} TIN Verification failed: ${
						tinVerificationTask.message ?? ""
					} (${tinVerificationTask.sublabel ?? ""})`
				);
				return [false, tinVerificationTask.message ?? "TIN Failed"];
			}
		}
		return [true];
	}
}

export default BusinessUtils;
