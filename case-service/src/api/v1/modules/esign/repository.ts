import { db } from "#helpers";
import { UUID } from "crypto";
import { IDataDocuments, IDataDocumentTemplate, IRelCustomerTemplates } from "./types";

class EsignRepository {
	async addTemplate(
		userId: UUID,
		opts?: Partial<Pick<IDataDocumentTemplate, "customer_id" | "template_id" | "name" | "template_fields" | "metadata">>
	): Promise<IDataDocumentTemplate> {
		const result = await db<IDataDocumentTemplate>("esign.data_document_templates")
			.insert({
				created_by: userId,
				updated_by: userId,
				...opts
			})
			.returning("*");

		return result[0];
	}

	async getAllTemplates(customerId?: UUID | null): Promise<IDataDocumentTemplate[]> {
		const query = db<IDataDocumentTemplate>("esign.data_document_templates");

		if (customerId || customerId === null) {
			query.where("customer_id", customerId);
		}

		const result = await query.select("*");

		return result;
	}

	async getTemplateById(templateId: UUID): Promise<IDataDocumentTemplate | undefined> {
		const result = await db<IDataDocumentTemplate>("esign.data_document_templates")
			.where("template_id", templateId)
			.first();

		return result;
	}

	async getCustomerTemplates(
		customerId: UUID
	): Promise<(IRelCustomerTemplates & { name: string; created_at: Date; version: number; tags: string[] })[]> {
		const result = await db<
			Array<IRelCustomerTemplates & { name: string; created_at: Date; version: number; tags: string[] }>
		>("esign.rel_customer_templates")
			.select(
				"esign.rel_customer_templates.*",
				"esign.data_document_templates.name",
				"esign.data_document_templates.created_at",
				"esign.data_document_templates.version",
				db.raw(`esign.data_document_templates.metadata->'tags' as "tags"`)
			)
			.leftJoin(
				"esign.data_document_templates",
				"esign.rel_customer_templates.template_id",
				"esign.data_document_templates.template_id"
			)
			.where("esign.rel_customer_templates.customer_id", customerId);
		return result;
	}

	async insertCustomerTemplate(customerId: UUID, templateId: UUID): Promise<IRelCustomerTemplates> {
		const result = await db<IRelCustomerTemplates>("esign.rel_customer_templates")
			.insert({ customer_id: customerId, template_id: templateId, is_selected: true })
			.returning("*");
		return result[0];
	}

	async deleteCustomerTemplate(customerId: UUID, templateId: UUID): Promise<IRelCustomerTemplates | null> {
		const result = await db<IRelCustomerTemplates>("esign.rel_customer_templates")
			.where({ customer_id: customerId, template_id: templateId })
			.delete()
			.returning("*");
		return result.length ? result[0] : null;
	}

	async getSignedDocuments(businessId: UUID, caseId?: UUID): Promise<Array<IDataDocuments & { name: string }>> {
		const query = db<Array<IDataDocuments & { name: string }>>("esign.data_documents")
			.select("esign.data_documents.*", "esign.data_document_templates.name")
			.leftJoin(
				"esign.data_document_templates",
				"esign.data_documents.template_id",
				"esign.data_document_templates.template_id"
			)
			.where("business_id", businessId);

		if (caseId) {
			query.andWhere("case_id", caseId);
		}

		return await query;
	}

	async insertSignedDocument(data: {
		document_id: UUID;
		template_id: UUID;
		customer_id: UUID;
		business_id: UUID;
		case_id: UUID;
		signed_by: UUID;
		mapping_data?: object;
		created_by: UUID;
		updated_by: UUID;
	}) {
		const result = await db("esign.data_documents").insert({
			document_id: data.document_id,
			template_id: data.template_id,
			customer_id: data.customer_id,
			business_id: data.business_id,
			case_id: data.case_id,
			signed_by: data.signed_by,
			mapping_data: JSON.stringify(data.mapping_data || {}),
			created_by: data.created_by,
			updated_by: data.updated_by,
			created_at: new Date(),
			updated_at: new Date()
		});
		return result;
	}

	async copyCustomerTemplatesFromParent(
		parentCustomerId: UUID,
		childCustomerId: UUID
	): Promise<IRelCustomerTemplates[]> {
		// Get parent customer's template relationships
		const parentTemplates = await db<IRelCustomerTemplates>("esign.rel_customer_templates")
			.where("customer_id", parentCustomerId)
			.select("*");

		if (!parentTemplates.length) {
			return [];
		}

		// Prepare data for child customer with same template relationships
		const childTemplateData = parentTemplates.map(template => ({
			customer_id: childCustomerId,
			template_id: template.template_id,
			is_selected: template.is_selected
		}));

		// Insert child customer template relationships
		// Using onConflict to handle duplicates gracefully
		const result = await db<IRelCustomerTemplates>("esign.rel_customer_templates")
			.insert(childTemplateData)
			.onConflict(["customer_id", "template_id"])
			.merge({
				is_selected: db.raw("EXCLUDED.is_selected")
			})
			.returning("*");

		return result;
	}
}

export const esignRepository = new EsignRepository();
