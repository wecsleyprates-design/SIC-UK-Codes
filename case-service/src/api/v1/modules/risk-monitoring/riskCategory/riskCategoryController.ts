/**
 * @fileoverview
 * Controller to handle risk category configurations for a customer.
 */
import type { UUID } from "crypto";
import { catchAsync } from "#utils/index";
import { RiskCategoryService } from "./riskCategoryService";
import { ERROR_CODES } from "#constants/index";
import { StatusCodes } from "http-status-codes";
import type { RiskMonitoringContainer } from "../container";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";

export function createRiskCategoryController(container: RiskMonitoringContainer) {
	return {
		listRiskCategories: catchAsync(async (req, res) => {
			const activeOnly = String(req.query?.active_only ?? false)?.toLowerCase() !== "false";
			const service = new RiskCategoryService(req.params.customerID as UUID, container.riskCategoryRepository);
			const response = await service.list(activeOnly);
			res.jsend.success(response, "Risk categories listed successfully");
		}),
		getRiskCategory: catchAsync(async (req, res) => {
			const service = new RiskCategoryService(req.params.customerID as UUID, container.riskCategoryRepository);
			const response = await service.get(req.params.categoryID);
			res.jsend.success(response, "Risk category retrieved successfully");
		}),
		createRiskCategory: catchAsync(async (req, res) => {
			const userId = res.locals.user?.user_id;
			if (!userId) {
				throw new RiskMonitoringApiError("User not authenticated", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
			}
			const service = new RiskCategoryService(req.params.customerID as UUID, container.riskCategoryRepository);
			const response = await service.create(req.body, userId as UUID);
			res.jsend.success(response, "Risk category created successfully");
		}),
		updateRiskCategory: catchAsync(async (req, res) => {
			const userId = res.locals.user?.user_id;
			if (!userId) {
				throw new RiskMonitoringApiError("User not authenticated", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
			}
			const service = new RiskCategoryService(req.params.customerID as UUID, container.riskCategoryRepository);
			const response = await service.update(req.params.categoryID, req.body, userId as UUID);
			res.jsend.success(response, "Risk category updated successfully");
		}),
		deleteRiskCategory: catchAsync(async (req, res) => {
			const service = new RiskCategoryService(req.params.customerID as UUID, container.riskCategoryRepository);
			const response = await service.delete(req.params.categoryID);
			res.jsend.success(response, "Risk category deleted successfully");
		})
	};
}
