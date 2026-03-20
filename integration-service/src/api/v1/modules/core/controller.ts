import type { UUID } from "crypto";
import type { Request, Response } from "#types/index";
import { updateBusinessDetailS3 } from "#common/index";
import { catchAsync } from "#utils/index";
import { core } from "./core";
import { IntegrationsCompletionTracker } from "#helpers/integrationsCompletionTracker";
import * as integrationGroups from "./integrationGroups";
import { ROLES } from "#constants";

export const controller = {
	internalGetConnectedIntegrations: catchAsync(async (req: Request, res: Response) => {
		const response = await core.internalGetConnectedIntegrations(req.params as any);
		res.jsend.success(response.data, response.message);
	}),

	getConnectedIntegrations: catchAsync(async (req: Request, res: Response) => {
		const response = await core.getConnectedIntegrations(req.params as any, res.locals.user, req.headers as any);
		res.jsend.success(response, "Integrations Fetched Successfuly");
	}),

	populateBusinessDetails: catchAsync(async (req: Request, res: Response) => {
		await updateBusinessDetailS3(req.params.businessID);
		res.jsend.success({}, "Business Details Populated Successfully");
	}),

	updateConnectionStatusToSuccess: catchAsync(async (req: Request, res: Response) => {
		const response = await core.updateConnectionStatusToSuccess(req.body);
		res.jsend.success(response, "Connection status updated to SUCCESS for given platform");
	}),

	businessMetadata: catchAsync(async (req: Request, res: Response) => {
		const response = await core.businessMetadata(Object.keys(req.body || {}).length ? req.body : req.query);
		res.jsend.success(response, "Business Metadata Fetched Successfully");
	}),

	getCaseVerifications: catchAsync(async (req: Request, res: Response) => {
		const response = await core.getCaseVerifications(req.params as any);
		res.jsend.success(response, "Verification data fetched successfully");
	}),

	getIntegrationsMetadata: catchAsync(async (req: Request, res: Response) => {
		const response = await core.getIntegrationsMetadata(req.params as any);
		res.jsend.success(response, "Integrations metadata fetched successfully");
	}),

	rerunIntegrations: catchAsync(async (req: Request, res: Response) => {
		const response = await core.rerunIntegrations(req.params, req.body);
		const message = response?.errors?.length ? "Integrations rerun with errors." : "Integrations rerun successfully";
		res.jsend.success(response, message);
	}),

	synchronousStateUpdate: catchAsync(async (req: Request, res: Response) => {
		const response = await core.synchronousStateUpdate(req.body);
		res.jsend.success(response, "Business synchronous state update processed successfully");
	}),

	getIntegrationGroups: catchAsync(async (req: Request, res: Response) => {
		const isAdminOrInternal = !res.locals.user || res.locals.user?.role?.code === ROLES.ADMIN;
		const { with_integrations } = req.query as { with_integrations: string | undefined };
		const withIntegrations: boolean = isAdminOrInternal && with_integrations === "true";
		const data = await integrationGroups.getGroupsWithIntegrations(withIntegrations);
		res.jsend.success(data, "Integration groups fetched");
	}),

	getIntegrationTasks: catchAsync(async (_req: Request, res: Response) => {
		const data = await integrationGroups.getIntegrationTasks();
		res.jsend.success(data, "Integration tasks fetched");
	}),

	createIntegrationGroup: catchAsync(async (req: Request, res: Response) => {
		const data = await integrationGroups.createGroup(req.body as integrationGroups.CreateGroupInput);
		res.jsend.success(data, "Integration group created");
	}),

	updateIntegrationGroup: catchAsync(async (req: Request, res: Response) => {
		const id = Number(req.params.id);
		const data = await integrationGroups.updateGroup(id, req.body as integrationGroups.UpdateGroupInput);
		res.jsend.success(data, "Integration group updated");
	}),

	deleteIntegrationGroup: catchAsync(async (req: Request, res: Response) => {
		const id = Number(req.params.id);
		await integrationGroups.deleteGroup(id);
		res.jsend.success({ id }, "Integration group deleted");
	}),

	addIntegrationToGroup: catchAsync(async (req: Request, res: Response) => {
		const integrationGroup = Number(req.params.id);
		const integrationTask = (req.body as { integration_task: number }).integration_task;
		const data = await integrationGroups.addIntegrationToGroup(integrationGroup, integrationTask);
		res.jsend.success(data, "Integration added to group");
	}),

	removeIntegrationFromGroup: catchAsync(async (req: Request, res: Response) => {
		const integrationGroup = Number(req.params.id);
		const integrationTask = Number(req.params.integrationTaskId);
		await integrationGroups.removeIntegrationFromGroup(integrationGroup, integrationTask);
		res.jsend.success({ removed: true }, "Integration removed from group");
	}),

	testGetAllRequiredTasks: catchAsync(async (req: Request, res: Response) => {
		const { businessID, customerID } = req.params;
		const requiredTasks = await IntegrationsCompletionTracker.getAllRequiredTasks(
			businessID as UUID,
			(customerID as UUID) || null
		);
		res.jsend.success(
			{
				businessID,
				customerID: customerID || null,
				requiredTasks,
				taskCount: Object.values(requiredTasks).flat().length,
				categories: Object.keys(requiredTasks).map(k => ({
					categoryId: Number(k),
					tasks: requiredTasks[Number(k)]
				}))
			},
			"Required tasks fetched successfully"
		);
	})
};
