import type { Request } from "express";
import { convertCsvToJson, convertFileToJson } from "#utils/csvToJson";
import { BulkCreateBusinessMap } from "../maps/bulkCreateBusinessMap";
import { BulkUpdateBusinessMap } from "../maps/bulkUpdateBusinessMap";
import type { Mapper } from "../mapper";

export const parseBulkProcessBody = async (req: Request) => {
	const contentType = req.get("content-type") ?? "";
	let { body } = req;
	if (body && contentType.startsWith("text")) {
		body = await convertCsvToJson(body);
	} else if (req.file?.path) {
		// Convert the uploaded file to JSON
		body = await convertFileToJson(req.file.path);
	}
	return body;
};

export const normalizeBulkRows = (body: Array<Record<string, any>>) =>
	body.map(row => {
		const cleanedRow: Record<string, any> = {};
		for (const key in row) {
			if (typeof row[key] === "string" && row[key].trim() !== "") {
				cleanedRow[key] = row[key].trim();
			} else if (typeof row[key] === "number" && !isNaN(row[key])) {
				cleanedRow[key] = row[key];
			} else if (typeof row[key] === "boolean" && [true, false].includes(row[key])) {
				cleanedRow[key] = row[key];
			} else if (typeof row[key] === "object" && Object.keys(row[key] ?? {}).length > 0) {
				cleanedRow[key] = row[key];
			} else if (row[key] === null) {
				cleanedRow[key] = null;
			}
		}
		return cleanedRow;
	});

export const initMapper = (input: Map<string, any>, mode: "create" | "update", runId?: string): Mapper => {
	if (mode === "create") {
		return new BulkCreateBusinessMap(input, runId);
	} else if (mode === "update") {
		return new BulkUpdateBusinessMap(input, runId);
	} else {
		throw new Error("invalid mode");
	}
};
