import { getBusinessDetails } from "#helpers/api";
import { toYMD } from "#utils";

export const fetchBusinessDetailsPeople = async (
	businessID: string
): Promise<{ name: string; dob?: string }[] | undefined> => {
	const businessDetails = await getBusinessDetails(businessID);
	if (businessDetails?.status === "success" && businessDetails?.data?.owners)
		return businessDetails.data.owners.map(owner => ({
			name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(),
			dob: toYMD(owner.date_of_birth) ?? undefined
		}));
};
