/**
 * @fileoverview
 * Idempotent init: copies categories, buckets, templates and risk alerts from the seed customer (in DB)
 * to the target customer. Only runs when the target customer has no existing templates and no risk alerts.
 * Seed data is defined in migration 20260212184753-seed-customer-templates.
 * All inserts run in a single transaction; one failure rolls back the entire init.
 */
import type { UUID } from "crypto";
import type { RiskMonitoringContainer } from "../container";
import { TemplateRepository } from "../monitoringTemplate/monitoringTemplateRepository";
import { RiskCategoryRepository } from "../riskCategory/riskCategoryRepository";
import { RiskBucketRepository } from "../riskBucket/riskBucketRepository";
import { RiskAlertRepository } from "../riskAlert/riskAlertRepository";
import { SEED_CUSTOMER_ID } from "../constants";

export interface InitResult {
	initialized: boolean;
	reason?: "already_initialized";
	templates_created?: number;
	alerts_created?: number;
	categories_created?: number;
	buckets_created?: number;
}

export class InitService {
	private readonly container: RiskMonitoringContainer;

	constructor(container: RiskMonitoringContainer) {
		this.container = container;
	}

	async initCustomer(customerId: UUID, userId: UUID): Promise<InitResult> {
		const { db, templateRepository, riskAlertRepository, riskCategoryRepository, riskBucketRepository } =
			this.container;

		const [templates, alerts] = await Promise.all([
			templateRepository.listByCustomer(customerId as UUID),
			riskAlertRepository.listByCustomer(customerId as UUID)
		]);

		if (templates.length > 0 || alerts.length > 0) {
			return { initialized: false, reason: "already_initialized" };
		}

		const seedCategories = await riskCategoryRepository.listByCustomer(SEED_CUSTOMER_ID as UUID, false);
		const seedBuckets = await riskBucketRepository.listByCustomer(SEED_CUSTOMER_ID as UUID, false);
		const seedTemplates = await templateRepository.listByCustomer(SEED_CUSTOMER_ID);
		const seedAlerts = await riskAlertRepository.listByCustomer(SEED_CUSTOMER_ID as UUID);

		return await db.transaction(async trx => {
			const categoryRepo = new RiskCategoryRepository(trx);
			const bucketRepo = new RiskBucketRepository(trx);
			const templateRepo = new TemplateRepository(trx);
			const alertRepo = new RiskAlertRepository(trx);

			// Copy categories for target customer (same order as seed)
			const categoryIdMap = new Map<string, UUID>();
			for (const category of seedCategories) {
				const row = await categoryRepo.create({
					customer_id: customerId as UUID,
					label: category.label,
					is_active: category.is_active,
					created_by: userId as UUID,
					updated_by: userId as UUID
				});
				categoryIdMap.set(category.id, row.id);
			}

			// Copy buckets for target customer (same order as seed)
			const bucketIdMap = new Map<string, UUID>();
			for (const bucket of seedBuckets) {
				const row = await bucketRepo.create({
					customer_id: customerId as UUID,
					label: bucket.label,
					is_active: bucket.is_active,
					created_by: userId as UUID,
					updated_by: userId as UUID
				});
				bucketIdMap.set(bucket.id, row.id);
			}

			// Copy templates (with integration_groups and rule_ids)
			for (const t of seedTemplates) {
				const integrationGroups = await templateRepository.getIntegrationGroupsByTemplateId(t.id);
				const ruleIds = await templateRepository.getRuleIdsByTemplateId(t.id);
				const template = await templateRepo.create({
					customer_id: customerId as UUID,
					priority: t.priority,
					is_active: t.is_active,
					is_default: t.is_default,
					label: t.label,
					created_by: userId,
					updated_by: userId
				});
				if (integrationGroups.length > 0 || ruleIds.length > 0) {
					await templateRepo.setIntegrationGroupsAndRules(template.id, integrationGroups, ruleIds, userId);
				}
			}

			// Copy alerts (with rule_ids); map category_id and bucket_id to new customer's ids
			for (const alert of seedAlerts) {
				const ruleIds = await riskAlertRepository.getRuleIdsByAlertId(alert.id);
				const newCategoryId = alert.category_id ? (categoryIdMap.get(alert.category_id) ?? null) : null;
				const newBucketId = alert.bucket_id ? (bucketIdMap.get(alert.bucket_id) ?? null) : null;
				const alertRow = await alertRepo.create({
					customer_id: customerId as UUID,
					label: alert.label,
					description: alert.description ?? null,
					is_active: alert.is_active,
					category_id: newCategoryId,
					bucket_id: newBucketId,
					routing: alert.routing ?? {},
					created_by: userId as UUID,
					updated_by: userId as UUID
				});
				if (ruleIds.length > 0) {
					await alertRepo.replaceRules(alertRow.id, ruleIds as UUID[], userId as UUID);
				}
			}

			const [templatesAfter, alertsAfter, categoriesAfter, bucketsAfter] = await Promise.all([
				templateRepo.listByCustomer(customerId),
				alertRepo.listByCustomer(customerId as UUID),
				categoryRepo.listByCustomer(customerId as UUID, false),
				bucketRepo.listByCustomer(customerId as UUID, false)
			]);

			return {
				initialized: true,
				templates_created: templatesAfter.length,
				alerts_created: alertsAfter.length,
				categories_created: categoriesAfter.length,
				buckets_created: bucketsAfter.length
			};
		});
	}
}
