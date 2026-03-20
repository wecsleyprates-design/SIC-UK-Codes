import { envConfig } from "#configs";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import { IFileUpload } from "#lib/fileHandler/types";
import type { Stored } from "#types/eggPattern";
import * as AWS from "@aws-sdk/client-s3";
import fs from "fs";
import { BaseModel } from "#models/baseModel";
import { Readable } from "stream";
export class FileUpload extends BaseModel<IFileUpload> {
	public static readonly TABLE = "files.uploads";
	public static readonly serializedFields: Record<string, any> = {};
	public REMOVE_COLUMNS = ["s3_bucket", "s3_key"] as unknown as keyof IFileUpload[];
	protected client: AWS.S3Client;
	constructor(record: Stored<IFileUpload>) {
		super(record);
		const { AWS_ACCESS_KEY_ID, AWS_ACCESS_KEY_SECRET, AWS_SES_REGION } = envConfig;
		if (!AWS_ACCESS_KEY_ID || !AWS_ACCESS_KEY_SECRET || !AWS_SES_REGION) {
			throw new Error("AWS credentials not found.");
		}
		this.client = new AWS.S3({
			region: AWS_SES_REGION,
			credentials: {
				accessKeyId: AWS_ACCESS_KEY_ID,
				secretAccessKey: AWS_ACCESS_KEY_SECRET
			}
		});
	}

	public async setS3Info(bucket, key, metadata): Promise<void> {
		this.update({ s3_bucket: bucket, s3_key: key, metadata, updated_at: new Date() });
	}

	public async setRequestInfo(requestId: string, parsedRows: number, headers: string[]): Promise<void> {
		const update = db.raw(`metadata || '{"request_id": "${requestId}"}' || '{"parsed_rows": ${parsedRows}}' || '{"headers": ${JSON.stringify(headers)}}'`);
		this.update({ metadata: update });
	}
	public async copyObject(newKey, createNewRecord = true): Promise<FileUpload> {
		const record = this.get();

		const copyCommand = new AWS.CopyObjectCommand({
			Bucket: record.s3_bucket,
			Key: newKey,
			CopySource: `${record.s3_bucket}/${record.s3_key}`
		});
		const copyResponse = await this.client.send(copyCommand);
		if (!copyResponse.CopyObjectResult) {
			throw new Error(`Error copying ${record.s3_key} to new ${newKey}`);
		}
		if (createNewRecord === true) {
			return FileUpload.create({
				s3_bucket: record.s3_bucket,
				file_name: record.file_name,
				file_size: record.file_size,
				mime_type: record.mime_type,
				created_by: record.created_by,
				customer_id: record.customer_id,
				business_id: record.business_id,
				metadata: { ...record.metadata, copyResponse: copyResponse.CopyObjectResult, copied_from: record.id },
				s3_key: newKey
			});
		}
		return this;
	}
	public async getAsStream(params?: { bucket?: string; file?: string }): Promise<Readable> {
		const command = new AWS.GetObjectCommand({
			Bucket: params?.bucket ?? this.get().s3_bucket,
			Key: params?.file ?? this.get().s3_key
		});
		const response = await this.client.send(command);
		if (!response?.Body) {
			throw new Error("File not found");
		}
		if (response.Body instanceof Readable) {
			// If Body is already a stream, return it directly
			return response.Body;
		} else if (response.Body instanceof Buffer || typeof response.Body === "string") {
			// If Body is a Buffer or a string, create a stream from it
			return Readable.from(response.Body);
		} else {
			throw new Error("Unsupported Body type returned by S3");
		}
	}

	public fileToStream(path: string): Readable {
		return fs.createReadStream(path);
	}

	/** Override of getSafe that removes non-whitelisted keys */
	public toApiResponse() {
		const allowedKeys = ["copied_from", "parsed_rows", "headers", "process_request_id"];
		const record = super.toApiResponse();
		for (const key in record.metadata) {
			if (!allowedKeys.includes(key)) {
				delete record.metadata[key];
			}
		}
		return record;
	}
	public async uploadFile(path: string, bucket: string, key: string): Promise<AWS.PutObjectCommandOutput> {
		const stream = this.fileToStream(path);
		return this.uploadStream(stream, bucket, key);
	}

	public async uploadStream(stream: Readable, bucket: string, key: string): Promise<AWS.PutObjectCommandOutput> {
		const params: AWS.PutObjectCommandInput = {
			Bucket: bucket,
			Key: key,
			Body: stream
		};

		const command = new AWS.PutObjectCommand(params);
		return this.client.send(command);
	}

	public static async getByBucketAndKey(bucket: string, key: string): Promise<FileUpload | undefined> {
		try {
			const paginatedResponse = await this.findByField({ s3_bucket: bucket, s3_key: key }, { page: 1, pageSize: 1 });
			const response = paginatedResponse[0];
			if (response?.[0]) {
				return response[0];
			}
		} catch (e: any) {
			logger.error(`Error fetching file by bucket and key: ${e.message ? e.message : e}`);
		}
	}

	public static async deleteLocalFile(file: Express.Multer.File): Promise<boolean> {
		fs.unlinkSync(file.path);
		return true;
	}
}
