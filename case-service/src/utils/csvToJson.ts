import csv from "csvtojson";
import { Readable } from "stream";
import csvParser from "csv-parser";

export async function convertCsvToJson(csvString: string): Promise<any[]> {
	const json = await csv({ delimiter: "," }).fromString(csvString);
	return json.map(row => trimKeys(row));
}

const trimKeys = (obj: Record<string, any>) => {
	const cleaned: Record<string, any> = {};
	Object.keys(obj).forEach(key => {
		cleaned[key.trim()] = obj[key];
	});
	return cleaned;
};

export async function convertFileToJson(filePath?: string, fileBuffer?: string): Promise<any[]> {
	return new Promise((resolve, reject) => {
		const results: any[] = [];
		console.debug(fileBuffer);
		if (fileBuffer) {
			// Process buffer as a stream
			const stream = Readable.from(fileBuffer);

			stream
				.pipe(csvParser({ separator: "," }))
				.on("data", data => results.push(trimKeys(data)))
				.on("end", () => resolve(results))
				.on("error", error => reject(error));
		} else if (filePath) {
			// Process file path
			csv({ delimiter: "," })
				.fromFile(filePath)
				.then(json => resolve(json.map(row => trimKeys(row))));
		} else {
			reject(new Error("No file path or buffer provided"));
		}
	});
}
