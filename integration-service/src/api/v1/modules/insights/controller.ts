import { Request } from "express";
import { catchAsync } from "#utils/index";
import { Response } from "#types";
import { insightsService } from "./insightsService";

export const controller = {
	getInsights: catchAsync(async (req: Request<{ caseId: string }>, res: Response) => {
		const response = await insightsService.getInsightsReport(req.params, req.headers.authorization ?? "missing_authorization");
		res.jsend.success(response, "Retrieved insights report successfully.");
	}),

	submitUserQuery: catchAsync(async (req: Request, res: Response) => {
		const response = await insightsService.submitUserQuery(req.body);
		res.jsend.success(response, "Insights chatbot successfully responded.");
	}),

	getActionItems: catchAsync(async (req: Request<{ caseId: string }>, res: Response) => {
		const response = await insightsService.getActionItems(req.params);
		res.jsend.success(response, "Retrieved action items successfully.");
	}),

	updateActionItem: catchAsync(async (req: Request<{ actionItemId: string }>, res: Response) => {
		const response = await insightsService.updateActionItem(req.params, req.body);
		res.jsend.success(response, "Updated action item successfully.");
	}),

	deleteActionItems: catchAsync(async (req: Request<{ caseId: string }>, res: Response) => {
		const response = await insightsService.deleteActionItems(req.params, req.body);
		res.jsend.success(response, "Deleted action items successfully.");
	}),

	createActionItem: catchAsync(async (req: Request<{ caseId: string }>, res: Response) => {
		const response = await insightsService.createActionItem(req.params, req.body);
		res.jsend.success(response, "Created action item successfully.");
	})
};
