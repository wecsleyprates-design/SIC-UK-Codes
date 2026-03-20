import { templateSchema } from "./monitoringTemplate/monitoringTemplateSchema";
import { businessTemplateSchema } from "./businessTemplate/businessTemplateSchema";
import { riskCategorySchema } from "./riskCategory/riskCategorySchema";
import { riskBucketSchema } from "./riskBucket/riskBucketSchema";
import { riskAlertSchema } from "./riskAlert/riskAlertSchema";
import { initSchema } from "./init/initSchema";
import { monitoringRunSchema } from "./monitoringRun/monitoringRunSchema";

export const schema = {
	...templateSchema,
	...businessTemplateSchema,
	...riskCategorySchema,
	...riskBucketSchema,
	...riskAlertSchema,
	...initSchema,
	...monitoringRunSchema
};
