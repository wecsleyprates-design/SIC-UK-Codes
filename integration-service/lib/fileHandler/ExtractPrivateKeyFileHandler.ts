import { logger } from "#helpers";
import path from "path";
import { FileHandler } from "./fileHandler";
import { FileUploadEvent, CertificateMetadata } from "./types";
import forge from "node-forge";
import crypto from "crypto";

// Supported file extensions
const SUPPORTED_EXTENSIONS = {
	PEM: [".pem"],
	P12: [".p12", ".pfx"]
} as const;

export class ExtractPrivateKeyFileHandler extends FileHandler {
	constructor(event: FileUploadEvent) {
		super(event);
	}

	private static extractPEMstring(fileBuffer: Buffer) {
		return Buffer.isBuffer(fileBuffer) ? fileBuffer.toString("utf8") : fileBuffer;
	}

	/**
	 * Determines file type from extension or content
	 */
	private static getFileType(filename: string): "pem" | "p12" | "unknown" {
		const ext = path.extname(filename).toLowerCase();

		if ((SUPPORTED_EXTENSIONS.PEM as readonly string[]).includes(ext)) {
			return "pem";
		}
		if ((SUPPORTED_EXTENSIONS.P12 as readonly string[]).includes(ext)) {
			return "p12";
		}
		return "unknown";
	}

	/**
	 * Generates formatted fingerprints from certificate
	 */
	private static generateFingerprints(certificate: forge.pki.Certificate) {
		const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
		const sha1Hash = crypto.createHash("sha1").update(certDer, "binary").digest("hex");
		const sha256Hash = crypto.createHash("sha256").update(certDer, "binary").digest("hex");

		// Format fingerprints with colons
		const formatFingerprint = (hash: string) =>
			hash
				.toUpperCase()
				.match(/.{1,2}/g)
				?.join(":") || "";

		return {
			sha1: formatFingerprint(sha1Hash),
			sha256: formatFingerprint(sha256Hash)
		};
	}

	/**
	 * Converts buffer to string format suitable for P12 parsing
	 */
	private static extractP12string(fileBuffer: Buffer): string {
		return fileBuffer.toString("binary");
	}

	/**
	 * Validates and extracts certificate from PEM string
	 */
	private static validatePemFormat(pemString: string): string {
		const pemMatch = pemString.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
		if (!pemMatch) {
			throw new Error("Invalid PEM format - no certificate found");
		}
		return pemMatch[0];
	}

	/**
	 * Common P12 file parsing logic
	 */
	private static parseP12File(fileBuffer: Buffer, keyPassword?: string): forge.pkcs12.Pkcs12Pfx {
		const p12Asn1 = forge.asn1.fromDer(this.extractP12string(fileBuffer));
		return forge.pkcs12.pkcs12FromAsn1(p12Asn1, keyPassword);
	}

	/**
	 * Extracts certificate from P12 file
	 */
	private static extractCertsFromP12File(fileBuffer: Buffer, keyPassword?: string): forge.pki.Certificate {
		const p12 = this.parseP12File(fileBuffer, keyPassword);

		// Get certificate from P12
		const certBags = p12.getBags({
			bagType: forge.pki.oids.certBag
		});
		const certBag = certBags[forge.pki.oids.certBag];

		if (!certBag || certBag.length === 0) {
			throw new Error("No certificate found in P12 file");
		}

		const certificate = certBag[0].cert;
		if (!certificate) {
			throw new Error("Failed to extract certificate from P12 file");
		}
		return certificate;
	}

	/**
	 * Loads private key from PEM file
	 */
	private static loadPrivateKeyFromPemFile(fileBuffer: Buffer): string {
		try {
			const pemString = this.extractPEMstring(fileBuffer);
			// For private keys, we need to look for private key markers, not certificate markers
			const privateKeyMatch = pemString.match(
				/-----BEGIN (RSA )?PRIVATE KEY-----[\s\S]*?-----END (RSA )?PRIVATE KEY-----/
			);
			if (!privateKeyMatch) {
				throw new Error("Invalid PEM format - no private key found");
			}
			logger.info("Private key successfully loaded from PEM");
			return privateKeyMatch[0];
		} catch (error: unknown) {
			logger.error({ error }, "Failed to load PEM private key");
			throw new Error("Failed to load PEM private key");
		}
	}

