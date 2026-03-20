import { normalizeBooleans } from "#utils/normalizer";
import { z } from "zod";
import { parseICAs } from "./utils";

// Regex pattern for validating individual ICA (alphanumeric string)
const ICA_ALPHANUMERIC_PATTERN = /^[a-zA-Z0-9]+$/;

export const ACCEPTED_FILE_TYPES = {
	// PKCS#12 variations
	"application/pkcs12": ["p12", "pfx"],
	"application/x-pkcs12": ["p12", "pfx"],
	"application/pkcs-12": ["p12", "pfx"],
	"application/x-pkcs12-certificates": ["p12", "pfx"],

	// PEM variations
	"application/x-pem-file": ["pem"],
	"application/x-x509-ca-cert": ["pem"],
	"application/x-certificate": ["pem"]
};

// Helper function to validate file type
const validateFileType = (file: Express.Multer.File) => {
	const allowedMimeTypes = Object.keys(ACCEPTED_FILE_TYPES);
	const fileExtension = file.originalname?.split(".").pop()?.toLowerCase();
	const allowedExtensions: Set<string> = new Set<string>(
		Object.values(ACCEPTED_FILE_TYPES).flatMap(ext => ext.map(e => e.toLowerCase()))
	);
	const isValidExtension = fileExtension && allowedExtensions.has(fileExtension);
	const isValidMimeType = allowedMimeTypes.includes(file.mimetype);

	return isValidMimeType || isValidExtension;
};

// Schema for icas (supports both comma-separated string and JSON formats, first ICA is the default)
const icasStringSchema = z
	.string()
	.optional()
	.transform(val => parseICAs(val))
	.refine(
		val => {
			if (val.length === 0) return true;
			// Validate each ICA is alphanumeric
			return val.every(item => ICA_ALPHANUMERIC_PATTERN.test(item.ica));
		},
		{ message: "Each ICA must be an alphanumeric value" }
	)
	.refine(
		val => {
			if (val.length === 0) return true;
			// Check for duplicate ICAs (case-insensitive)
			const lowerCaseICAs = val.map(item => item.ica.toLowerCase());
			const uniqueICAs = new Set(lowerCaseICAs);
			return uniqueICAs.size === lowerCaseICAs.length;
		},
		{ message: "ICAs must be unique - duplicate values are not allowed" }
	);

const bodySchema = z.object({
	customerName: z.string().optional(),
	consumerKey: z.string().optional(),
	icas: icasStringSchema,
	keyPassword: z.string().optional(),
	isActive: z.coerce.boolean()
});

export const schema = {
	checkConnectionStatus: z.object({
		params: z.object({
			customerId: z.string().uuid()
		})
	}),
	// Basic schema for middleware validation
	credentials: z.object({
		params: z.object({
			customerId: z.string().uuid()
		}),
		body: bodySchema,
		file: z.custom<Express.Multer.File>().optional()
	}),
	// Advanced schema with conditional validation for controller use
	credentialsWithValidation: z
		.object({
			params: z.object({
				customerId: z.string().uuid()
			}),
			body: bodySchema,
			file: z.custom<Express.Multer.File>().optional()
		})
		.superRefine((data, ctx) => {
			// If isActive is "true", validate required fields and file
			normalizeBooleans(data.body, ["isActive"]);
			if (data.body.isActive) {
				const requiredFields = ["customerName", "consumerKey", "icas", "keyPassword"];
				const missingFields = requiredFields.filter(field => {
					if (field === "icas") {
						return !data.body.icas || data.body.icas.length === 0;
					}
					return !data.body[field] || (Array.isArray(data.body[field]) && data.body[field].length === 0);
				});

				// Report specific missing fields
				if (missingFields.length > 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `The following fields are required: ${missingFields.join(", ")}`,
						path: ["body"]
					});
				}

				// Check for missing file
				if (!data.file) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "File is required",
						path: ["file"]
					});
				}
			}

			// Only validate file type if file is provided and isActive is true
			if (data.file && data.body.isActive) {
				if (!validateFileType(data.file)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Only PKCS#12 (.p12/.pfx) or PEM files are allowed",
						path: ["file"]
					});
				}
			}
		}),
	getCredentials: z.object({
		params: z.object({
			customerId: z.string().uuid()
		})
	})
};
