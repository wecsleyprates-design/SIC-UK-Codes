/**
 * API controller for GET /business/:businessId/case/:caseId/values.
 * Resolves task IDs (public records, adverse media) and delegates to core Manager.
 */

import type { NextFunction, Request, Response } from "express";
import type { UUID } from "crypto";
import { catchAsync } from "#utils/catchAsync";
import { getCaseTabValues, recordCaseResultsExecutionCompleted } from "#core/case-tab-values";
import { toApiResponse } from "#core/case-tab-values/mappers";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { fetchIntegrationTasks } from "#common/common-new";
import { INTEGRATION_ID } from "#constants";
import { invalidateCaseTabValuesCache } from "#middlewares/cache.middleware";

export const controller = {
	getCaseTabValues: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const businessId = req.params.businessId as UUID;
		const caseId = req.params.caseId as UUID;

		const [verdataTaskResult, adverseTasksResult] = await Promise.allSettled([
			TaskManager.getLatestTaskForBusiness(
				businessId,
				INTEGRATION_ID.VERDATA,
				"fetch_public_records",
				true,
				"",
				caseId
			),
			fetchIntegrationTasks({
				caseId,
				integrationPlatformId: INTEGRATION_ID.ADVERSE_MEDIA,
			}),
		]);

		const verdataTaskId =
			verdataTaskResult.status === "fulfilled" && verdataTaskResult.value?.id
				? verdataTaskResult.value.id
				: null;
		const adverseMediaTaskIds =
			adverseTasksResult.status === "fulfilled" && adverseTasksResult.value
				? (adverseTasksResult.value as Array<{ id: string }>).map((t) => t.id).filter(Boolean)
				: [];

		const domain = await getCaseTabValues({
			businessId,
			caseId,
			verdataTaskId,
			adverseMediaTaskIds: adverseMediaTaskIds.length > 0 ? adverseMediaTaskIds : null,
		});

		const apiResponse = toApiResponse(domain);
		res.locals.cacheOutput = {
			data: apiResponse,
			message: "Case tab values fetched successfully",
		};
		return next();
	}),

	/** Called when re-run completes: updates case_results_executions.updated_at so GET /values returns updated_at and isRegenerated is true. */
	acknowledgeCaseTabValues: catchAsync(async (req: Request, res: Response) => {
		const businessId = req.params.businessId as UUID;
		const caseId = req.params.caseId as UUID;
		const result = await recordCaseResultsExecutionCompleted(caseId);
		await invalidateCaseTabValuesCache(businessId, caseId);
		res.status(200).json({
			status: "success",
			data: result,
			message: "Case tab values acknowledged.",
		});
	}),
};
