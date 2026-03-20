/**
 * @fileoverview
 * Service to handle monitoring template operations.
 */
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";
import { TemplateRepository } from "./monitoringTemplateRepository";
import type { Cadence, MonitoringTemplateBody, MonitoringTemplateRow } from "../riskMonitoringTypes";

type TemplateWithRelations = MonitoringTemplateRow & {
	integration_groups?: Array<{ integration_group: number; cadence: Cadence }>;
	rule_ids?: UUID[];
	last_run_at?: string | null;
	business_count?: number;
};

function withRelations(row: MonitoringTemplateRow): TemplateWithRelations {
	return { ...row };
}

export class MonitoringTemplateService {
	readonly customerId: UUID;
	private readonly templateRepo: TemplateRepository;

	constructor(customerId: UUID, templateRepo: TemplateRepository) {
		this.customerId = customerId;
		this.templateRepo = templateRepo;
	}

	async list() {
		const rows = await this.templateRepo.listByCustomer(this.customerId);
		const templates: TemplateWithRelations[] = rows.map(withRelations);
		for (const t of templates) {
			// Parallelize for increased throughput
			const [integrationGroups, ruleIds, lastRunAt, businessCount] = await Promise.all([
				this.templateRepo.getIntegrationGroupsByTemplateId(t.id),
				this.templateRepo.getRuleIdsByTemplateId(t.id),
				this.templateRepo.getLastRunAtByTemplateId(t.id),
				this.templateRepo.getBusinessCountByTemplateId(t.id)
			]);
			t.integration_groups = integrationGroups;
			t.rule_ids = ruleIds;
			t.last_run_at = lastRunAt;
			t.business_count = businessCount;
		}
		return { records: templates, total_items: templates.length };
	}

	/**
	 *	Get a monitoring template by its ID.
	 * @param templateID - The ID of the monitoring template to get.
	 * @returns The monitoring template.
	 * @throws RiskMonitoringApiError if the monitoring template is not found.
	 */
	async get(templateID: UUID): Promise<TemplateWithRelations> {
		const row = await this.templateRepo.getByIdAndCustomer(templateID, this.customerId);
		if (!row) {
			throw new RiskMonitoringApiError("Monitoring template not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		const template = withRelations(row);
		template.integration_groups = await this.templateRepo.getIntegrationGroupsByTemplateId(template.id);
		template.rule_ids = await this.templateRepo.getRuleIdsByTemplateId(template.id);
		template.last_run_at = await this.templateRepo.getLastRunAtByTemplateId(template.id);
		template.business_count = await this.templateRepo.getBusinessCountByTemplateId(template.id);
		return template;
	}

	async create(body: MonitoringTemplateBody, userId: UUID): Promise<TemplateWithRelations> {
		const priority = body.priority ?? 0;
		const isActive = body.is_active ?? true;
		const isDefault = body.is_default ?? false;

		if (isActive) {
			const existing = await this.templateRepo.getActiveTemplateIdByCustomerAndPriority(this.customerId, priority);
			if (existing) {
				throw new RiskMonitoringApiError(
					"Another active template for this customer already has this priority. Each active template must have a unique priority.",
					StatusCodes.CONFLICT,
					ERROR_CODES.INVALID
				);
			}
		}
		if (isDefault) {
			await this.templateRepo.clearOtherDefaultsForCustomer(this.customerId);
		}
		const template = await this.templateRepo.create({
			customer_id: this.customerId,
			priority,
			is_active: isActive,
			is_default: isDefault,
			label: body.label,
			created_by: userId,
			updated_by: userId
		});
		if (!template) {
			throw new RiskMonitoringApiError(
				"Failed to create template",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		const integrationGroups = body.integration_groups ?? [];
		const ruleIds = body.rule_ids ?? [];
		if (integrationGroups.length || ruleIds.length) {
			await this.templateRepo.setIntegrationGroupsAndRules(template.id, integrationGroups, ruleIds, userId);
		}

		const result = withRelations(template);
		result.integration_groups = integrationGroups;
		result.rule_ids = ruleIds;
		result.last_run_at = null;
		result.business_count = 0;
		return result;
	}

	async update(templateID: UUID, body: Partial<MonitoringTemplateBody>, userId: UUID): Promise<TemplateWithRelations> {
		const existing = await this.get(templateID);
		const priority = body.priority !== undefined ? body.priority : existing.priority;
		const isActive = body.is_active !== undefined ? body.is_active : existing.is_active;
		const isDefault = body.is_default !== undefined ? body.is_default : existing.is_default;
		const label = body.label !== undefined ? body.label : existing.label;

		if (isDefault) {
			await this.templateRepo.clearOtherDefaultsForCustomer(this.customerId, templateID);
		}
		if (isActive) {
			const conflictId = await this.templateRepo.getActiveTemplateIdByCustomerAndPriority(
				this.customerId,
				priority,
				templateID
			);
			if (conflictId) {
				throw new RiskMonitoringApiError(
					"Another active template for this customer already has this priority. Each active template must have a unique priority.",
					StatusCodes.CONFLICT,
					ERROR_CODES.INVALID
				);
			}
		}

		const updated = await this.templateRepo.update(templateID, this.customerId, {
			priority,
			is_active: isActive,
			is_default: isDefault,
			label,
			updated_by: userId
		});
		if (!updated) {
			throw new RiskMonitoringApiError("Monitoring template not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		if (body.integration_groups !== undefined) {
			await this.templateRepo.replaceIntegrationGroups(templateID, body.integration_groups, userId);
		}
		if (body.rule_ids !== undefined) {
			await this.templateRepo.replaceRules(templateID, body.rule_ids);
		}

		return this.get(templateID);
	}

	async delete(templateID: UUID) {
		const existing = await this.get(templateID);
		if (existing.is_default) {
			throw new RiskMonitoringApiError(
				"Default template cannot be deleted",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		const deleted = await this.templateRepo.delete(templateID, this.customerId);
		if (!deleted) {
			throw new RiskMonitoringApiError("Monitoring template not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return { deleted: true, id: templateID };
	}
}
