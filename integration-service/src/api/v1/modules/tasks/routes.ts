import {
	methodNotAllowed,
	validateDataPermission,
	validatePurgedBusiness,
	validateRole,
	validateSchema,
	validateUser
} from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";
const router = Router();

/* Task Routes */

router
	.route("/tasks/business/:business_id/completion")
	.get(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.getBusinessCompletion), api.getBusinessCompletion)
	.all(methodNotAllowed);

router
	.route("/tasks/connection/:connection_id/:task_status")
	.get(validateUser, validateSchema(schema.getTasks), api.getTasks)
	.post(validateUser, validateSchema(schema.tasksByConnectionId), api.processPendingTasksForConnection)
	.all(methodNotAllowed);
router
	.route("/tasks/business/:business_id/:task_status")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getTasks),
		validatePurgedBusiness,
		api.getTasks
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.tasksByBusinessId),
		validatePurgedBusiness,
		api.processPendingTasksForBusiness
	)
	.all(methodNotAllowed);

router
	.route("/tasks/business/:business_id/platform/:platformCode/:taskCode")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.generateAndExecuteTaskForBusiness),
		validatePurgedBusiness,
		api.generateAndExecuteTaskForBusiness
	)
	.all(methodNotAllowed);

router
	.route(["/tasks/business/:business_id/", "/tasks/connection/:connection_id/"])
	.get(validateUser, validateSchema(schema.getTasks), validatePurgedBusiness, api.getTasks)
	.all(methodNotAllowed);

router
	.route("/tasks/:task_id/process")
	.post(validateUser, validateSchema(schema.taskId), api.processTask)
	.all(methodNotAllowed);
router.route("/tasks/:task_id").get(validateUser, validateSchema(schema.taskId), api.getTaskById).all(methodNotAllowed);

module.exports = router;
