import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants/index";
import { logger } from "#helpers/index";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import type { Owner } from "#types/worthApi";
import type { UUID } from "crypto";

type PlaidIdvPayload = Owner & { business_id: UUID; customer_id?: UUID | null };

export class IdentityVerificationManager {
	async plaidIdentityVerification(body: PlaidIdvPayload): Promise<void> {
		const { business_id: businessID, id: ownerID, customer_id: customerID } = body;
		let plaidIdv: PlaidIdv | null = null;
		const actions = {};

		try {
			const plaidIdvWithStrategy = await strategyPlatformFactory<PlaidIdv>({
				businessID,
				platformID: INTEGRATION_ID.PLAID_IDV,
				customerID: customerID as UUID
			});
			if (!plaidIdvWithStrategy) {
				throw new Error("Failed to initialize PlaidIDV platform");
			}
			plaidIdv = await plaidIdvWithStrategy.initializePlaidIdvConnectionConfiguration(customerID as UUID);
			if (plaidIdv) {
				await plaidIdv.updateConnectionStatus(
					CONNECTION_STATUS.SUCCESS,
					JSON.stringify({ task: "fetch_identity_verification" })
				);
				plaidIdv.customerId = customerID as UUID;
				actions["plaidIdv"] = await plaidIdv.enrollApplicantOrGetExistingIdvRecord(body);
			}
		} catch (err) {
			logger.error(err, `Error in enrolling ${ownerID} in plaidIdv for business ${businessID}`);
			actions["plaidIdv"] = { error: (err as Error).message };
		}
		logger.info(
			`Owner updated: PlaidIDV verification completed for business ${businessID} & owner ${ownerID}. Actions: ${JSON.stringify(actions)}`
		);
	}
}
