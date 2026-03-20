import { envConfig } from "#configs";
import * as AWS from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { type FileUploadEvent } from "./";

export abstract class FileHandler {
	protected readonly MAX_ROWS = 1000;
	protected client: AWS.S3Client;
	protected bucketName: string;
	protected fileKey: string;
	protected eventName: string;

	protected parseErrors = new Array<{ rowNumber: number; error: string; row: string[] }>();
	protected parseWarnings = new Array<{ rowNumber: number; warning: string; row: string[] }>();

	constructor(event: FileUploadEvent) {
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
		this.bucketName = event.bucketName;
		this.fileKey = event.fileKey;
		this.eventName = event.eventName;
	}

	static async processEvent(event: FileUploadEvent): Promise<void> {
		throw new Error("Process event method not implemented.");
	}

	public getFileKey = () => this.fileKey;
	public getEventName = () => this.eventName;
	public getBucketName = () => this.bucketName;

	public getObjectAsStream = async (file: string): Promise<Readable> => {
		const command = new AWS.GetObjectCommand({
			Bucket: this.getBucketName(),
			Key: file
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
	};

	protected async copyObject(oldKey, newKey): Promise<void> {
		const copyCommand = new AWS.CopyObjectCommand({
			Bucket: this.bucketName,
			Key: newKey,
			CopySource: `${this.bucketName}/${oldKey}`
		});
		const copyResponse = await this.client.send(copyCommand);
		if (!copyResponse.CopyObjectResult) {
			throw new Error(`Error copying ${oldKey} to new ${newKey}`);
		}
	}

	protected async deleteObject(key): Promise<void> {
		const deleteCommand = new AWS.DeleteObjectCommand({
			Bucket: this.bucketName,
			Key: key
		});
		const deleteResponse = await this.client.send(deleteCommand);
		if (!deleteResponse.$metadata.httpStatusCode?.toString().startsWith("2")) {
			throw new Error(`Error deleting object ${key}`);
		}
	}

	protected async renameObject(oldKey, newKey): Promise<void> {
		await this.renameObject(oldKey, newKey);
		await this.deleteObject(oldKey);
	}

	public static hasExtension(fileName: string, extension): boolean {
		return fileName.endsWith(`.${extension}`);
	}
}
