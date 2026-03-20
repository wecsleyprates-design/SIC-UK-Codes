import { validatePurgedBusinessHelper } from "#helpers";
import { decodeInvitationToken } from "#utils";

export const validatePurgedBusiness = async (req, res, next) => {
	try {
		const businessID =
			req?.params?.businessID || req?.params?.business_id || req?.params?.businessId || req?.body?.business_id || null;

		if (businessID) {
			await validatePurgedBusinessHelper(businessID);
		}

		const token = req?.params?.inviteToken || req?.params?.invitationToken || req?.params?.requestToken;

		if (token) {
			const tokenData = await decodeInvitationToken(token);
			await validatePurgedBusinessHelper(tokenData.business_id);
		}

		const caseID = req?.params?.caseID || req?.params?.case_id || req?.params?.caseId || req?.body?.case_id || null;

		if (caseID) {
			await validatePurgedBusinessHelper(null, caseID);
		}

		return next();
	} catch (error) {
		return next(error);
	}
};
