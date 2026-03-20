import { catchAsync } from "#utils";
import { riskMonitoringDueRefresh } from "../../../../../cron/jobs/risk-monitoring-due-refresh";
import type { RiskMonitoringContainer } from "../container";
import type { UUID } from "crypto";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

export function createMonitoringRunController(_container: RiskMonitoringContainer) {
	return {
		runRefresh: catchAsync(async (req, res) => {
			const customerId = req.params.customerID as UUID | undefined;
			if (!customerId) {
				throw new RiskMonitoringApiError("Customer ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.UNKNOWN_ERROR);
			}
			await riskMonitoringDueRefresh(customerId);

			res.jsend.success({}, "Refreshes queued successfully");
		})
	};
}
