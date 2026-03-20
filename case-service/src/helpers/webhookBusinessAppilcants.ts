import { getBusinessApplicants } from "./api";
import { logger } from "./logger";
type businessApplicantsForWebhooks = {
	first_name: string;
	last_name?: string;
	email?: string;
};
type businessApplicantsList = businessApplicantsForWebhooks[];

export const getBusinessApplicantsForWebhooks = async (businessID): Promise<businessApplicantsList> => {
	const businessApplicants = await getBusinessApplicants(businessID);
	logger.info(`businessApplicants for ${businessID}: ${JSON.stringify(businessApplicants)}`);
	let filteredApplicants: Array<{ first_name: string; last_name: string; email: string }> = [];
	if (businessApplicants && businessApplicants.length) {
		filteredApplicants = businessApplicants.map(applicant => ({
			first_name: applicant.first_name,
			last_name: applicant.last_name,
			email: applicant.email
		}));
	}
	return filteredApplicants;
};
