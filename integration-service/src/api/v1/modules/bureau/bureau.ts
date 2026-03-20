import { getBusinessCustomers } from "#helpers/api";
import { Equifax } from "#lib/equifax";
import { BureauApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, INTEGRATION_ID } from "#constants";
import { UUID } from "crypto";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";

class Bureau {
	/**
	 * @description Get customer business owner scores
	 * @param {UUID}params.business_id: Business ID
	 * @param {UUID} params.customer_id: Customer ID
	 * @returns
	 */
	async getCustomerBusinessOwnerScores(params: {
		business_id: UUID;
		customer_id: UUID;
		case_id?: string;
		score_trigger_id?: string;
		hasPermission?: boolean;
	}) {
		const { business_id, customer_id, case_id, score_trigger_id, hasPermission } = params;
		const result = await getBusinessCustomers(business_id);
		if (!result.customer_ids.includes(customer_id)) {
			throw new BureauApiError(
				"You are not authorized to access this business",
				{},
				StatusCodes.FORBIDDEN,
				ERROR_CODES.UNAUTHORIZED
			);
		}
		const equifax = await strategyPlatformFactory<Equifax>({
			businessID: business_id,
			platformID: INTEGRATION_ID.EQUIFAX,
			customerID: customer_id
		});
		const out: any = await equifax.getOwnerScores({ case_id, score_trigger_id });

		if (!hasPermission) {
			Object.keys(out).forEach(ownerId => {
				out[ownerId] = out[ownerId].map(score => ({
					...score,
					score: null // Set score to null if no permission
				}));
			});
		}

		return out;
	}
}

export const bureau = new Bureau();
