import { methodNotAllowed, validatePurgedBusiness, validateTypedSchema, validateUser } from "#middlewares/index";
import { externalUploadMiddleware, externalUploadMultipleMiddleware } from "#middlewares/upload.middleware";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";

const router = Router();

router
	.route("/businesses/:businessID/process-document/:documentType")
	.post(validateUser, externalUploadMiddleware("file"), validateTypedSchema(schema.parseDocument), validatePurgedBusiness, api.parseDocument)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/process-document/:documentType")
	.post(externalUploadMiddleware("file"), validateTypedSchema(schema.parseDocument), validatePurgedBusiness, api.parseDocument)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/process-bulk-documents/:documentType")
	.post(validateUser, externalUploadMultipleMiddleware("files"), validateTypedSchema(schema.parseBulkDocuments), validatePurgedBusiness, api.parseBulkDocuments)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/process-bulk-documents/:documentType")
	.post(externalUploadMultipleMiddleware("files"), validateTypedSchema(schema.parseBulkDocuments), validatePurgedBusiness, api.parseBulkDocuments)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/validate-document-type/:documentType")
	.post(validateUser, externalUploadMiddleware("file"), validateTypedSchema(schema.parseDocument), validatePurgedBusiness, api.validateDocumentType)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/validate-document-type/:documentType")
	.post(externalUploadMiddleware("file"), validateTypedSchema(schema.parseDocument), validatePurgedBusiness, api.validateDocumentType)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/validate-bulk-document-types/:documentType")
	.post(validateUser, externalUploadMultipleMiddleware("files"), validateTypedSchema(schema.parseBulkDocuments), validatePurgedBusiness, api.validateBulkDocumentTypes)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/validate-bulk-document-types/:documentType")
	.post(externalUploadMultipleMiddleware("files"), validateTypedSchema(schema.parseBulkDocuments), validatePurgedBusiness, api.validateBulkDocumentTypes)
	.all(methodNotAllowed);

router.route("/jobs/ocr-document/:jobId").get(validateUser, validateTypedSchema(schema.getJobStatus), api.getJobStatus).all(methodNotAllowed);

router.route("/internal/jobs/ocr-document/:jobId").get(validateTypedSchema(schema.getJobStatus), api.getJobStatus).all(methodNotAllowed);

router.route("/businesses/:businessID/document-validations").get(validateUser, validateTypedSchema(schema.getBusinessDocumentValidations), validatePurgedBusiness, api.getBusinessDocumentValidations).all(methodNotAllowed);
router.route("/internal/businesses/:businessID/document-validations").get(validateTypedSchema(schema.getBusinessDocumentValidations), validatePurgedBusiness, api.getBusinessDocumentValidations).all(methodNotAllowed);

router.route("/businesses/:businessID/document-extractions").get(validateUser, validateTypedSchema(schema.getBusinessDocumentExtractions), validatePurgedBusiness, api.getBusinessDocumentExtractions).all(methodNotAllowed);
router.route("/internal/businesses/:businessID/document-extractions").get(validateTypedSchema(schema.getBusinessDocumentExtractions), validatePurgedBusiness, api.getBusinessDocumentExtractions).all(methodNotAllowed);

router.route("/businesses/:businessID/document-uploaded/:jobType").get(validateUser, validateTypedSchema(schema.getDocumentUpload), validatePurgedBusiness, api.getDocumentUpload).all(methodNotAllowed);
router.route("/internal/businesses/:businessID/document-uploaded/:jobType").get(validateTypedSchema(schema.getDocumentUpload), validatePurgedBusiness, api.getDocumentUpload).all(methodNotAllowed);

module.exports = router;
