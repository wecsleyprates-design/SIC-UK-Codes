/**
 * @fileoverview
 * Handle Business<->Risk Template relationships for a customer. Stateful: construct with customer_id + business_id.
 */
import type { UUID } from "crypto";
import { TemplateRepository } from "../monitoringTemplate/monitoringTemplateRepository";
import type { MonitoringTemplateService } from "../monitoringTemplate/monitoringTemplateService";
import type { BusinessTemplateBody } from "../riskMonitoringTypes";

export class BusinessTemplateService {
	readonly customerId: UUID;
	readonly businessId: UUID;
	private readonly templateRepo: TemplateRepository;
	private readonly templateService: InstanceType<typeof MonitoringTemplateService>;

	constructor(
		customerId: UUID,
		businessId: UUID,
		templateRepo: TemplateRepository,
		templateService: InstanceType<typeof MonitoringTemplateService>
	) {
		this.customerId = customerId;
		this.businessId = businessId;
		this.templateRepo = templateRepo;
		this.templateService = templateService;
	}

	async set(body: BusinessTemplateBody) {
		await this.templateService.get(body.template_id);
		await this.templateRepo.upsertBusinessTemplate(this.businessId, this.customerId, body.template_id);
		return {
			business_id: this.businessId,
			customer_id: this.customerId,
			template_id: body.template_id
		};
	}

	async get() {
		const row = await this.templateRepo.getBusinessTemplate(this.businessId, this.customerId);
		return { template_id: row?.template_id ?? null };
	}
}
