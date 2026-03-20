import { Job, JobRequest } from "#api/v1/modules/jobs/models";
import { State } from "#api/v1/modules/jobs/types/job";
import { JobTrigger, JobType, type IJobRequestEnriched } from "#api/v1/modules/jobs/types/jobRequest";
import csv from "csv-parser";

import { FileUpload } from "#api/v1/modules/file/models/";
import { EVENTS, QUEUES } from "#constants";
import BullQueue from "#helpers/bull-queue";
import { logger } from "#helpers/logger";
import type { Unwrap } from "#types/eggPattern";
import type { UUID } from "crypto";
import type { Readable } from "stream";
import { type FileUploadEvent, type IFileUpload } from ".";
import { FileHandler } from "./fileHandler";
import { encryptData, isUUID } from "#utils";

/**
 * Properly escape and format a CSV value according to RFC 4180 standards
 * @param value - The value to format for CSV
 * @returns Properly escaped CSV value
 */
export function formatCsvValue(value: any): string {
	if (value === null || value === undefined) {
		return "";
	}

	const stringValue = String(value);

	// If the value contains comma, quote, or newline, it needs to be quoted
	if (
		stringValue.includes(",") ||
		stringValue.includes('"') ||
		stringValue.includes("\n") ||
		stringValue.includes("\r")
	) {
		// Escape any existing quotes by doubling them, then wrap in quotes
		return `"${stringValue.replace(/"/g, '""')}"`;
	}

	return stringValue;
}

/**
 * Convert an array of values to a properly formatted CSV row string
 * @param values - Array of values to convert to CSV row
 * @returns Properly formatted CSV row string
 */
export function formatCsvRow(values: any[]): string {
	return values.map(formatCsvValue).join(",");
}

type BulkImportFile = IFileUpload & {
	process_request_id: UUID | undefined;
	process_request: IJobRequestEnriched | undefined;
};

export class BulkImportFileHandler extends FileHandler {
	static readonly DROPBOX_FOLDER = "dropbox";
	static readonly VALIDATION_FOLDER = "validation";
	static readonly ERROR_FOLDER = "error";
	static readonly PROCESSED_FOLDER = "processed";

	protected headers: string = "";
	protected lines: string[] = [];
	protected validateRequest: JobRequest | undefined;
	protected processRequest: JobRequest | undefined;
	protected customerID: UUID | undefined;
	protected currentKey: string;

	constructor(
		event: FileUploadEvent,
		protected customerPath: string
	) {
		super(event);
		this.customerPath = customerPath;
		this.currentKey = this.fileKey;
	}

	static async processEvent(event: FileUploadEvent): Promise<void> {
		// Inspect the fileKey to see if 1) it's a customer & 2) it has been placed in the dropbox folder
		logger.debug(`Processing event for key: ${event.fileKey}`);
		const directories = event.fileKey.split("/");
		if (event.fileKey.includes(`/${BulkImportFileHandler.DROPBOX_FOLDER}/`) && directories.length > 2) {
			if (BulkImportFileHandler.hasExtension(event.fileKey, "csv")) {
				// Seems to be in scope
				logger.debug(
					`Event is in scope for processing, file ends with csv & exists in the dropbox folder of a customer `
				);

				// Check to see if we have this file in our DB yet
				let existingFile: FileUpload | undefined = await FileUpload.getByBucketAndKey(event.bucketName, event.fileKey);
				if (existingFile?.getRecord().metadata?.process_request_id) {
					logger.debug(`File ${event.fileKey} is already associated with a bulk business creation request. Skipping.`);
					//return;
				}
				// Find index of directories that contain the dropbox folder
				const dropboxIndex = directories.indexOf(BulkImportFileHandler.DROPBOX_FOLDER);
				// Construct file path ending at dropboxIndex
				const customerPath = directories.slice(0, dropboxIndex).join("/");
				// Drop two levels -- see if there's a file called "customerID" in the dropbox folder
				const handler = new BulkImportFileHandler(event, customerPath);
				handler.customerID = existingFile?.getRecord().customer_id ?? (await handler.getCustomerID());

				if (!existingFile) {
					logger.debug(`File ${event.fileKey} does not exist in the DB yet. Creating record.`);
					existingFile = await handler.createFile(event, directories[directories.length - 1]);
				}
				await handler.loadCSVData(await handler.getObjectAsStream(event.fileKey));
				const queue = new BullQueue(QUEUES.JOB);
				const requestMetadata = {
					file_id: existingFile.toApiResponse().id,
					customer_id: handler.customerID,
					event: event
				};
				await handler.createJobRequests(requestMetadata);
				await existingFile.updateMetadata({
					process_request_id: handler.processRequest?.get().id,
					parsed_rows: handler.lines.length,
					headers: handler.headers
				});
				await handler.createJobs(queue, requestMetadata);

				// Move the file to the validation folder
				const newPath = `${customerPath}/bulkUploadFileHandler/${handler.processRequest?.getRecord()?.id ?? "jobs"}/validate.csv`;
				await handler.copyObject(event.fileKey, newPath);
			}
		}
	}

	public static async getById(fileId: Unwrap<IFileUpload>["id"]): Promise<BulkImportFile> {
		const file = await FileUpload.getById(fileId);
		if (!file) {
			throw new Error(`File with ID ${fileId} not found`);
		}
		const metadata = file.getRecord().metadata ?? {};
		const { process_request_id } = metadata;
		let process_request: IJobRequestEnriched | undefined;
		if (process_request_id) {
			process_request = (await JobRequest.getById(process_request_id).then(
				async request => await request.getEnriched()
			)) as IJobRequestEnriched;
		}
		return { ...file.toApiResponse(), process_request_id, process_request } as BulkImportFile;
	}

