import type { RiskMonitoringContainer } from "./container";
import { getRiskMonitoringContainer } from "./container";
import { createMonitoringTemplateController } from "./monitoringTemplate/monitoringTemplateController";
import { createBusinessTemplateController } from "./businessTemplate/businessTemplateController";
import { createRiskCategoryController } from "./riskCategory/riskCategoryController";
import { createRiskBucketController } from "./riskBucket/riskBucketController";
import { createRiskAlertController } from "./riskAlert/riskAlertController";
import { createInitController } from "./init/initController";
import { createMonitoringRunController } from "./monitoringRun/monitoringRunController";

export function createController(container: RiskMonitoringContainer) {
	return {
		...createMonitoringTemplateController(container),
		...createBusinessTemplateController(container),
		...createRiskCategoryController(container),
		...createRiskBucketController(container),
		...createRiskAlertController(container),
		...createInitController(container),
		...createMonitoringRunController(container)
	};
}

export const controller = createController(getRiskMonitoringContainer());
