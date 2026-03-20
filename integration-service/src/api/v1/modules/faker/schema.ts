import { joiExtended as Joi } from "#helpers/index";

const needUuid = Joi.string().uuid().required();

export const schema = {
  accounting: { params: Joi.object({ business_id: needUuid }), },

  places: { params: Joi.object({ business_id: needUuid }), },

  plaid_data: { params: Joi.object({ business_id: needUuid }), },

  google_business: { params: Joi.object({ business_id: needUuid }), },

  tax_filing: { params: Joi.object({ business_id: needUuid }), },

  verdata: { params: Joi.object({ business_id: needUuid }), },
};
