/**
 * @fileoverview
 * Controller to handle risk bucket configurations for a customer.
 */
import type { UUID } from "crypto";
import { catchAsync } from "#utils/index";
import { RiskBucketService } from "./riskBucketService";
import type { RiskMonitoringContainer } from "../container";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

export function createRiskBucketController(container: RiskMonitoringContainer) {
	return {
		listRiskBuckets: catchAsync(async (req, res) => {
			const activeOnly = String(req.query?.active_only ?? false)?.toLowerCase() !== "false";
			const service = new RiskBucketService(req.params.customerID as UUID, container.riskBucketRepository);
			const response = await service.list(activeOnly);
			res.jsend.success(response, "Risk buckets listed successfully");
		}),
		getRiskBucket: catchAsync(async (req, res) => {
			const service = new RiskBucketService(req.params.customerID as UUID, container.riskBucketRepository);
			const response = await service.get(req.params.bucketID);
			res.jsend.success(response, "Risk bucket retrieved successfully");
		}),
		createRiskBucket: catchAsync(async (req, res) => {
			const userId = res.locals.user?.user_id;
			if (!userId) {
				throw new RiskMonitoringApiError("User not authenticated", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
			}
			const service = new RiskBucketService(req.params.customerID as UUID, container.riskBucketRepository);
			const response = await service.create(req.body, userId as UUID);
			res.jsend.success(response, "Risk bucket created successfully");
		}),
		updateRiskBucket: catchAsync(async (req, res) => {
			const userId = res.locals.user?.user_id;
			if (!userId) {
				throw new RiskMonitoringApiError("User not authenticated", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
			}
			const service = new RiskBucketService(req.params.customerID as UUID, container.riskBucketRepository);
			const response = await service.update(req.params.bucketID, req.body, userId as UUID);
			res.jsend.success(response, "Risk bucket updated successfully");
		}),
		deleteRiskBucket: catchAsync(async (req, res) => {
			const service = new RiskBucketService(req.params.customerID as UUID, container.riskBucketRepository);
			const response = await service.delete(req.params.bucketID);
			res.jsend.success(response, "Risk bucket deleted successfully");
		})
	};
}
