import { z } from "zod";
import { DOCUMENT_TYPES } from "./constants";

export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export const ACCEPTED_FILE_TYPES = {
	"application/pdf": ["pdf"],
	"image/jpeg": ["jpeg", "jpg"],
	"image/jpg": ["jpg"],
	"image/png": ["png"],
	"image/webp": ["webp"],
	// iPhone image formats
	"image/heic": ["heic"],
	"image/heif": ["heif"],
	"text/csv": ["csv"],
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"]
};

export const parsedStatementSchema = z.object({
	stepByStep: z.array(
		z.object({
			step: z.number(),
			action: z.string().describe("The action taken in the step"),
			result: z.string().describe("The result of the action")
		})
	),
	planSummaryData: z.object({
		visa: z.object({
			monthlyVolume: z.number(),
			averageTicketSize: z.number(),
			highTicketSize: z.number(),
			desiredLimit: z.number(),
			numberOfTransactions: z.number(),
			planCodes: z.array(z.string())
		}),
		mastercard: z.object({
			monthlyVolume: z.number(),
			averageTicketSize: z.number(),
			highTicketSize: z.number(),
			desiredLimit: z.number(),
			numberOfTransactions: z.number(),
			planCodes: z.array(z.string())
		}),
		discover: z.object({
			monthlyVolume: z.number(),
			averageTicketSize: z.number(),
			highTicketSize: z.number(),
			desiredLimit: z.number(),
			numberOfTransactions: z.number(),
			planCodes: z.array(z.string())
		}),
		americanExpress: z.object({
			monthlyVolume: z.number(),
			averageTicketSize: z.number(),
			highTicketSize: z.number(),
			desiredLimit: z.number(),
			numberOfTransactions: z.number(),
			planCodes: z.array(z.string())
		}),
		pointOfSaleVolume: z.object({
			swipedCards: z.number(),
			typedCards: z.number(),
			eCommerce: z.number()
		})
	}),
	confidenceScore: z.number()
});

export type ParsedStatement = z.infer<typeof parsedStatementSchema>;

const combinedCardDataSchema = z.object({
	monthlyVolume: z.number(),
	averageTicketSize: z.number(),
	highTicketSize: z.number(),
	desiredLimit: z.number()
});

export type CombinedCardData = z.infer<typeof combinedCardDataSchema>;

const aggregatedDataSchema = z.object({
	combinedMonthlyVolume: z.number(),
	combinedAverageTicketSize: z.number(),
	combinedHighestTicket: z.number(),
	combinedDesiredLimit: z.number(),
	visaMastercardDiscover: combinedCardDataSchema
});

export type AggregatedData = z.infer<typeof aggregatedDataSchema>;

export const enhancedParsedStatementSchema = parsedStatementSchema.extend({
	aggregatedData: aggregatedDataSchema
});

export type EnhancedParsedStatement = z.infer<typeof enhancedParsedStatementSchema>;

export const parsedTaxReturnSchema = z.object({
	stepByStep: z.array(
		z.object({
			step: z.number(),
			action: z.string(),
			result: z.string()
		})
	),
	taxReturnData: z.discriminatedUnion("filingFor", [
		z.object({
			filingFor: z.literal("business"),
			formType: z.string(),
			taxYear: z.number(),
			ein: z.string(),
			businessType: z.string(),
			financials: z.object({
				grossRevenue: z.number(),
				costOfGoodsSold: z.number(),
				operatingExpenses: z.number(),
				netIncome: z.number(),
				totalAssets: z.number(),
				totalLiabilities: z.number(),
				totalWages: z.number()
			}),
			businessInfo: z.object({
				businessName: z.string(),
				businessAddress: z.string(),
				incorporationDate: z.string()
			})
		}),
		z.object({
			filingFor: z.literal("personal"),
			formType: z.string(),
			taxYear: z.number(),
			taxPayerInfo: z.object({
				firstName: z.string(),
				middleInitial: z.string().optional().nullable(),
				lastName: z.string(),
				filingStatus: z.string(),
				spouseFirstName: z.string().optional().nullable(),
				spouseMiddleInitial: z.string().optional().nullable(),
				spouseLastName: z.string().optional().nullable()
			}),
			income: z.object({
				wagesFromW2: z.number(),
				socialSecurityBenefits: z.number(),
				totalIncome: z.number(),
				adjustedGrossIncome: z.number()
			}),
			deductionsAndTax: z.object({
				totalDeductions: z.number(),
				taxableIncome: z.number(),
				totalTax: z.number(),
				totalPayments: z.number()
			})
		})
	]),
	confidenceScore: z.number()
});

