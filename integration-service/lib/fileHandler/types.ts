import type { StoredOnly } from "#types/eggPattern";
import type { UUID } from "crypto";

export type FileUploadEvent = {
	eventName: string;
	bucketName: string;
	fileKey: string;
	fileSize?: number;
};

export interface IFileUpload {
	id: StoredOnly<UUID>;
	file_name: string;
	display_name?: string;
	file_size: number;
	mime_type?: string;
	business_id?: UUID | null;
	customer_id?: UUID | null;
	s3_bucket?: string;
	s3_key?: string;
	created_by: UUID;
	created_at: StoredOnly<Date>;
	updated_at: StoredOnly<Date>;
	metadata?: Record<string, any>;
}

export interface CertificateMetadata {
	validity: {
		notBefore: Date;
		notAfter: Date;
		isValid: boolean;
		daysUntilExpiry: number;
	};
	serialNumber: string;
	fingerprint: {
		sha1: string;
		sha256: string;
	};
	version: number;
	signatureAlgorithm: string;
}
