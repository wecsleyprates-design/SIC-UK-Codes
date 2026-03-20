import { logger, getBusinessDetails } from "#helpers/index";
import { toYMD } from "#utils/index";
import { getBusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import type { Owner } from "#types/worthApi";
import type { UUID } from "crypto";

type WatchlistPayload = Owner & { business_id: UUID; customer_id?: UUID | null };

export class WatchlistScreeningManager {
	async ownersWatchlistSubmission(body: WatchlistPayload): Promise<void> {
		try {
			const businessDetails = await getBusinessDetails(body.business_id);
			if (!businessDetails || !businessDetails.data) {
				logger.warn(`Business not found for watchlist verification task: ${body.business_id}`);
			}

			const peopleData: { name: string; dob?: string }[] = [];
			if (businessDetails?.status === "success" && businessDetails?.data?.owners) {
				businessDetails.data.owners.forEach(owner => {
					const ownerName = [owner.first_name, owner.last_name].filter(Boolean).join(" ");
					const ownerDOB = toYMD(owner.date_of_birth);
					if (ownerName) {
						peopleData.push({
							name: ownerName,
							...(ownerDOB && { dob: ownerDOB })
						});
					}
				});
			}
			const service = await getBusinessEntityVerificationService(body.business_id);
			await service.updateBusinessEntityDetails({ businessID: body.business_id }, { people: peopleData });
		} catch (error: any) {
			logger.error(error, `Error submitting owners for watchlist screening for business ${body.business_id}`);
			throw error;
		}
	}
}
