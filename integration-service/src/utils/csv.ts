import csv from "csv-parser";
import { Readable } from "stream";
import { createReadStream } from "fs";

export async function convertCsvToJson<T = any>(csvString: string): Promise<T[]> {
	return new Promise((resolve, reject) => {
		const results: T[] = [];
		const stream = Readable.from([csvString]);
		
		stream
			.pipe(csv({ separator: "," }))
			.on('data', (data) => results.push(data))
			.on('end', () => resolve(results))
			.on('error', (error) => reject(error));
	});
}

export async function convertFileToJson<T = any>(filePath: string): Promise<T[]> {
	return new Promise((resolve, reject) => {
		const results: T[] = [];
		
		createReadStream(filePath)
			.pipe(csv({ separator: "," }))
			.on('data', (data) => results.push(data))
			.on('end', () => resolve(results))
			.on('error', (error) => reject(error));
	});
}
