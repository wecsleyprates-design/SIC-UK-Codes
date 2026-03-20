import { ROLES } from "#constants";
import { methodNotAllowed, paginate, uploadMiddleware, validatePurgedBusiness, validateRole, validateSchema, validateUser } from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";
const router = Router();

router.route("/file/website-screenshot").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), api.getWebsiteScreenshotSignedUrl).all(methodNotAllowed);

/* Admin / Debug Routes */
router.route("/file/:fileId/produce-message").post(validateUser, validateRole(ROLES.ADMIN), api.produceMessage).all(methodNotAllowed);

/* Task Routes */

router.route("/file/:fileId").get(validateUser, validateSchema(schema.fileId), validateRole(ROLES.ADMIN, ROLES.CUSTOMER), api.getFile).all(methodNotAllowed);
router.route("/file/:fileId/download").get(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.fileId), api.downloadFile).all(methodNotAllowed);
router.route("/file/customer/:customerId").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), api.getFiles, paginate).all(methodNotAllowed);
router.route("/file/business/:businessId").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validatePurgedBusiness, api.getFiles, paginate).all(methodNotAllowed);
router.route("/file/user/:userId").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), api.getFiles, paginate).all(methodNotAllowed);

router
	.route("/file/:fileId/execute/bulk-business-import")
	.post(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.fileId), api.bulkBusinessImport)
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.fileId), api.getBusinessImportStatus)
	.all(methodNotAllowed);
router
	.route("/file/:fileId/execute/bulk-business-validation")
	.post(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.fileId), api.bulkBusinessValidateMappings)
	.all(methodNotAllowed);

/* Upload a file flagged to customer scope */
router
	.route("/file/upload/customer/:customerId")
	.post(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.customerId), uploadMiddleware("file"), api.uploadCustomerFile)
	.all(methodNotAllowed);

module.exports = router;
