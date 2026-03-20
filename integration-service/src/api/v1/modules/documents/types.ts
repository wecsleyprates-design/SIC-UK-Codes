export type UploadedDocuments = {
	business_taxes: { file_name: string; file_path: string; ocr_document_id: string; file: object }[];
	processing_history: { file_name: string; file_path: string; ocr_document_id: string; file: object }[];
	verification: IUploadDocumentType[];
	custom_fields: IUploadDocumentType[];
	signed_documents: IUploadDocumentType[];
	other_documents: IUploadDocumentType[];
	bank_statements: IUploadDocumentType[];
	accounting: IUploadDocumentType[];
};

interface IUploadDocumentType {
	file_name: string;
	file_path: string;
	file: object;
	ocr_document_id?: string;
}
