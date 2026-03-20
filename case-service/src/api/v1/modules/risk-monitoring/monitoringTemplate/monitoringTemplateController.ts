import type { UUID } from "crypto";
import { catchAsync } from "#utils/index";
import { MonitoringTemplateService } from "./monitoringTemplateService";
import { ERROR_CODES } from "#constants/index";
import { StatusCodes } from "http-status-codes";
import type { RiskMonitoringContainer } from "../container";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";

export function createMonitoringTemplateController(container: RiskMonitoringContainer) {
	return {
		listTemplates: catchAsync(async (req, res) => {
			const service = new MonitoringTemplateService(req.params.customerID as UUID, container.templateRepository);
			const response = await service.list();
			res.jsend.success(response, "Monitoring templates listed successfully");
		}),
		createTemplate: catchAsync(async (req, res) => {
			const userId = res.locals.user?.user_id;
			if (!userId) {
				throw new RiskMonitoringApiError("User not authenticated", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
			}
			const service = new MonitoringTemplateService(req.params.customerID as UUID, container.templateRepository);
			const response = await service.create(req.body, userId as UUID);
			res.jsend.success(response, "Monitoring template created successfully");
		}),
		getTemplate: catchAsync(async (req, res) => {
			const service = new MonitoringTemplateService(req.params.customerID as UUID, container.templateRepository);
			const response = await service.get(req.params.templateID as UUID);
			res.jsend.success(response, "Monitoring template retrieved successfully");
		}),
		updateTemplate: catchAsync(async (req, res) => {
			const userId = res.locals.user?.user_id;
			if (!userId) {
				throw new RiskMonitoringApiError("User not authenticated", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
			}
			const service = new MonitoringTemplateService(req.params.customerID as UUID, container.templateRepository);
			const response = await service.update(req.params.templateID as UUID, req.body, userId as UUID);
			res.jsend.success(response, "Monitoring template updated successfully");
		}),
		deleteTemplate: catchAsync(async (req, res) => {
			const service = new MonitoringTemplateService(req.params.customerID as UUID, container.templateRepository);
			const response = await service.delete(req.params.templateID as UUID);
			res.jsend.success(response, "Monitoring template deleted successfully");
		})
	};
}
