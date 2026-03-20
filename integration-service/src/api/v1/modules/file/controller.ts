import { envConfig } from "#configs";
import { kafkaEvents, kafkaTopics, ROLES } from "#constants";
import { internalValidateCustomerBusiness } from "#helpers/api";
import { producer } from "#helpers/kafka";
import { BulkImportFileHandler, type FileUploadEvent, type IFileUpload } from "#lib/fileHandler";
import type { Response } from "#types/index";
import { catchAsync } from "#utils/catchAsync";
import { AxiosError } from "axios";
import type { UUID } from "crypto";
import type { NextFunction, Request } from "express";
import { FileUpload } from "./models/fileUpload";
import { getCachedSignedUrl, isUUID } from "#utils";
import { redis, updateAuthRedisCache } from "#helpers";

export const controller = {
	produceMessage: catchAsync(async (req: Request, res: Response) => {
		const { fileId } = req.params;
		if (fileId && !isUUID(fileId)) {
			return res.jsend.fail("Invalid file id", null, 400);
		}
		if (fileId) {
			const file = await FileUpload.getById(fileId as UUID);
			if (!file) {
				return res.jsend.fail("File not found", null, 404);
			}
			const { s3_bucket, s3_key, file_size } = file.getRecord();
			const payload = {
				topic: kafkaTopics.INTEGRATIONS,
				messages: [
					{
						key: s3_key?.toString() ?? "",
						value: {
							event: kafkaEvents.S3_FILE,
							eventName: "ObjectCreated:Put",
							bucketName: s3_bucket ?? "",
							fileKey: s3_key ?? "",
							fileSize: file_size ?? 0
						}
					}
				]
			};
			await producer.send(payload);
			return res.jsend.success({ message: `File event triggered for fileId ${fileId}` });
		}
		const { eventName, bucketName, fileKey, fileSize }: FileUploadEvent = req.body;
		const payload = {
			topic: kafkaTopics.INTEGRATIONS,
			messages: [
				{
					key: fileKey ?? "",
					value: {
						event: kafkaEvents.S3_FILE,
						eventName: eventName ?? "",
						bucketName: bucketName ?? "",
						fileKey: fileKey ?? "",
						fileSize: fileSize ?? 0
					}
				}
			]
		};
		await producer.send(payload);
		res.jsend.success({ message: "File event triggered" });
	}),
	getFiles: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const { customerId, userId, businessId } = req.params;
		const { page } = req.query;
		let query: Partial<IFileUpload>;
		if (customerId) {
			query = { customer_id: customerId as UUID };
		} else if (businessId) {
			query = { business_id: businessId as UUID };
		} else if (userId) {
			query = { created_by: userId as UUID };
		} else {
			throw new Error("Invalid request");
		}
		const pageNumber = parseInt(page?.toString() ?? "0");
		const [data, pagination] = await FileUpload.findByField(query, { page: pageNumber });
		(req as any).paginate = [FileUpload.unwrap(data), pagination];
		next();
	}),
	getFile: catchAsync(async (req: Request, res: Response) => {
		const { fileId } = req.params;
		if (!isUUID(fileId)) {
			return res.jsend.fail("Invalid file id", null, 400);
		}
		const file = (await FileUpload.getById(fileId)).toApiResponse();
		return res.jsend.success({ ...file, message: "File retrieved successfully" });
	}),
	downloadFile: catchAsync(async (req: Request, res: Response) => {
		const { fileId } = req.params;
		if (!isUUID(fileId)) {
			return res.jsend.fail("Invalid file id", null, 400);
		}
		const file = await FileUpload.getById(fileId);
		if (!file) {
			return res.jsend.fail("File not found", null, 404);
		}
		const { s3_bucket, s3_key, file_name } = file.getRecord();
		if (!s3_bucket || !s3_key) {
			return res.jsend.fail("File not found", null, 404);
		}
		res.setHeader("Content-Disposition", `attachment; filename=${file_name}`);
		res.setHeader("Content-Type", file.getRecord().mime_type ?? "application/octet-stream");
		const stream = await file.getAsStream();
		stream.pipe(res);
	}),
	uploadCustomerFile: catchAsync(async (req: Request, res: Response) => {
		const { file } = req;
		const { customerId } = req.params;
		const { AWS_CUSTOMER_UPLOAD_BUCKET, AWS_CUSTOMER_UPLOAD_KEY_PREFIX } = envConfig;

		const errors = [] as string[];
		if (!file) {
			return res.jsend.fail("File not found", null, 404);
		}
		try {
			const pushThenThrow = (error: string) => {
				errors.push(error);
				throw new Error(error);
			};
			if (!AWS_CUSTOMER_UPLOAD_BUCKET) {
				pushThenThrow(`Need configuration for AWS_CUSTOMER_UPLOAD_BUCKET`);
			}
			if (!isUUID(customerId)) {
				pushThenThrow("Invalid customer id");
			}
			const path = `${AWS_CUSTOMER_UPLOAD_KEY_PREFIX ? AWS_CUSTOMER_UPLOAD_KEY_PREFIX + "/" : ""}${customerId}/UPLOADS/${file.originalname}`;

			const checkFileExists = await FileUpload.getByBucketAndKey(AWS_CUSTOMER_UPLOAD_BUCKET ?? "", path);
			if (checkFileExists) {
				pushThenThrow("File already exists -- Please upload with a new name");
			}
			const fileUpload = await FileUpload.create({
				file_name: file.originalname,
				file_size: file.size,
				mime_type: file.mimetype,
				customer_id: customerId as UUID,
				s3_bucket: AWS_CUSTOMER_UPLOAD_BUCKET,
				s3_key: path,
				created_by: res.locals?.user?.user_id as UUID
			});
			const awsResponse = await fileUpload.uploadFile(file.path, AWS_CUSTOMER_UPLOAD_BUCKET ?? "", path);
			const currentMetadata = (fileUpload.getRecord().metadata as {}) ?? {};
			await fileUpload.setS3Info(AWS_CUSTOMER_UPLOAD_BUCKET, path, { ...currentMetadata, s3: awsResponse });
			await FileUpload.deleteLocalFile(file);
			return res.jsend.success({ ...fileUpload.toApiResponse(), message: "File uploaded successfully" });
		} catch (ex) {
			await FileUpload.deleteLocalFile(file);
			if (errors.length) {
				res.jsend.fail(errors.join(", "), null, 400);
			} else {
				res.jsend.fail("An unknown error occurred", null, 500);
			}
		}
	}),
	getBusinessImportStatus: catchAsync(async (req: Request, res: Response) => {
		const { fileId } = req.params;
		if (!fileId || !isUUID(fileId)) {
			return res.jsend.fail("Invalid file id", null, 400);
		}
		const file = await BulkImportFileHandler.getById(fileId);
		return res.jsend.success({ ...file, message: "File status retrieved successfully" });
	}),
	bulkBusinessValidateMappings: catchAsync(async (req: Request, res: Response) => {
		const { fileId } = req.params;
		if (!fileId || !isUUID(fileId)) {
			return res.jsend.fail("Invalid file id", null, 400);
		}
		const file = await FileUpload.getById(fileId);
		if (!file) {
			return res.jsend.fail("File not found", null, 404);
		}
		const record = file.getRecord();
		if (!record.customer_id || !record.s3_bucket || !record.s3_key) {
			return res.jsend.fail("File not valid", null, 404);
		}
		if (!record.mime_type || record.mime_type !== "text/csv") {
			return res.jsend.fail("File must be a CSV", null, 400);
		}
		const stream = await file.getAsStream();
		const handler = new BulkImportFileHandler(
			{
				eventName: "dummy",
				bucketName: record.s3_bucket ?? "",
				fileKey: record.s3_key ?? "",
				fileSize: record.file_size
			},
			""
		);

		// Load the first 3 lines of the file
		await handler.loadCSVData(stream, 3);
		const validationRequest = handler.getLinesWithHeaders() as string[];
		try {
			const response = await internalValidateCustomerBusiness(record.customer_id as UUID, validationRequest);
			res.jsend.success({ ...response, message: "Validation request successful" });
		} catch (error) {
			if (error instanceof AxiosError) {
				res.jsend.success(error.response?.data, "Some validation errors received");
			} else {
				res.jsend.error(error);
			}
		}
	}),
	bulkBusinessImport: catchAsync(async (req: Request, res: Response) => {
		const { fileId } = req.params;
		if (!fileId || !isUUID(fileId)) {
			return res.jsend.fail("Invalid file id", null, 400);
		}
		const file = await FileUpload.getById(fileId);
		if (!file) {
			return res.jsend.fail("File not found", null, 404);
		}
		const record = file.getRecord();
		if (!record.customer_id || !record.s3_bucket || !record.s3_key) {
			return res.jsend.fail("File not valid", null, 404);
		}
		if (!record.mime_type || record.mime_type !== "text/csv") {
			return res.jsend.fail("File must be a CSV", null, 400);
		}
		const newKey = record.s3_key.replace("/UPLOADS/", `/${BulkImportFileHandler.DROPBOX_FOLDER}/`);
		const checkFileExists = await FileUpload.getByBucketAndKey(record.s3_bucket, newKey);
		if (checkFileExists) {
			return res.jsend.fail(
				"File has already been scheduled for processing with another file",
				checkFileExists.toApiResponse(),
				400
			);
		}
		const newFile = await file.copyObject(newKey, true);
		res.jsend.success({ ...newFile.toApiResponse(), message: "Processing scheduled with new fileId" });
	}),
	getWebsiteScreenshotSignedUrl: catchAsync(async (req: Request, res: Response) => {
		const { key } = req.query;
		try {
			const keyStr = (key as string) ?? "";
			const businessId = keyStr.split("/")[0] ?? "";
			const { customer_id, role } = res.locals.user ?? {};
			const isUserAdmin = role?.code === ROLES.ADMIN;
			
		/*
		* Check if the businessID is in the Redis set for this customer. 
		* If the user is not an admin, they must be a customer of the business.
		* If the business is not found in Redis, refresh the cache and check again
		* to avoid false negatives when the cache is stale (e.g., newly-associated businesses).
		*/
		if (!isUserAdmin) {
			const redisKey = `{customer}:${customer_id}:businesses`;
			let access = await redis.sismember(redisKey, businessId);
			
			if (!access) {
				// If access is false, refresh cache and check again.
				await updateAuthRedisCache(customer_id);
				access = await redis.sismember(redisKey, businessId);
			}
			
			if (!access) {
				return res.jsend.fail("You are not allowed to access this file", null, 403);
			}
		}
			const signedUrl = await getCachedSignedUrl(keyStr, "", envConfig.AWS_WEBSITE_SCREENSHOT_BUCKET);

			res.jsend.success({ url: signedUrl.signedRequest }, "Signed URL fetched successfully.");
		} catch (error) {
			throw new Error(`Failed to generate signed URL: ${error}`);
		}
	})
};
