import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";
import { RiskAlertRepository } from "./riskAlertRepository";
import type { RiskAlertRow, RiskAlertBody } from "../riskMonitoringTypes";

export type RiskAlertWithRelations = RiskAlertRow & { rule_ids?: string[] };

export class RiskAlertService {
	readonly customerId: UUID;
	private readonly riskAlertRepo: RiskAlertRepository;

	constructor(customerId: UUID, riskAlertRepo: RiskAlertRepository) {
		this.customerId = customerId;
		this.riskAlertRepo = riskAlertRepo;
	}

	async list(): Promise<{ records: RiskAlertWithRelations[]; total_items: number }> {
		const records = await this.riskAlertRepo.listByCustomerWithRules(this.customerId);
		return { records, total_items: records.length };
	}

	async get(alertID: UUID): Promise<RiskAlertWithRelations> {
		const row = await this.riskAlertRepo.getByIdAndCustomer(alertID, this.customerId);
		if (!row) {
			throw new RiskMonitoringApiError("Risk alert not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		const ruleIds = await this.riskAlertRepo.getRuleIdsByAlertId(row.id);
		return { ...row, rule_ids: ruleIds };
	}

	async create(body: RiskAlertBody, userId: UUID): Promise<RiskAlertWithRelations> {
		const isActive = body.is_active ?? true;
		const routing = body.routing ?? {};
		const alert = await this.riskAlertRepo.create({
			customer_id: this.customerId,
			label: body.label,
			description: body.description ?? null,
			is_active: isActive,
			category_id: body.category_id ?? null,
			bucket_id: body.bucket_id ?? null,
			routing,
			created_by: userId,
			updated_by: userId
		});
		const ruleIds = body.rule_ids ?? [];
		if (ruleIds.length) {
			await this.riskAlertRepo.replaceRules(alert.id, ruleIds, userId);
		}
		return this.get(alert.id);
	}

	async update(alertID: UUID, body: Partial<RiskAlertBody>, userId: UUID): Promise<RiskAlertWithRelations> {
		await this.get(alertID);
		const updateData: Parameters<RiskAlertRepository["update"]>[2] = {
			updated_by: userId
		};
		if (body.label !== undefined) {
			updateData.label = body.label;
		}
		if (body.description !== undefined) {
			updateData.description = body.description;
		}
		if (body.is_active !== undefined) {
			updateData.is_active = body.is_active;
		}
		if (body.category_id !== undefined) {
			updateData.category_id = body.category_id;
		}
		if (body.bucket_id !== undefined) {
			updateData.bucket_id = body.bucket_id;
		}
		if (body.routing !== undefined) {
			updateData.routing = body.routing;
		}

		await this.riskAlertRepo.update(alertID, this.customerId, updateData);
		if (body.rule_ids !== undefined) {
			await this.riskAlertRepo.replaceRules(alertID, body.rule_ids, userId);
		}
		return this.get(alertID);
	}

	async delete(alertID: UUID): Promise<{ deleted: true; id: UUID }> {
		const deleted = await this.riskAlertRepo.delete(alertID, this.customerId);
		if (!deleted) {
			throw new RiskMonitoringApiError("Risk alert not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return { deleted: true, id: alertID };
	}
}
