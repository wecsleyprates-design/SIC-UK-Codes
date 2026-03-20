import { Router } from "express";
const router = Router();
import { methodNotAllowed, validateRole, validateSchema, validateUser } from "#middlewares/index";
import { controller as api } from "./controller";
import { ROLES } from "#constants/roles.constant";
import { schema } from "./schema";

router.route("/queues").get(validateUser, validateRole(ROLES.ADMIN), api.getAllQueues).all(methodNotAllowed);
router
	.route("/queues/:queueName")
	.delete(validateUser, validateRole(ROLES.ADMIN), api.resetStats)
	.all(methodNotAllowed);
router
	.route("/queues/job/:jobID")
	.get(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.getJobByID), api.getJobByID)
	.all(methodNotAllowed);
router
	.route("/queues/request/:requestID")
	.get(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.getJobsByRequestID), api.getJobsByRequestID)
	.all(methodNotAllowed);
router
	.route("/queues/remove/:queueName/:jobID")
	.delete(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.removeJobByID), api.removeJobByID)
	.all(methodNotAllowed);
router
	.route("/queues/remove/:queueName")
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.removeAllJobsByQueueName),
		api.removeAllJobsByQueueName
	)
	.all(methodNotAllowed);
router
	.route(["/queues/stalled", "/queues/stalled/:queueName"])
	.get(validateUser, validateRole(ROLES.ADMIN), api.getStalledCounts)
	.all(methodNotAllowed);
router
	.route("/queues/stalled/:queueName/:jobID")
	.get(validateUser, validateRole(ROLES.ADMIN), api.getJobStalledStats)
	.all(methodNotAllowed);
module.exports = router;
