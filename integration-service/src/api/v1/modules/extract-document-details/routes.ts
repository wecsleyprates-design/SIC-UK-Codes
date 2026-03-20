import { methodNotAllowed, validatePurgedBusiness, validateTypedSchema, validateUser } from "#middlewares/index";
import { externalUploadMiddleware } from "#middlewares/upload.middleware";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";

const router = Router();

router
	.route("/extract-document-details")
	.post(validateUser, validateTypedSchema(schema.submitDocumentsForExtraction), api.submitDocumentsForExtraction)
	.all(methodNotAllowed);

router
	.route("/extract/:businessID/verification-details")
	.post(
		validateUser,
		externalUploadMiddleware("file"),
		validateTypedSchema(schema.extractFileDetails),
		validatePurgedBusiness,
		api.submitFileForDetailsExtraction
	)
	.all(methodNotAllowed);

router
	.route("/business/:businessID/extracted-verification-uploads")
	.get(
		validateUser,
		validateTypedSchema(schema.getVerificationUploads),
		validatePurgedBusiness,
		api.getVerificationDetails
	)
	.all(methodNotAllowed);
router
	.route("/business/:businessID/verification-file-uploaded/:verificationUploadID")
	.get(
		validateUser,
		validateTypedSchema(schema.getVerificationUpload),
		validatePurgedBusiness,
		api.getVerificationUpload
	)
	.all(methodNotAllowed);
// get s3 link for webhook event
router
	.route("/internal/businesses/:businessID/verification-uploads/")
	.get(validatePurgedBusiness, api.getVerificationUploadsForBusiness)
	.all(methodNotAllowed);

module.exports = router;
