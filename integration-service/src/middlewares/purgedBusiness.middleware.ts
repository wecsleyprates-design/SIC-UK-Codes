import { validatePurgedBusinessHelper } from "#helpers";

export const validatePurgedBusiness = async (req, res, next) => {
	try {
		if (req?.params?.businessID) {
			await validatePurgedBusinessHelper(req.params.businessID);
		}

		if (req?.params?.business_id) {
			await validatePurgedBusinessHelper(req.params.business_id);
		}

		if (req?.body?.business_id) {
			await validatePurgedBusinessHelper(req.body.business_id);
		}
		return next();
	} catch (error) {
		return next(error);
	}
};