	protected async createFile(event: FileUploadEvent, fileName: string): Promise<FileUpload> {
		return FileUpload.create({
			s3_bucket: event.bucketName,
			s3_key: event.fileKey,
			customer_id: this.customerID,
			created_by: this.customerID as UUID, // Setting to be the customer since we don't know who uploaded it
			file_name: fileName,
			file_size: event.fileSize ?? 0,
			mime_type: "text/csv"
		});
	}

	protected async createJobRequests(requestMetadata: Record<string, any>): Promise<void> {
		this.processRequest = await JobRequest.create({
			customer_id: this.customerID,
			state: State.CREATED,
			type: JobType.BULK_BUSINESS_IMPORT,
			trigger: JobTrigger.FILE,
			created_by: this.customerID as UUID,
			metadata: requestMetadata
		});
	}
	/* Add each row as a job to the queue */
	protected async createJobs(queue: BullQueue, requestMetadata): Promise<void> {
		const request_id = this.processRequest?.getRecord()?.id;
		for await (let [index, row] of this.lines.entries()) {
			if (row) {
				const jobMetadata = {
					...requestMetadata,
					process_request_id: request_id,
					index,
					data: encryptData(row), // Encrypt data at rest, at times it may contain PII.
					headers: this.headers,
					_encrypted: true // Mark as encrypted since data is encrypted
				};

				const job = await Job.create({
					state: State.CREATED,
					customer_id: this.customerID,
					request_id: request_id as UUID,
					metadata: jobMetadata
				});
				const jobId = job.getRecord().id;
				await job.enqueue(queue, EVENTS.BUSINESS_IMPORT);
				logger.debug(`Enqueued job ${jobId} for row ${index}`);
			}
		}
	}

	public async loadCSVData(stream: Readable, rowLimit = 0): Promise<void> {
		let rows = 0;
		const maxRows = rowLimit ? rowLimit : await this.getMaximumRowsToRead();
		let headersSet = false;

		await new Promise<void>((resolve, reject) => {
			let resolved = false;

			const safeResolve = () => {
				if (!resolved) {
					resolved = true;
					resolve();
				}
			};

			const safeReject = (error: Error) => {
				if (!resolved) {
					resolved = true;
					reject(error);
				}
			};

			stream
				.pipe(csv({ separator: "," }))
				.on("headers", (headers: string[]) => {
					logger.debug(`Headers found in CSV: ${headers}`);
					this.headers = formatCsvRow(headers);
					headersSet = true;
				})
				.on("data", (row: any) => {
					if (rows < maxRows) {
						// If headers not set via 'headers' event, extract from first row
						if (!headersSet && rows === 0) {
							this.headers = formatCsvRow(Object.keys(row));
							headersSet = true;
							logger.debug(`Headers extracted from first row: ${this.headers}`);
						}

						// Convert row object to CSV line string
						const values = Object.values(row);
						const rowString = formatCsvRow(values);

						// Skip super short rows
						if (rowString.length < 3) {
							return;
						}
						logger.debug(`Got row ${rows} of ${maxRows}: ${rowString}`);
						rows++;
						this.lines.push(rowString);
					} else {
						// Max rows reached, stop processing
						logger.info(`Reached maximum rows limit: ${maxRows}`);
						stream.unpipe();
						stream.destroy();
						safeResolve();
						return;
					}
				})
				.on("end", () => {
					logger.info(`Read ${rows} rows from CSV`);
					stream.destroy();
					safeResolve();
				})
				.on("error", error => {
					logger.error({ error }, "Error reading CSV");
					stream.destroy();
					safeReject(error);
				});
		});
	}

	public getLines() {
		return this.lines;
	}
	public getHeaders() {
		return this.headers;
	}
	public getLinesWithHeaders(): string[] {
		return [this.headers, ...this.lines];
	}

	protected async getMaximumRowsToRead(): Promise<number> {
		return Promise.resolve(this.MAX_ROWS);
	}

	protected async getCustomerID(): Promise<UUID> {
		const directories = this.customerPath.split("/");
		const previousDirectory = directories[directories.length - 1];
		if (isUUID(previousDirectory)) {
			// If the previous directory is a UUID then it should be the customer ID
			return previousDirectory;
		}
		// Otherwise, see if there's a file called "customerID" at customerPath
		const customerIDFile = `${this.customerPath}/customerID`;
		try {
			const customerIDStream = await this.getObjectAsStream(customerIDFile);
			// Make sure we're trimming & only looking at the first word
			const customerId = await (await this.streamToString(customerIDStream)).trim().split(" ")[0];
			logger.debug(`Got customer ID from file at path ${customerIDFile} as ${customerId}`);
			if (isUUID(customerId)) {
				return customerId;
			}
			throw new Error(`Invalid customerID found in file at path ${customerIDFile}`);
		} catch (ex) {
			logger.error({ error: ex }, `Could not find customerID file at path ${customerIDFile}`);
			throw ex;
		}
	}
	private async streamToString(stream: Readable): Promise<string> {
		return new Promise((resolve, reject) => {
			const chunks: Uint8Array[] = [];
			stream.on("data", chunk => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
			stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
			stream.on("error", err => reject(err));
		});
	}
}
