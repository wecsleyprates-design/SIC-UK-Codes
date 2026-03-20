import { joiExtended as Joi } from "#helpers/index";

const caseTabValuesParams = Joi.object({
	businessId: Joi.string().uuid().required(),
	caseId: Joi.string().uuid().required(),
});

export const schema = {
	getCaseTabValues: { params: caseTabValuesParams },
	acknowledgeCaseTabValues: { params: caseTabValuesParams },
};
