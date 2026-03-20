import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getDocuments: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			caseID: Joi.string().uuid().optional()
		})
	},
	downloadDocument: {
		query: Joi.object({
			file_name: Joi.string().required(),
			file_path: Joi.string().required()
		})
	}
};
