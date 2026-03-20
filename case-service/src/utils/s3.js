import { envConfig } from "#configs/index";
import { logger } from "#helpers";
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	CopyObjectCommand,
	DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
const tk = require("timekeeper");

// Round the time to the last 10-minute mark
const getTruncatedTime = () => {
	const currentTime = new Date();
	const d = new Date(currentTime);

	// Rounding down time to 00:00 hours of the current day
	d.setHours(Math.floor(d.getHours() / 24) * 24);
	d.setMinutes(0);
	d.setSeconds(0);
	d.setMilliseconds(0);

	return d;
};

const client = new S3Client({
	region: envConfig.AWS_SES_REGION,
	credentials: {
		accessKeyId: envConfig.AWS_ACCESS_KEY_ID,
		secretAccessKey: envConfig.AWS_ACCESS_KEY_SECRET
	}
});

const fileUrl = fileName => {
	return `https://${envConfig.AWS_ASSETS_BUCKET}.s3.${envConfig.AWS_REGION}.amazonaws.com/${fileName}`;
};

// Function to upload a file to S3
export const uploadFile = async (buffer, fileName, fileType, directory, bucket) => {
	try {
		const params = {
			Bucket: bucket, // Bucket name
			Key: `${directory}/${fileName}`, // Path within the bucket
			ContentType: fileType,
			Body: buffer
		};
		const command = new PutObjectCommand(params);
		const data = await client.send(command);

		return {
			...data,
			fileName,
			url: fileUrl(`${directory}/${fileName}`) // File URL
		};
	} catch (error) {
		// throw new Error(error.message);
		logger.error(JSON.stringify(error));
		throw new Error("Error uploading file. Please try again.");
	}
};

export const copyFile = async (currentPath, newPath, bucket) => {
	const params = {
		Bucket: bucket,
		CopySource: `${bucket}/${currentPath}`,
		Key: newPath
	};
	const command = new CopyObjectCommand(params);
	const data = await client.send(command);
	return data;
};
const deleteFile = async (path, bucket) => {
	const params = {
		Bucket: bucket,
		Key: path
	};
	const command = new DeleteObjectCommand(params);
	const data = await client.send(command);
	return data;
};
export const renameFile = async (currentPath, newPath, bucket) => {
	const out = await copyFile(currentPath, newPath, bucket);
	await deleteFile(currentPath, bucket);
	return out;
};

// Cache-friendly signing
export const getCachedSignedUrl = async (fileName, directory, bucket) => {
	try {
		const s3Params = {
			Bucket: bucket, // No slashes here
			Key: `${directory}/${fileName}`, // Path within the bucket
			Expires: 90000 // 25 hours in seconds
		};

		// Freeze time to ensure consistent signing
		const signedUrl = await tk.withFreeze(getTruncatedTime(), async () => {
			const command = new GetObjectCommand(s3Params);
			const url = await getSignedUrl(client, command, { expiresIn: s3Params.Expires });
			return url;
		});

		return {
			fileName,
			signedRequest: signedUrl,
			url: fileUrl(fileName)
		};
	} catch (_error) {
		throw new Error("Something went wrong while loading the file. Please refresh.");
	}
};
