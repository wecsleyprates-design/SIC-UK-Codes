import { ERROR_CODES, ROLES } from "#constants";
import { getBusinessApplicants, getBusinessFacts } from "#helpers";
import { UserInfo } from "#types";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { FactsApiError } from "./error";

// Import fact arrays to get fact names for each category
import { businessFacts } from "#lib/facts/businessDetails";
import { kybFacts } from "#lib/facts/kyb";
import { bjlFacts } from "#lib/facts/bjl";
import { reviewFacts } from "#lib/facts/reviews";
import { financialFacts } from "#lib/facts/financials/financials";
import { matchingFacts } from "#lib/facts/matches/matches";

type FactCategory = "business-details" | "kyb" | "bjl" | "reviews" | "financials" | "matches" | "all";

class FactsProxy {
	private getFactNamesByCategory(category: FactCategory): Set<string> | null {
		switch (category) {
			case "business-details":
				return new Set(businessFacts.map(fact => fact.name));
			case "kyb":
				return new Set(kybFacts.map(fact => fact.name));
			case "bjl":
				return new Set(bjlFacts.map(fact => fact.name));
			case "reviews":
				return new Set(reviewFacts.map(fact => fact.name));
			case "financials":
				return new Set(financialFacts.map(fact => fact.name));
			case "matches":
				return new Set(matchingFacts.map(fact => fact.name));
			case "all":
			default:
				return null; // Return all facts
		}
	}

	async getProxyBusinessDetails(businessID: UUID, userInfo: UserInfo, category?: FactCategory) {
		if (userInfo?.role?.code === ROLES.APPLICANT) {
			const records = await getBusinessApplicants(businessID);
			const applicants = records.map(applicant => applicant.id);
			if (!applicants.includes(userInfo?.user_id)) {
				throw new FactsApiError("You are not allowed to access details of this business.", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHENTICATED);
			}
		}

		const wareHouseFacts = await getBusinessFacts(businessID);

		// Get the set of fact names for the requested category
		const categoryFactNames = this.getFactNamesByCategory(category || "all");

		const response: Record<string, any> = {};
		wareHouseFacts.forEach(obj => {
			// If category is specified and fact name is not in the category, skip it
			if (categoryFactNames && !categoryFactNames.has(obj.name)) {
				return;
			}
			response[obj.name] = obj.value;
		});

		return response;
	}
}

export const factsProxy = new FactsProxy();