	/**
	 * Loads private key from P12 file
	 */
	private static loadPrivateKeyFromP12File(fileBuffer: Buffer, keyPassword: string): string {
		try {
			const p12 = this.parseP12File(fileBuffer, keyPassword);

			// Get private key from P12
			const keyBags = p12.getBags({
				bagType: forge.pki.oids.pkcs8ShroudedKeyBag
			});
			const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];

			if (!keyBag || keyBag.length === 0) {
				throw new Error("No private key found in P12 file");
			}

			const privateKey = keyBag[0].key;
			if (!privateKey) {
				throw new Error("Failed to extract private key from P12");
			}

			const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
			logger.info("Private key successfully loaded from P12 file");
			return privateKeyPem;
		} catch (error: unknown) {
			logger.error({ error }, "Failed to load P12 private key");
			throw new Error("Failed to load P12 private key");
		}
	}

	/**
	 * Extracts detailed metadata from a certificate including validity dates, subject, issuer, and fingerprints
	 * @param certificate - node-forge certificate object
	 * @returns CertificateMetadata object with all extracted information
	 */
	private static buildCertificateMetadata(certificate: forge.pki.Certificate): CertificateMetadata {
		const now = new Date();
		const notBefore = certificate.validity.notBefore;
		const notAfter = certificate.validity.notAfter;
		const isValid = now >= notBefore && now <= notAfter;
		const daysUntilExpiry = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

		// Generate fingerprints
		const fingerprint = this.generateFingerprints(certificate);

		return {
			validity: {
				notBefore,
				notAfter,
				isValid,
				daysUntilExpiry
			},
			serialNumber: certificate.serialNumber,
			fingerprint,
			version: certificate.version + 1, // Certificate version is 0-indexed, display as 1-indexed
			signatureAlgorithm: certificate.signatureOid
				? forge.pki.oids[certificate.signatureOid] || certificate.signatureOid
				: "Unknown"
		};
	}

	/**
	 * Extracts certificate metadata from a PEM file buffer
	 * @param fileBuffer - Buffer containing PEM file data
	 * @returns CertificateMetadata with metadata or error
	 */
	private static extractMetadataFromPemFile(fileBuffer: Buffer): CertificateMetadata {
		try {
			const pemString = this.extractPEMstring(fileBuffer);
			const pemMatch = this.validatePemFormat(pemString);
			const certificate = forge.pki.certificateFromPem(pemMatch);
			const metadata = this.buildCertificateMetadata(certificate);

			logger.info("Certificate metadata successfully extracted from PEM file");
			return metadata;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			logger.error({ error }, `Error extracting metadata from PEM file: ${errorMessage}`);
			throw new Error(`Failed to extract metadata from PEM file: ${errorMessage}`);
		}
	}

	/**
	 * Extracts certificate metadata from a P12 file buffer
	 * @param fileBuffer - Buffer containing P12 file data
	 * @param keyPassword - Password for the P12 file
	 * @returns CertificateMetadata with metadata or error
	 */
	private static extractMetadataFromP12File(fileBuffer: Buffer, keyPassword: string): CertificateMetadata {
		try {
			const certificate = this.extractCertsFromP12File(fileBuffer, keyPassword);
			const metadata = this.buildCertificateMetadata(certificate);

			logger.info("Certificate metadata successfully extracted from P12 file");
			return metadata;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			logger.error({ error }, `Error extracting metadata from P12 file: ${errorMessage}`);
			throw new Error(`Failed to extract metadata from P12 file: ${errorMessage}`);
		}
	}

	/**
	 * Extracts certificate metadata from either PEM or P12 files
	 * @param keyFile - Express.Multer.File object containing the certificate file
	 * @param keyPassword - Password for P12 files
	 * @returns CertificateMetadata with metadata or error information
	 */
	/**
	 * Auto-detects file type and extracts metadata accordingly
	 */
	private static autoDetectAndExtractMetadata(fileBuffer: Buffer, keyPassword: string): CertificateMetadata {
		try {
			const pemResult = this.extractMetadataFromPemFile(fileBuffer);
			return pemResult;
		} catch (error: unknown) {
			logger.error({ error }, "Failed to extract metadata from PEM file");
			// If PEM fails, try P12
			logger.info("PEM extraction failed, attempting P12 extraction");
			return this.extractMetadataFromP12File(fileBuffer, keyPassword);
		}
	}

	public static extractCertificateMetadata(keyFile: Express.Multer.File, keyPassword: string): CertificateMetadata {
		const fileType = this.getFileType(keyFile.originalname);

		switch (fileType) {
			case "pem":
				return this.extractMetadataFromPemFile(keyFile.buffer);
			case "p12":
				return this.extractMetadataFromP12File(keyFile.buffer, keyPassword);
			default:
				try {
					return this.autoDetectAndExtractMetadata(keyFile.buffer, keyPassword);
				} catch (error: unknown) {
					const errorMessage = error instanceof Error ? error.message : "Unknown error";
					logger.error({ error }, `Failed to extract metadata from certificate file: ${errorMessage}`);
					throw new Error(`Unable to determine file type or extract metadata: ${errorMessage}`);
				}
		}
	}

	/**
	 * Auto-detects file type and loads private key accordingly
	 */
	private static autoDetectAndLoadPrivateKey(fileBuffer: Buffer, keyPassword: string): string {
		try {
			// Try PEM first
			return this.loadPrivateKeyFromPemFile(fileBuffer);
		} catch (error: unknown) {
			logger.error({ error }, "Failed to load private key from PEM file");
			// Try P12 as fallback
			return this.loadPrivateKeyFromP12File(fileBuffer, keyPassword);
		}
	}

	public static loadPrivateKey(keyFile: Express.Multer.File, keyPassword: string): string {
		const fileType = this.getFileType(keyFile.originalname);

		switch (fileType) {
			case "pem":
				return this.loadPrivateKeyFromPemFile(keyFile.buffer);
			case "p12":
				return this.loadPrivateKeyFromP12File(keyFile.buffer, keyPassword);
			default:
				return this.autoDetectAndLoadPrivateKey(keyFile.buffer, keyPassword);
		}
	}
}
