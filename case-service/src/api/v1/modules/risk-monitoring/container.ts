/**
 * @fileoverview
 * DI container for risk-monitoring module. Holds db and repository instances.
 * Controllers receive the container and instantiate services with customerId (and businessId where needed).
 */
import type { Knex } from "knex";
import { db as defaultDb } from "#helpers/index";
import { TemplateRepository } from "./monitoringTemplate/monitoringTemplateRepository";
import { MonitoringRunRepository } from "./monitoringRun/monitoringRunRepository";
import { RiskCategoryRepository } from "./riskCategory/riskCategoryRepository";
import { RiskBucketRepository } from "./riskBucket/riskBucketRepository";
import { RiskAlertRepository } from "./riskAlert/riskAlertRepository";

export type RiskMonitoringDb = Knex;

export interface RiskMonitoringContainer {
	db: RiskMonitoringDb;
	templateRepository: TemplateRepository;
	runRepository: MonitoringRunRepository;
	riskCategoryRepository: RiskCategoryRepository;
	riskBucketRepository: RiskBucketRepository;
	riskAlertRepository: RiskAlertRepository;
}

export function getRiskMonitoringContainer(db: RiskMonitoringDb = defaultDb): RiskMonitoringContainer {
	return {
		db,
		templateRepository: new TemplateRepository(db),
		runRepository: new MonitoringRunRepository(db),
		riskCategoryRepository: new RiskCategoryRepository(db),
		riskBucketRepository: new RiskBucketRepository(db),
		riskAlertRepository: new RiskAlertRepository(db)
	};
}
