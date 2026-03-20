import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";
import { RiskBucketRepository } from "./riskBucketRepository";
import type { RiskBucketRow, RiskBucketBody } from "../riskMonitoringTypes";

export class RiskBucketService {
	readonly customerId: UUID;
	private readonly riskBucketRepo: RiskBucketRepository;

	constructor(customerId: UUID, riskBucketRepo: RiskBucketRepository) {
		this.customerId = customerId;
		this.riskBucketRepo = riskBucketRepo;
	}

	async list(activeOnly = true): Promise<{ records: RiskBucketRow[]; total_items: number }> {
		const records = await this.riskBucketRepo.listByCustomer(this.customerId, activeOnly);
		return { records, total_items: records.length };
	}

	async get(id: UUID): Promise<RiskBucketRow> {
		const row = await this.riskBucketRepo.getByIdAndCustomer(id, this.customerId);
		if (!row) {
			throw new RiskMonitoringApiError("Risk bucket not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return row;
	}

	async create(body: RiskBucketBody, userId: UUID): Promise<RiskBucketRow> {
		const isActive = body.is_active ?? true;
		return this.riskBucketRepo.create({
			customer_id: this.customerId,
			label: body.label,
			is_active: isActive,
			created_by: userId,
			updated_by: userId
		});
	}

	async update(id: UUID, body: Partial<RiskBucketBody>, userId: UUID): Promise<RiskBucketRow> {
		const updated = await this.riskBucketRepo.update(id, this.customerId, {
			...(body.label !== undefined && { label: body.label }),
			...(body.is_active !== undefined && { is_active: body.is_active }),
			updated_by: userId
		});
		if (!updated) {
			throw new RiskMonitoringApiError("Risk bucket not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return updated;
	}

	async delete(id: UUID): Promise<{ deleted: true; id: UUID }> {
		const deleted = await this.riskBucketRepo.delete(id, this.customerId);
		if (!deleted) {
			throw new RiskMonitoringApiError("Risk bucket not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return { deleted: true, id };
	}
}
