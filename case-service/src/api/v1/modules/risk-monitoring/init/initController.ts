/**
 * @fileoverview
 * Controller to handle initialization of risk monitoring for a customer:
 * - Copies templates, categories, buckets, risk alerts from the seed customer to the target customer.
 * - Only runs when the target customer has no existing templates and no risk alerts.
 * - Seed data is defined in migration 20260212184753-seed-customer-templates.
 */
import { catchAsync } from "#utils/index";
import { StatusCodes } from "http-status-codes";
import { InitService } from "./initService";
import type { RiskMonitoringContainer } from "../container";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";
import type { UUID } from "crypto";

export function createInitController(container: RiskMonitoringContainer) {
	const initService = new InitService(container);
	return {
		initCustomer: catchAsync(async (req, res) => {
			const userId = res.locals.user?.user_id;
			if (!userId) {
				throw new RiskMonitoringApiError("User not authenticated", StatusCodes.UNAUTHORIZED);
			}
			const customerId = req.params.customerID as UUID;
			if (!customerId) {
				throw new RiskMonitoringApiError("Customer ID is required", StatusCodes.BAD_REQUEST);
			}
			const result = await initService.initCustomer(customerId, userId);
			// When already initialized, it's a no-op but customer already in the desired state so it's still a 200/Success!
			res.jsend.success(
				result,
				result.initialized
					? `Risk monitoring initialized for customer ${customerId}`
					: `Risk monitoring already initialized for customer ${customerId}`
			);
		})
	};
}
