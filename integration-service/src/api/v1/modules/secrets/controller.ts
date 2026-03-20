import { catchAsync } from "#utils/index";
import { secretsManagerService as service } from "./secrets";
import type { Request } from "express";
import type { Response } from "#types/index";

export const controller = {
	createSecret: catchAsync(async (req: Request, res: Response) => {
		const secret = await service.createSecret(req.body);
		return res.jsend.success(secret, "Secret created");
	}),

	getSecret: catchAsync(async (req: Request, res: Response) => {
		const secret = await service.getSecret(req.params.customer_id);
		return res.jsend.success(secret, "Secret retrieved");
	}),

	updateSecret: catchAsync(async (req: Request, res: Response) => {
		const secret = await service.updateSecret(req.params.customer_id, req.body);
		return res.jsend.success(secret, "Secret updated");
	}),

	deleteSecret: catchAsync(async (req: Request, res: Response) => {
		const secret = await service.deleteSecret(req.params.customer_id);
		return res.jsend.success(secret, "Secret deleted");
	})
};
