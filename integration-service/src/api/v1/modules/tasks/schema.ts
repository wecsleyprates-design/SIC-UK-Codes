import { INTEGRATION_CATEGORIES, INTEGRATION_ID, SCORE_TRIGGER, TASK_STATUS, TaskCodeEnum } from "#constants";
import { joiExtended as Joi } from "#helpers/index";
import { TaskManager } from "./taskManager";

const needUuid = Joi.string().uuid().required();

export const schema = {
	tasksByBusinessId: {
		params: Joi.object({
			business_id: needUuid,
			task_status: Joi.string()
				.valid(...Object.keys(TASK_STATUS), "pending")
				.insensitive()
				.optional(),
			filter: Joi.string().optional()
		})
	},
	tasksByConnectionId: {
		params: Joi.object({
			connection_id: needUuid,
			task_status: Joi.string()
				.valid(...Object.keys(TASK_STATUS), "pending")
				.insensitive()
				.optional(),
			filter: Joi.string().optional()
		})
	},
	taskId: {
		params: Joi.object({
			task_id: needUuid
		})
	},
	getTasks: {
		query: Joi.object({
			orderBy: Joi.string().valid("created_at", "updated_at", "id").insensitive(),
			orderDirection: Joi.string().valid("asc", "desc").insensitive(),
			page: Joi.number().integer().min(1).optional(),
			limit: Joi.number().integer().min(1).max(TaskManager.PAGE_SIZE).optional(),
			id: needUuid.optional(),
			platform_id: Joi.number()
				.integer()
				.min(1)
				.max(Object.keys(INTEGRATION_ID).length + 1)
				.optional(),
			platform_code: Joi.string()
				.valid(...Object.keys(INTEGRATION_ID))
				.insensitive()
				.optional(),
			platform_category_code: Joi.string()
				.valid(...Object.keys(INTEGRATION_CATEGORIES))
				.insensitive()
				.optional(),
			platform_category_id: Joi.number()
				.integer()
				.min(1)
				.max(Object.keys(INTEGRATION_CATEGORIES).length + 1)
				.optional(),
			task_code: Joi.string()
				.valid(...Object.keys(TaskCodeEnum))
				.insensitive()
				.optional(),
			reference_id: Joi.string().min(1).max(100).optional(),
			trigger_type: Joi.string()
				.valid(...Object.keys(SCORE_TRIGGER))
				.insensitive()
				.optional(),
			business_score_trigger_id: Joi.string().uuid().optional(),
			task_status: Joi.string()
				.valid(...Object.keys(TASK_STATUS), "pending")
				.insensitive()
				.optional(),
			filter: Joi.string().optional()
		}).optional(),
		params: Joi.object({
			business_id: Joi.string().uuid(),
			connection_id: Joi.string().uuid(),
			task_status: Joi.string()
				.valid(...Object.keys(TASK_STATUS), "pending")
				.insensitive()
				.optional()
		}).xor("business_id", "connection_id")
	},
	generateAndExecuteTaskForBusiness: {
		params: Joi.object({
			business_id: needUuid,
			platformCode: Joi.string()
				.valid(...Object.keys(INTEGRATION_ID))
				.insensitive(),
			taskCode: Joi.string()
				.valid(...Object.keys(TaskCodeEnum))
				.insensitive()
		}),
		query: Joi.object({
			// For a deferrable task, this will skip the worker and run the task immediately
			runNow: Joi.boolean().optional()
		}).optional(),
		body: Joi.object({
			reference_id: Joi.string().optional(),
			metadata: Joi.object().optional(),
			score_trigger_id: Joi.string().uuid().optional()
		})
	},
	getBusinessCompletion: {
		params: Joi.object({
			business_id: needUuid
		})
	}
};
