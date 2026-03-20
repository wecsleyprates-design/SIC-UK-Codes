/**
 * @fileoverview
 * Controller to handle risk alert configurations for a customer.
 */
import type { UUID } from "crypto";
import { catchAsync } from "#utils/index";
import { RiskAlertService } from "./riskAlertService";
import { ERROR_CODES } from "#constants/index";
import { StatusCodes } from "http-status-codes";
import type { RiskMonitoringContainer } from "../container";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";

export function createRiskAlertController(container: RiskMonitoringContainer) {
	return {
		listRiskAlerts: catchAsync(async (req, res) => {
			const service = new RiskAlertService(req.params.customerID as UUID, container.riskAlertRepository);
			const response = await service.list();
			res.jsend.success(response, "Risk alerts listed successfully");
		}),
		getRiskAlert: catchAsync(async (req, res) => {
			const service = new RiskAlertService(req.params.customerID as UUID, container.riskAlertRepository);
			const response = await service.get(req.params.alertID);
			res.jsend.success(response, "Risk alert retrieved successfully");
		}),
		createRiskAlert: catchAsync(async (req, res) => {
			const userId = res.locals.user?.user_id;
			if (!userId) {
				throw new RiskMonitoringApiError("User not authenticated", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
			}
			const service = new RiskAlertService(req.params.customerID as UUID, container.riskAlertRepository);
			const response = await service.create(req.body, userId as UUID);
			res.jsend.success(response, "Risk alert created successfully");
		}),
		updateRiskAlert: catchAsync(async (req, res) => {
			const userId = res.locals.user?.user_id;
			if (!userId) {
				throw new RiskMonitoringApiError("User not authenticated", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
			}
			const service = new RiskAlertService(req.params.customerID as UUID, container.riskAlertRepository);
			const response = await service.update(req.params.alertID, req.body, userId as UUID);
			res.jsend.success(response, "Risk alert updated successfully");
		}),
		deleteRiskAlert: catchAsync(async (req, res) => {
			const service = new RiskAlertService(req.params.customerID as UUID, container.riskAlertRepository);
			const response = await service.delete(req.params.alertID);
			res.jsend.success(response, "Risk alert deleted successfully");
		})
	};
}
