import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";
import * as AWS from "@aws-sdk/client-s3";
import { SESClient, VerifyEmailAddressCommand, GetIdentityVerificationAttributesCommand } from "@aws-sdk/client-ses";
const { getSignedUrl: s3GetSignedUrl } = require("@aws-sdk/s3-request-presigner");
import { Readable } from "stream";
const tk = require("timekeeper");
const https = require("https");
const fs = require("fs");
const path = require("path");
const xlsx = require("node-xlsx");

const config = {
	region: envConfig.AWS_SES_REGION,
	credentials: { accessKeyId: envConfig.AWS_ACCESS_KEY_ID, secretAccessKey: envConfig.AWS_ACCESS_KEY_SECRET }
};

const client = new AWS.S3(config);

const ses = new SESClient(config);

const fileUrl = fileName => {
	return `https://${envConfig.AWS_ASSETS_BUCKET}.s3.${envConfig.AWS_REGION}.amazonaws.com/${fileName}`;
};

// round the time to the last 10-minute mark
const getTruncatedTime = () => {
	const currentTime = new Date();
	const d = new Date(currentTime);

	// rounding down time to 00:00 hours of current day
	d.setHours(Math.floor(d.getHours() / 24) * 24);
	d.setMinutes(0);
	d.setSeconds(0);
	d.setMilliseconds(0);

	return d;
};

export const uploadFile = async (file, fileName, fileType, directory) => {
	try {
		const params = {
			Bucket: envConfig.AWS_ASSETS_BUCKET,
			Key: `${directory}/${fileName}`,
			ContentType: fileType,
			Body: file.buffer
		};

		const command = new AWS.PutObjectCommand(params);
		const data = await client.send(command);
		data.fileName = fileName;
		return data;
	} catch (error) {
		logger.error(error);
		throw new Error(`Something went wrong while uploading file. Please try again.${error.message}`);
	}
};

export const getSignedUrl = async fileName => {
	try {
		const s3Params = { Bucket: `${envConfig.AWS_ASSETS_BUCKET}`, Key: fileName, Expires: 25200 };

		const url = await s3GetSignedUrl(client, new AWS.GetObjectCommand(s3Params), {
			expiresIn: 90000,
			signingRegion: envConfig.AWS_SES_REGION
		});
		const brokenKey = fileName.split("/");
		const [key] = brokenKey[brokenKey.length - 1].split(".");
		return { fileName: key, url };
	} catch (error) {
		logger.error(error);
		throw new Error(`Something went wrong while loading file ${error.message}. Please refresh.`);
	}
};

export const deleteFiles = (files, directory) => {
	return new Promise(resolve => {
		try {
			const deleteParam = { Bucket: `${envConfig.AWS_ASSETS_BUCKET}`, Delete: { Objects: [] } };

			files.forEach(file => {
				deleteParam.Delete.Objects.push({ Key: `${directory}/${file}` });
			});

			client.deleteObjects(deleteParam, (err, data) => {
				if (err) {
					resolve(null);
				} else {
					resolve(data);
				}
			});
		} catch (error) {
			logger.error({ error: error }, "Error in deleteFiles");
			resolve(null);
		}
	});
};

// cache-friendly signing
export const getCachedSignedUrl = async (fileName, directory, bucket = envConfig.AWS_ASSETS_BUCKET) => {
	try {
		let key = `${directory}/${fileName}`;
		if (fileName && !directory) {
			key = fileName; // If no directory, just use the file name
		}
		const s3Params = {
			Bucket: `${bucket}`, // No slashes here
			Key: key, // Path within the bucket
			Expires: 90000 // 25 hours in seconds
		};

		// Freeze time to ensure consistent signing
		const signedUrl = await tk.withFreeze(getTruncatedTime(), async () => {
			const command = new AWS.GetObjectCommand(s3Params);
			const url = await s3GetSignedUrl(client, command, { expiresIn: s3Params.Expires });
			return url;
		});

		return { fileName, signedRequest: signedUrl, url: fileUrl(fileName) };
	} catch (error) {
		logger.error({ error: error }, "Error in getCachedSignedUrl");
		throw new Error("Something went wrong while loading the file. Please refresh.");
	}
};

export const getFile = async ({ fileName }) => {
	const params = { Bucket: envConfig.AWS_ASSETS_BUCKET, Key: fileName };
	const command = new AWS.GetObjectCommand(params);
	const res = await client.send(command);
	return res.Body;
};

export const getFiles = async directory => {
	const params = { Bucket: envConfig.AWS_ASSETS_BUCKET, Delimiter: "/", Prefix: `${directory}/` };
	const command = new AWS.ListObjectsCommand(params);
	const res = await client.send(command);

	if (!res.Contents) {
		return {};
	}

	return (await Promise.all(res.Contents.map(i => getSignedUrl(i.Key, "")))).reduce((acc, val) => {
		acc[val.fileName] = val.url;
		return acc;
	}, {});
};

export const putFile = async ({ buffer, fileName }, directory) => {
	const params = { Bucket: envConfig.AWS_ASSETS_BUCKET, Key: `${directory}/${fileName}`, Body: buffer };

	const command = new AWS.PutObjectCommand(params);
	await client.send(command);
};

