import { logger } from "#helpers/logger";
import { z } from "zod";

const extractedDetailsSchema = z.object({
	legalName: z.string().nullable(),
	address: z.string().nullable(),
	taxID: z.string().nullable(),
	ssn: z.string().nullable(),
	accountNumber: z.string().nullable(),
	routingNumber: z.string().nullable(),
	bankName: z.string().nullable(),
	incorporationDate: z.string().nullable(),
	ownerNames: z.array(z.string()).nullable(),
	businessType: z.string().nullable(),
	registrationState: z.string().nullable(),
	documentNumber: z.string().nullable(),
	issueDate: z.string().nullable(),
	driversLicenseNumber: z.string().nullable(),
	expiryDate: z.string().nullable(),
	entityType: z.string().nullable()
});

const documentTypeSchema = z.enum([
	"SS-4 Confirmation Letter",
	"147C Confirmation Letter",
	"Articles of Incorporation",
	"Partnership Agreement",
	"Company Constitution/Articles of Association",
	"Certificate of Incorporation",
	"Certificate of Non-profit Registration",
	"Secretary of State Registration Filings",
	"Annual or Bi-annual State Information Reports",
	"Official Documents Listing the Registered Agent",
	"Lease or Rental Agreements",
	"Utility Bills",
	"Federal or State Tax Returns",
	"Other Government-issued Business Documents",
	"Lease Agreement or Mortgage Statement",
	"Property Tax Receipt",
	"State-issued Identification Card",
	"Voter Registration Card",
	"Insurance Card",
	"College Enrollment Papers",
	"Bank or Credit Card Statement",
	"Valid Driver’s License",
	"Passport",
	"Social Security Card",
	"ITIN Card",
	"Official Bank Statements",
	"Voided Checks",
	"Official Letters from the Bank",
	"Profit & Loss (Income) Statement",
	"Balance Sheet",
	"Cash Flow Statement"
]);

const summaryOfExtractedDetailsSchema = z.string();

const extractedDocumentDetailsResponseSchema = z.object({
	extractedDetails: extractedDetailsSchema,
	documentType: documentTypeSchema,
	summaryOfExtractedDetails: summaryOfExtractedDetailsSchema
});

export type ExtractedDocumentDetailsResponse = z.infer<typeof extractedDocumentDetailsResponseSchema>;

export const messageRoleEnum = z.enum(["user", "assistant"]);

export const messageTypeText = z.literal("text");
export const messageTypeImageUrl = z.literal("image_url");

const messageSchema = z.object({
	role: messageRoleEnum,
	content: z.array(
		z.union([
			z.object({
				type: z.literal("text"),
				text: z.string()
			}),
			z.object({
				type: z.literal("image_url"),
				image_url: z.object({
					url: z.string().describe("base64 encoded image")
				})
			})
		])
	)
});

export type ChatMessage = z.infer<typeof messageSchema>;

export const submitDocumentsForExtractionPayloadSchema = z.object({
	messages: z.array(messageSchema).nonempty(),
	additionalContext: z.string().optional()
});

export type SubmitDocumentsForExtractionPayload = z.infer<typeof submitDocumentsForExtractionPayloadSchema>;

export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export const ACCEPTED_FILE_TYPES = {
	"application/pdf": ["pdf"],
	"image/jpeg": ["jpeg", "jpg"],
	"image/jpg": ["jpg"],
	"image/png": ["png"],
	"image/webp": ["webp"],
	// iPhone image formats
	"image/heic": ["heic"],
	"image/heif": ["heif"]
};

export const extractFileDetailsSchema = z.object({
	file: z
		.custom<Express.Multer.File>()
		.refine(file => !(file instanceof String), "File is required")
		.refine(file => {
			logger.debug("File type:" + file.mimetype);
			return file.size <= MAX_FILE_SIZE, `File size should be less than 20mb.`;
		})
		.refine(file => Object.keys(ACCEPTED_FILE_TYPES).includes(file.mimetype), "Only PDF and Image files are allowed"), // Expect a single file upload
	additionalContext: z.string().optional(),
	params: z.object({
		businessID: z.string()
	})
});

export const schema = {
	submitDocumentsForExtraction: z.object({
		body: submitDocumentsForExtractionPayloadSchema
	}),
	extractFileDetails: extractFileDetailsSchema,
	getVerificationUploads: z.object({
		params: z.object({
			businessID: z.string()
		})
	}),
	getVerificationUpload: z.object({
		params: z.object({
			businessID: z.string(),
			verificationUploadID: z.string()
		})
	})
};
