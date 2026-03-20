import { logger, getDocuments } from "#helpers/index";
import { UUID } from "crypto";
import { getCachedSignedUrl } from "#utils";
import { UploadedDocuments } from "./types";
import { processingHistory } from "../processing-history/processingHistory";
import { taxation } from "../taxation/taxation";
import { extractDocumentDetailsService } from "../extract-document-details/extractDocumentDetailsService";
import { AccountingRest } from "../accounting/accountingRest";
import { banking } from "../banking/banking";
import { Readable } from "stream";
import { getUploadedFileFromS3 } from "#common";
import { ocrService } from "../ocr/ocrService";
class Documents {
	/**
	 * Retrieves various types of documents associated with a business and optionally filters by case ID.
	 *
	 * @param params - The parameters required for fetching documents.
	 * @param params.businessID - The unique identifier of the business.
	 * @param query.caseID - (Optional) The UUID of the specific case to filter documents by case ID.
	 * @param query - An object containing optional query parameters.
	 * @returns A promise that resolves to an object containing categorized documents:
	 * - `tax`: Tax-related documents.
	 * - `processing_history`: Documents related to processing history.
	 * - `verification`: Verification-related documents.
	 * - `custom_fields`: Documents associated with custom fields.
	 * - `esign`: Electronic signature-related documents.
	 * - `additional`: Additional documents.
	 * - `banking`: Banking-related documents.
	 * - `accounting`: Accounting-related documents.
	 */
	async getDocuments(params: { businessID: UUID }, query: { caseID: UUID }) {
		try {
			const documents: UploadedDocuments = {
				verification: [],
				bank_statements: [],
				accounting: [],
				business_taxes: [],
				processing_history: [],
				custom_fields: [],
				signed_documents: [],
				other_documents: []
			};

			// get uploaded documents
			const [
				processingHistoryResult,
				verificationDetailsResult,
				documentsResult,
				bankingResult,
				accountingResult,
				ocrDocuments,
				irsEsignDocument
			] = await Promise.all([
				processingHistory.getProcessingHistory({ businessId: params.businessID }, { case_id: query?.caseID }),
				extractDocumentDetailsService.getVerificationDetails(params.businessID),
				getDocuments(params.businessID, query?.caseID),
				banking.getUploadedBankStatements(params, { case_id: query?.caseID }),
				AccountingRest.getUploadedAccountingStatements(params, { case_id: query?.caseID }),
				ocrService.getBusinessDocumentValidations(params.businessID, query?.caseID),
				taxation.getIRSEsignDocument(params.businessID)
			]);

			if (ocrDocuments && ocrDocuments.length > 0) {
				documents.business_taxes = await Promise.all(
					ocrDocuments
						.filter(ocr => ocr.file_name && ocr.file_path)
						.map(async ocr => ({
							file_name: ocr.file_name,
							file_path: ocr.file_path,
							ocr_document_id: ocr.id,
							file: await getCachedSignedUrl(ocr.file_name, ocr.file_path)
						}))
				);
			}

			if (irsEsignDocument?.data) {
				documents.business_taxes.push({
					file_name: "Form 8821.pdf",
					file_path: "",
					ocr_document_id: "",
					file: irsEsignDocument.data.consent_file ?? {}
				});
			}

			if (processingHistoryResult?.[0]?.file_name && processingHistoryResult[0].file_path) {
				documents.processing_history.push({
					file_name: processingHistoryResult[0].file_name,
					file_path: processingHistoryResult[0].file_path,
					ocr_document_id: processingHistoryResult[0].ocr_document_id,
					file: processingHistoryResult[0].file
				});
			}

			documents.verification = await Promise.all(
				verificationDetailsResult
					.filter(verification => verification.file_name && verification.file_path)
					.map(async verification => ({
						file_name: verification.file_name,
						file_path: verification.file_path,
						file: await getCachedSignedUrl(verification.file_name, verification.file_path)
					}))
			);

			if (bankingResult) {
				documents.bank_statements = await Promise.all(
					bankingResult
						.filter(bank => bank.file_name && bank.file_path)
						.map(async bank => ({
							file_name: bank.file_name,
							file_path: bank.file_path,
							file: await getCachedSignedUrl(bank.file_name, bank.file_path)
						}))
				);
			}

			if (accountingResult) {
				documents.accounting = await Promise.all(
					accountingResult
						.filter(account => account.file_name && account.file_path)
						.map(async account => ({
							file_name: account.file_name,
							file_path: account.file_path,
							file: await getCachedSignedUrl(account.file_name, account.file_path)
						}))
				);
			}

			Object.assign(documents, {
				custom_fields: documentsResult?.custom_fields || [],
				signed_documents: documentsResult?.esign || [],
				other_documents: documentsResult?.other_documents || []
			});

			return documents;
		} catch (error) {
			logger.error(error, "Error retrieving documents");
			throw error;
		}
	}

	/**
	 * To download a document from S3.
	 * @param query - An object containing the file name and path.
	 * @param query.file_name - The name of the file to be downloaded.
	 * @param query.file_path - The path of the file to be downloaded.
	 * @return A promise that resolves to an object containing the file stream and file name.
	 */
	async downloadDocument(query: { file_name: string; file_path: string }) {
		try {
			const { file_name: fileName, file_path: filePath } = query;
			const file = await getUploadedFileFromS3(`${filePath}/${fileName}`);
			if (!file) {
				throw new Error("File not found");
			}
			const arrayBuffer = await file.transformToByteArray();
			const fileStream = Readable.from(Buffer.from(arrayBuffer));
			return { fileStream, fileName: fileName };
		} catch (error) {
			logger.error(error, "Error downloading document:");
			throw error;
		}
	}
}

export const documents = new Documents();
