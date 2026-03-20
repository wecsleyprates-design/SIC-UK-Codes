import { UUID } from "crypto";
import { esignRepository } from "./repository";
import { UserInfo } from "#types";
import { EsignApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { BUCKETS, DIRECTORIES, ERROR_CODES, kafkaEvents, kafkaTopics } from "#constants";
import { getCachedSignedUrl, uploadFile } from "#utils";
import { createSessionToken, producer } from "#helpers";
import { fieldsMapping } from "./fields-mapping";
import { CreateSessionBody } from "./types";

class Esign {
	async createSession(params: { businessID: UUID }, body: CreateSessionBody) {
		try {
			await fieldsMapping.insertAllMappingFieldsData(params.businessID);

			const mappingData = await fieldsMapping.getMappingFieldsData(params.businessID);
			if (!mappingData) {
				throw new EsignApiError(
					"Mapping data not found for the business",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			// Merge mappingData into documentFields
			const finalPayload = {
				...body,
				documentFields: {
					...body.documentFields,
					...mappingData // Inject mapping data here
				}
			};
			// create session token by making request to esign svc
			const data = await createSessionToken(params.businessID, finalPayload);
			return data;
		} catch (error) {
			throw error;
		}
	}

	async associateTemplateToCustomer(params: { customerID: UUID }, body: [{ template_id: UUID; is_selected: boolean }]) {
		for (const item of body) {
			// check if the template exists
			const template = await esignRepository.getTemplateById(item.template_id);

			if (!template) {
				throw new EsignApiError("Template not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
		}

		// check if the template is already exists for the customer
		const customerTemplates = await esignRepository.getCustomerTemplates(params.customerID);

		for (const item of body) {
			const existingTemplate = customerTemplates.find(template => template.template_id === item.template_id);

			if (existingTemplate) {
				if (!item.is_selected) {
					await esignRepository.deleteCustomerTemplate(params.customerID, item.template_id);
				}
			} else if (item.is_selected) {
				await esignRepository.insertCustomerTemplate(params.customerID, item.template_id);
			}
		}
	}

	async getTemplates(params: { customerID: UUID }) {
		let customerTemplates = await esignRepository.getCustomerTemplates(params.customerID);

		const response: Array<{
			template_id: UUID;
			url: object;
			name: string;
			created_at: Date;
			version: number;
			tags: string[];
			is_selected: boolean;
		}> = [];
		for (const template of customerTemplates) {
			const url = await getCachedSignedUrl(
				template.template_id,
				`${DIRECTORIES.PDF_TEMPLATES}/templates`,
				BUCKETS.BACKEND
			);
			response.push({
				template_id: template.template_id,
				url: url,
				name: template.name,
				created_at: template.created_at,
				version: template.version,
				tags: template.tags,
				is_selected: template.is_selected
			});
		}

		return response;
	}

	async addGlobalTemplates(files: Array<Express.Multer.File>, body: { tags?: string[] }, userInfo: UserInfo) {
		if (!files || files.length === 0) {
			throw new EsignApiError("At least one file is required.", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		for (const file of files) {
			if (file && file.mimetype !== "application/pdf") {
				throw new EsignApiError(
					"File type not supported. Only PDF files are allowed.",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
		}

		for (const file of files) {
			const template = await esignRepository.addTemplate(userInfo.user_id as UUID, {
				name: file.originalname,
				metadata: { tags: body.tags ?? [] }
			});
			await this.uploadTemplate(file, template.template_id);
		}
	}

	async getGlobalTemplates() {
		let globalTemplates = await esignRepository.getAllTemplates();
		const response: Array<{
			template_id: UUID;
			url: object;
			name: string | null;
			created_at: Date;
			version: number;
			tags: string[];
		}> = [];
		for (const template of globalTemplates) {
			const url = await getCachedSignedUrl(
				template.template_id,
				`${DIRECTORIES.PDF_TEMPLATES}/templates`,
				BUCKETS.BACKEND
			);
			response.push({
				template_id: template.template_id,
				url: url,
				name: template.name,
				created_at: template.created_at,
				version: template.version,
				tags: template.metadata?.tags || []
			});
		}

		return response;
	}

	private async uploadTemplate(file: Express.Multer.File, templateId: UUID) {
		await uploadFile(
			file.buffer,
			templateId,
			"application/pdf",
			`${DIRECTORIES.PDF_TEMPLATES}/templates`,
			BUCKETS.BACKEND
		);
	}

	async getSignedDocuments(params: { businessID: UUID }, query: { case_id?: UUID }) {
		const documents = await esignRepository.getSignedDocuments(params.businessID, query.case_id);

		const response = await Promise.all(
			documents.map(async document => {
				const url = await getCachedSignedUrl(document.document_id, `signed_documents`, BUCKETS.ELECTRONIC_CONSENT);
				return {
					...document,
					url
				};
			})
		);

		return response;
	}

	async mockEsignProcess(
		params: { businessID: UUID },
		body: { template_id: UUID; customer_id: UUID; case_id: UUID },
		userInfo: UserInfo
	) {
		const payload = {
			template_id: body.template_id,
			customer_id: body.customer_id,
			business_id: params.businessID,
			case_id: body.case_id,
			user_id: userInfo.user_id
		};

		await producer.send({
			topic: kafkaTopics.BUSINESS,
			messages: [
				{
					key: params.businessID,
					value: {
						event: kafkaEvents.ONBOARDING_ESIGN_COMPLETED,
						...payload
					}
				}
			]
		});

		return { message: "Mock eSign triggered" };
	}
}

export const esign = new Esign();
