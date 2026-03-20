import { envConfig } from "#configs";
import { logger } from "#helpers/logger";
import { BulkImportFileHandler } from "./bulkImportFileHandler";
import type { FileUploadEvent } from "./types";

export * from "./bulkImportFileHandler";
export * from "./fileHandler";
export * from "./types";

/* Route to the right implementation by bucket */
export const processEventByBucket = async (event: FileUploadEvent) => {
	const { bucketName } = event;
	const { AWS_CUSTOMER_UPLOAD_BUCKET } = envConfig;
	logger.info("Processing event by bucket: " + bucketName + " | " + AWS_CUSTOMER_UPLOAD_BUCKET);
	if (bucketName === AWS_CUSTOMER_UPLOAD_BUCKET) {
		await BulkImportFileHandler.processEvent(event);
	}
};