export type ParsedTaxReturn = z.infer<typeof parsedTaxReturnSchema>;

export type ParsedDocumentResult = EnhancedParsedStatement | ParsedTaxReturn | ParsedBankStatement | ParsedBalanceSheet;

export const validatedDocumentTypeSchema = z.object({
	isValidDocumentType: z.boolean(),
	documentType: z.string(),
	confidenceScore: z.number(),
	identifiedFeatures: z.array(z.string()),
	/** If the document is valid, this will be the jobId of the extraction job */
	extractionJobId: z.string().nullable()
});

export type ValidatedDocumentType = z.infer<typeof validatedDocumentTypeSchema>;

export type OcrMission = "extraction" | "validation";

export const schema = {
	parseDocument: z.object({
		params: z.object({
			businessID: z.string().uuid(),
			documentType: z.enum([
				DOCUMENT_TYPES.PROCESSING_STATEMENT,
				DOCUMENT_TYPES.TAX_RETURN,
				DOCUMENT_TYPES.BANK_STATEMENT,
				DOCUMENT_TYPES.ACCOUNTING_STATEMENT
			])
		}),
		body: z.object({
			skip_ocr: z
				.preprocess(val => val === "true", z.boolean())
				.optional()
				.nullable(),
			case_id: z.string().uuid().optional().nullable()
		}),
		query: z.object({
			case_id: z.string().uuid().optional().nullable()
		}),
		file: z
			.custom<Express.Multer.File>()
			.refine(file => !(file instanceof String), "File is required")
			.refine(file => file.size <= MAX_FILE_SIZE, `File size should be less than 20mb.`)
			.refine(
				file => Object.keys(ACCEPTED_FILE_TYPES).includes(file.mimetype),
				"Only PDF, Images, CSV and XLSX files are allowed"
			),
		additionalContext: z.string().optional().nullable(),
		maxPages: z.number().optional()
	}),
	parseBulkDocuments: z.object({
		params: z.object({
			businessID: z.string().uuid(),
			documentType: z.enum([DOCUMENT_TYPES.PROCESSING_STATEMENT, DOCUMENT_TYPES.TAX_RETURN])
		}),
		files: z
			.array(
				z
					.custom<Express.Multer.File>()
					.refine(file => !(file instanceof String), "File is required")
					.refine(
						file => file.size <= MAX_FILE_SIZE,
						`File size should be less than ${MAX_FILE_SIZE / (1024 * 1024)}mb.`
					)
					.refine(
						file => Object.keys(ACCEPTED_FILE_TYPES).includes(file.mimetype),
						"Only PDF and Image files are allowed"
					)
			)
			.min(1, "At least one file is required")
			.max(10, "Maximum 10 files allowed"),
		additionalContext: z.string().optional().nullable(),
		maxPages: z.number().optional()
	}),
	getJobStatus: z.object({
		params: z.object({
			jobId: z.string({
				required_error: "Job ID is required"
			})
		})
	}),
	getBusinessDocumentValidations: z.object({
		params: z.object({
			businessID: z.string().uuid()
		})
	}),
	getBusinessDocumentExtractions: z.object({
		params: z.object({
			businessID: z.string().uuid()
		})
	}),
	getDocumentUpload: z.object({
		params: z.object({
			businessID: z.string().uuid(),
			jobType: z.enum(["extraction", "validation"])
		}),
		query: z.object({
			filePath: z.string().nullable()
		})
	})
};

export const parsedBankStatementSchema = z.object({
	stepByStep: z.array(
		z.object({
			step: z.number(),
			action: z.string(),
			result: z.string()
		})
	),
	bankStatementData: z.object({}),
	confidenceScore: z.number()
});

export type ParsedBankStatement = z.infer<typeof parsedBankStatementSchema>;

export const parsedBalanceSheetSchema = z.object({
	stepByStep: z.array(
		z.object({
			step: z.number(),
			action: z.string(),
			result: z.string()
		})
	),
	balanceSheetData: z.object({}),
	confidenceScore: z.number()
});

export type ParsedBalanceSheet = z.infer<typeof parsedBalanceSheetSchema>;
