import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";
import { RiskCategoryRepository } from "./riskCategoryRepository";
import type { RiskCategoryRow, RiskCategoryBody } from "../riskMonitoringTypes";

export class RiskCategoryService {
	readonly customerId: UUID;
	private readonly riskCategoryRepo: RiskCategoryRepository;

	constructor(customerId: UUID, riskCategoryRepo: RiskCategoryRepository) {
		this.customerId = customerId;
		this.riskCategoryRepo = riskCategoryRepo;
	}

	async list(activeOnly = true): Promise<{ records: RiskCategoryRow[]; total_items: number }> {
		const records = await this.riskCategoryRepo.listByCustomer(this.customerId, activeOnly);
		return { records, total_items: records.length };
	}

	async get(id: UUID): Promise<RiskCategoryRow> {
		const row = await this.riskCategoryRepo.getByIdAndCustomer(id, this.customerId);
		if (!row) {
			throw new RiskMonitoringApiError("Risk category not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return row;
	}

	async create(body: RiskCategoryBody, userId: UUID): Promise<RiskCategoryRow> {
		const isActive = body.is_active ?? true;
		return this.riskCategoryRepo.create({
			customer_id: this.customerId,
			label: body.label,
			is_active: isActive,
			created_by: userId,
			updated_by: userId
		});
	}

	async update(id: UUID, body: Partial<RiskCategoryBody>, userId: UUID): Promise<RiskCategoryRow> {
		const updated = await this.riskCategoryRepo.update(id, this.customerId, {
			...(body.label !== undefined && { label: body.label }),
			...(body.is_active !== undefined && { is_active: body.is_active }),
			updated_by: userId
		});
		if (!updated) {
			throw new RiskMonitoringApiError("Risk category not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return updated;
	}

	async delete(id: UUID): Promise<{ deleted: true; id: UUID }> {
		const deleted = await this.riskCategoryRepo.delete(id, this.customerId);
		if (!deleted) {
			throw new RiskMonitoringApiError("Risk category not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return { deleted: true, id };
	}
}
