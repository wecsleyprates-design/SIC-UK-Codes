import type { UUID } from "crypto";
import { catchAsync } from "#utils/index";
import { MonitoringTemplateService } from "../monitoringTemplate/monitoringTemplateService";
import { BusinessTemplateService } from "./businessTemplateService";
import type { RiskMonitoringContainer } from "../container";

export function createBusinessTemplateController(container: RiskMonitoringContainer) {
	return {
		setBusinessTemplate: catchAsync(async (req, res) => {
			const customerId = req.params.customerID as UUID;
			const businessId = req.params.businessID as UUID;
			const templateService = new MonitoringTemplateService(customerId, container.templateRepository);
			const service = new BusinessTemplateService(
				customerId,
				businessId,
				container.templateRepository,
				templateService
			);
			const response = await service.set(req.body);
			res.jsend.success(response, "Business monitoring template set successfully");
		}),
		getBusinessTemplate: catchAsync(async (req, res) => {
			const customerId = req.params.customerID as UUID;
			const businessId = req.params.businessID as UUID;
			const service = new BusinessTemplateService(
				customerId,
				businessId,
				container.templateRepository,
				new MonitoringTemplateService(customerId, container.templateRepository)
			);
			const response = await service.get();
			res.jsend.success(response, "Business monitoring template retrieved successfully");
		})
	};
}
