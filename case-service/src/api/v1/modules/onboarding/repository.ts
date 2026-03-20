import { db, sqlSequencedTransaction } from "#helpers";
import { UUID } from "crypto";
import {
	DataCustomerOnboardingLimits,
	IDataCustomerOnboardingLimitsHistory,
	ICustomTemplate,
	type IBusinessCustomField,
	type IBusinessCustomFieldEgg,
	type ICustomField,
	type IFieldOption,
	type DetailedBusinessCustomFields,
	type ICustomerCustomFieldsSummary
} from "./types";
import { ADMIN_UUID, ERROR_CODES } from "#constants";
import { buildInsertQuery } from "#utils";
import { OnboardingApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import type { Knex } from "knex";

export class OnboardingServiceRepository {
	async getCustomerOnboardingLimitData(customerId: UUID): Promise<DataCustomerOnboardingLimits | null> {
		const customerOnboardingLimit = await db("onboarding_schema.data_customer_onboarding_limits")
			.where("customer_id", customerId)
			.first();
		return customerOnboardingLimit;
	}

	async addCustomerOnboardingLimit(
		customerId: UUID,
		limit: number | null,
		userId: string = ADMIN_UUID
	): Promise<DataCustomerOnboardingLimits> {
		const inserted = await db("onboarding_schema.data_customer_onboarding_limits")
			.insert({
				customer_id: customerId,
				onboarding_limit: limit,
				created_by: userId,
				updated_by: userId
			})
			.returning("*");

		return inserted[0];
	}

	async updateCustomerOnboardingLimit(customerId: UUID, limit: number | null, userId: string): Promise<void> {
		await db("onboarding_schema.data_customer_onboarding_limits")
			.where("customer_id", customerId)
			.update({ onboarding_limit: limit, updated_by: userId });
	}

	async updateEasyFlowOnboardingCount(customerId: UUID, businessId: UUID, easyflowCount: number): Promise<void> {
		await db("onboarding_schema.data_customer_onboarding_limits")
			.where("customer_id", customerId)
			.update({
				easyflow_count: easyflowCount,
				onboarded_businesses: db.raw("array_append(onboarded_businesses, ?)", [businessId])
			});
	}

	async updatePurgedBusinessesCount(customerId: UUID, purgedBusinessesCount: number): Promise<void> {
		await db("onboarding_schema.data_customer_onboarding_limits")
			.where("customer_id", customerId)
			.update({ purged_businesses_count: purgedBusinessesCount });
	}

	async updateCurrentBusinessOnboardingCount(customerId: UUID, businessId: UUID, currentCount: number): Promise<void> {
		await db("onboarding_schema.data_customer_onboarding_limits")
			.where("customer_id", customerId)
			.update({
				current_count: currentCount,
				onboarded_businesses: db.raw("array_append(onboarded_businesses, ?)", [businessId])
			});
	}

	async updatePurgedBusinessesCountAndDecreaseCurrentBusinessesCount(
		customerId: UUID,
		businessId: UUID,
		purgedBusinessesCount: number,
		currentCount: number
	): Promise<void> {
		await db("onboarding_schema.data_customer_onboarding_limits")
			.where("customer_id", customerId)
			.update({
				purged_businesses_count: purgedBusinessesCount,
				current_count: currentCount,
				onboarded_businesses: db.raw("array_remove(onboarded_businesses, ?)", [businessId])
			});
	}

	async updateBusinessOnboardingCount(
		customerId: string,
		counts: { current_count?: number; purged_businesses_count?: number; easyflow_count?: number }
	): Promise<void> {
		await db("onboarding_schema.data_customer_onboarding_limits")
			.where("customer_id", customerId)
			.update({ ...counts });
	}

	async getAllOnboardingLimitData(): Promise<DataCustomerOnboardingLimits[]> {
		const customerOnboardingLimits = await db<DataCustomerOnboardingLimits>(
			"onboarding_schema.data_customer_onboarding_limits"
		).select("*");
		return customerOnboardingLimits;
	}

	async insertHistoryDataAndResetLimitData(historyTableData: IDataCustomerOnboardingLimitsHistory[]) {
		const queries: string[] = [];
		const values: any[] = [];

		const historyTableColumns = [
			"customer_id",
			"onboarding_limit",
			"used_count",
			"easyflow_count",
			"purged_businesses_count",
			"total_count",
			"created_at",
			"onboarded_businesses"
		];

		const historyTableValues = historyTableData.map((row: IDataCustomerOnboardingLimitsHistory) => [
			row.customer_id,
			row.onboarding_limit,
			row.used_count,
			row.easyflow_count,
			row.purged_businesses_count,
			row.total_count,
			row.created_at,
			row.onboarded_businesses
		]);

		const insertQuery = buildInsertQuery(
			"onboarding_schema.data_customer_onboarding_limits_history",
			historyTableColumns,
			historyTableValues
		);

		queries.push(insertQuery);
		values.push(historyTableValues.flat());

		const updateQuery = `UPDATE onboarding_schema.data_customer_onboarding_limits SET current_count = 0, easyflow_count = 0, purged_businesses_count = 0, onboarded_businesses = '{}', reset_at = $1`;
		queries.push(updateQuery);
		values.push([new Date(Date.now())]);

		await sqlSequencedTransaction(queries, values);
	}

	async copyOnboardingLimitsFromParent(
		parentCustomerId: UUID,
		childCustomerId: UUID,
		userId: string = ADMIN_UUID
	): Promise<DataCustomerOnboardingLimits | null> {
		// Get parent customer's onboarding limits
		const parentLimits = await this.getCustomerOnboardingLimitData(parentCustomerId);

		if (!parentLimits) {
			return null;
		}

		// Insert or update child limits with parent's limit using upsert
		const result = await db("onboarding_schema.data_customer_onboarding_limits")
			.insert({
				customer_id: childCustomerId,
				onboarding_limit: parentLimits.onboarding_limit,
				created_by: userId,
				updated_by: userId
			})
			.onConflict("customer_id")
			.merge({
				onboarding_limit: parentLimits.onboarding_limit,
				updated_by: userId
			})
			.returning("*");

		return result[0];
	}

	/**
	 * Get the onboarding template for a given template ID of the newest template for a customerId
	 * @param params - The params to get the onboarding template (templateId or customerId)
	 * @returns The onboarding template or undefined if not found
	 */
	async getOnboardingTemplates(params: { templateId: UUID } | { customerId: UUID }): Promise<ICustomTemplate[]> {
		if ("templateId" in params && params.templateId) {
			return await db<ICustomTemplate>("onboarding_schema.data_custom_templates").where("id", params.templateId);
		}
		if ("customerId" in params && params.customerId) {
			return await db<ICustomTemplate>("onboarding_schema.data_custom_templates")
				.where({ customer_id: params.customerId, is_enabled: true })
				.orderBy("version", "desc");
		}
		throw new OnboardingApiError(
			"No template ID or customer ID provided",
			StatusCodes.BAD_REQUEST,
			ERROR_CODES.INVALID
		);
	}

	async getCustomField(
		params: { id: UUID } | { code: ICustomField["code"]; templateId: UUID }
	): Promise<ICustomField | undefined> {
		const baseQuery = this.getBaseCustomField();
		if ("id" in params && params.id) {
			return await baseQuery.where("data_custom_fields.id", params.id).first();
		}
		if ("code" in params && params.code && "templateId" in params && params.templateId) {
			return await baseQuery
				.where("data_custom_fields.code", params.code)
				.andWhere("template_id", params.templateId)
				.first();
		}
		throw new OnboardingApiError(
			"No custom field ID or code and template ID provided",
			StatusCodes.BAD_REQUEST,
			ERROR_CODES.INVALID
		);
	}

	async getCustomFields(templateId: UUID): Promise<ICustomField[]> {
		return this.getBaseCustomField().where("template_id", templateId).orderBy("sequence_number", "asc");
	}

	async getCustomFieldOptions(fieldId: UUID): Promise<IFieldOption[]> {
		return await db<IFieldOption>("onboarding_schema.data_field_options")
			.where("field_id", fieldId)
			.select("*")
			.orderBy("label");
	}

	async getBusinessCustomFields(
		params: ({ caseId: UUID; businessId?: never } | { caseId?: never; businessId: UUID }) & { templateId?: UUID }
	): Promise<IBusinessCustomField[]> {
		// where clause needs to key off the fields that are present in the table
		const whereClause: Partial<IBusinessCustomField> = {};
		if (params.caseId) {
			whereClause.case_id = params.caseId;
		}
		if (params.businessId) {
			whereClause.business_id = params.businessId;
		}
		if (params.templateId) {
			whereClause.template_id = params.templateId;
		}
		return db<IBusinessCustomField>("onboarding_schema.data_business_custom_fields")
			.where(whereClause)
			.orderBy("created_at", "desc");
	}

	async getActiveBusinessCustomFieldValues(
		businessId: UUID,
		caseId: UUID,
		templateId: UUID
	): Promise<IBusinessCustomField[]> {
		return db<IBusinessCustomField>("onboarding_schema.data_business_custom_fields as dbcf")
			.leftJoin("public.data_businesses as db", "db.id", "dbcf.business_id")
			.select("dbcf.*")
			.where({
				"dbcf.business_id": businessId,
				"dbcf.case_id": caseId,
				"dbcf.template_id": templateId,
				"db.is_deleted": false
			});
	}

	async countBusinessCustomFields(businessId: UUID): Promise<number> {
		const countQuery = db("onboarding_schema.data_business_custom_fields")
			.leftJoin("public.data_businesses as db", "db.id", "onboarding_schema.data_business_custom_fields.business_id")
			.where("onboarding_schema.data_business_custom_fields.business_id", businessId)
			.andWhere("db.is_deleted", false)
			.count<{ total: string }>({ total: "*" });
		const count = await countQuery;
		return Number(count?.[0]?.total ?? 0);
	}

	/**
	 * Get the business custom fields for external users
	 * @param businessId - The business ID
	 * @param pagination - The pagination options
	 * @returns The business custom fields for external users
	 */
	async getBusinessCustomFieldsForExternalUsers(
		businessId: UUID,
		pagination?: { page: number; itemsPerPage: number }
	): Promise<
		Array<{
			json_build_object: DetailedBusinessCustomFields;
		}>
	> {
		const friendlyCustomFieldQuery = db
			.with("latest", qb =>
				qb
					.select(db.raw("distinct on (dbcf.case_id, dbcf.field_id) dbcf.*"))
					.from("onboarding_schema.data_business_custom_fields as dbcf")
					.leftJoin("public.data_businesses as db", "db.id", "dbcf.business_id")
					.where("dbcf.business_id", businessId)
					.andWhere("db.is_deleted", false)
			)
			.select(
				db.raw(
					`json_build_object(
						'label', dcf.label,
						'field_id', dcf.code,
						'step_name', dcf.step_name,
						'sequence_number', dcf.sequence_number,
						'value', CASE
							WHEN cfp.code = 'date' AND dbcf.field_value IS NOT NULL
							THEN TO_CHAR(TO_DATE(dbcf.field_value, 'YYYY-MM-DD'), 'MM/DD/YYYY')
							ELSE dbcf.field_value
						END,
						'data_type', cfp.label,
						'applicant_access', dcf.applicant_access,
						'customer_access', dcf.customer_access,
						'is_sensitive', dcf.is_sensitive,
						'rules', dcf.rules
					) as json_build_object`
				)
			)
			.from({ dbcf: "latest" })
			.leftJoin("onboarding_schema.data_custom_fields as dcf", "dbcf.field_id", "dcf.id")
			.leftJoin("onboarding_schema.core_field_properties as cfp", "dcf.property", "cfp.id")
			.orderBy("dcf.sequence_number");

		if (pagination) {
			const skip = (pagination.page - 1) * pagination.itemsPerPage;
			friendlyCustomFieldQuery.limit(pagination.itemsPerPage).offset(skip);
		}
		return friendlyCustomFieldQuery;
	}

	async saveBusinessCustomField(
		businessCustomField: IBusinessCustomField | IBusinessCustomFieldEgg,
		userId?: UUID
	): Promise<IBusinessCustomField | undefined> {
		const resolvedCreatedBy = userId ?? businessCustomField.created_by;
		// check if exists
		const resultValue = await db("onboarding_schema.data_business_custom_fields")
			.leftJoin("public.data_businesses as db", "db.id", "onboarding_schema.data_business_custom_fields.business_id")
			.select("onboarding_schema.data_business_custom_fields.id")
			.where({
				"onboarding_schema.data_business_custom_fields.case_id": businessCustomField.case_id,
				"onboarding_schema.data_business_custom_fields.field_id": businessCustomField.field_id,
				"onboarding_schema.data_business_custom_fields.field_value": businessCustomField.field_value,
				"onboarding_schema.data_business_custom_fields.created_by": resolvedCreatedBy
			})
			.andWhere({ "db.is_deleted": false })
			.first();

		if (resultValue?.id) return;
		// There's no updated_at/updated_by column pair so we'll always update the created_at/created_by values for the field
		let out: IBusinessCustomField[] | undefined;
		businessCustomField.created_by = resolvedCreatedBy;
		businessCustomField.created_at = new Date();
		if (businessCustomField.id) {
			out = await db<IBusinessCustomField>("onboarding_schema.data_business_custom_fields")
				.update(businessCustomField)
				.where("id", businessCustomField.id)
				.returning("*");
		}
		out = await db<IBusinessCustomField>("onboarding_schema.data_business_custom_fields")
			.insert(businessCustomField)
			.onConflict("id")
			.merge()
			.returning("*");
		if (out && out.length) {
			return out[0];
		}
	}

	/* Chain selects for custom fields off this (To make sure property is always overwritten) */
	private getBaseCustomField(): Knex.QueryBuilder<ICustomField, ICustomField[]> {
		return db<ICustomField>("onboarding_schema.data_custom_fields")
			.join("onboarding_schema.core_field_properties as props", "props.id", "data_custom_fields.property")
			.select("data_custom_fields.*", "props.code as property");
	}

	/**
	 * Retrieves custom fields summary for a customer
	 * @param customerId - The customer UUID
	 * @returns Array of custom field summaries with field, type, and label
	 */
	async getCustomerCustomFieldsSummary(customerId: UUID): Promise<ICustomerCustomFieldsSummary[]> {
		const subquery = db("onboarding_schema.data_custom_fields as dcf")
			.join("onboarding_schema.data_custom_templates as dct", "dcf.template_id", "dct.id")
			.join("onboarding_schema.core_field_properties as cfp", "dcf.property", "cfp.id")
			.where("dct.customer_id", customerId)
			.select(
				"dcf.code as field",
				"cfp.code as type",
				"dcf.label",
				"dct.version",
				db.raw(
					`ROW_NUMBER() OVER (PARTITION BY dcf.code ORDER BY dct.version DESC) as rn`
				)
			)
			.as("t");

		const result = await db
			.from(subquery)
			.where("rn", 1)
			.select("field", "type", "label");

		return result;
	}
}

export const onboardingServiceRepository = new OnboardingServiceRepository();