export const putEconomicFile = async ({ buffer, fileName }, directory) => {
	const params = { Bucket: envConfig.AWS_INTEGRATION_BUCKET, Key: `${directory}/${fileName}`, Body: buffer };

	const command = new AWS.PutObjectCommand(params);
	await client.send(command);
};

export const streamFile = async (res, fileName, s3Path, { contentType = "application/pdf", logError = true }) => {
	try {
		const command = new AWS.GetObjectCommand({ Bucket: envConfig.AWS_ASSETS_BUCKET, Key: s3Path });
		const response = await client.send(command);
		if (response?.Body) {
			res.attachment(fileName);
			res.contentType(contentType);
			const stream = Readable.from(response.Body);
			stream.pipe(res);
		} else {
			res.status(404).send("File not found");
		}
	} catch (error) {
		if (logError) {
			logger.error(error);
		}
		if (error.name === "NoSuchKey") {
			res.status(404).send("File not found");
		} else {
			res.status(500).send("Internal server error");
		}
	}
};

export const addEmailIdentity = async email => {
	try {
		const command = new VerifyEmailAddressCommand({ EmailAddress: email });
		const result = await ses.send(command);
		return result;
	} catch (error) {
		logger.error(error);
		throw new Error(`Something went wrong while adding email identity. Please try again.${error.message}`);
	}
};

export const checkIdentityVerification = async email => {
	try {
		const command = new GetIdentityVerificationAttributesCommand({ Identities: [email] });
		const result = await ses.send(command);
		const verificationAttributes = result.VerificationAttributes || {};
		const status = verificationAttributes[email]?.VerificationStatus;
		return status === "Success";
	} catch (error) {
		logger.error(error);
		throw new Error(`Something went wrong while checking identity verification. Please try again.${error.message}`);
	}
};

class S3utils {
	constructor() {
		this.tokenResponse = null;
	}

	/**
	 * Downloads a file from the specified URL and saves it with the given filename.
	 * @param {string} url - The URL of the file to download.
	 * @param {string} filename - The name of the file to save.
	 * @returns {Promise<void>} A promise that resolves when the file has been downloaded and saved.
	 */
	getFile(url, filename) {
		return new Promise(resolve => {
			https.get(url, res => {
				const fileStream = fs.createWriteStream(filename);
				res.pipe(fileStream);
				fileStream.on("finish", resolve);
			});
		});
	}

	/**
	 * Retrieves mapped data based on the provided input data.
	 * @param {Array} data - The input data to be processed.
	 * @returns {Object} - An object containing the mapped code and industry.
	 */
	async getMappedData(data) {
		try {
			let codeData = { code: 0, industry: "" };
			if (data && data[0]?.Data[0]?.DataValues.length !== 0) {
				const transcriptArray = data[0].Data[0].DataValues;
				const naicsCodeArray = transcriptArray.filter(obj => {
					return obj.DataKey === "NAICS CD";
				});
				if (naicsCodeArray.length !== 0) {
					const naicsCode = naicsCodeArray[0].DataValue;
					codeData = await this.handleExcelData(naicsCode);
					return codeData;
				}
			}
			return codeData;
		} catch (error) {
			logger.error({ error: error }, "Error in getMappedData");
			return { code: 0, industry: "" };
		}
	}
	/**
	 * Handles the Excel data for a given NAICS code.
	 * @param {string} naicsCode - The NAICS code to filter the data.
	 * @returns {Object} - An object containing the code and industry for the given NAICS code.
	 * @throws {Error} - If there is an error in the tax-status API.
	 */
	async handleExcelData(naicsCode) {
		try {
			const url = envConfig.AWS_S3_BUCKET_URL;
			const filename = path.basename(url);
			const newFilename = `.data/${filename}`;
			await this.getFile(url, newFilename);
			const industryXmlData = xlsx.parse(newFilename);
			const industryData = industryXmlData[0].data;
			const industryResult = industryData.filter(data => {
				if (data[1] === Number(naicsCode)) {
					return data[0];
				}
				return false;
			});
			// industryResult[0][1] is the NAICS code & industryResult[0][2] is the industry name
			// if the industryResult is empty, then the code and industry will be 0 and empty string respectively
			// if the industryResult is not empty, then the code and industry will be the first, second elements of the array
			const code = industryResult.length && industryResult[0][1] ? industryResult[0][1] : 0;
			const industry = industryResult.length && industryResult[0][2] ? industryResult[0][2] : "";
			return { code, industry };
		} catch (error) {
			logger.error({ error }, "error in handleExcelData");
			return { code: 0, industry: "" };
		}
	}

	// Helper function to check if URL is S3
	isS3Url(url) {
		return url.includes(".s3.") || url.includes(".amazonaws.com");
	}

	// Helper function to extract S3 key from URL
	extractS3Key(s3Url) {
		try {
			const url = new URL(s3Url);
			// Remove leading slash from pathname
			return url.pathname.substring(1);
		} catch (error) {
			logger.error({ error }, "Failed to parse S3 URL");
			return "";
		}
	}
}

export const s3Utils = new S3utils();
