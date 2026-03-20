import { Request } from "express";
import { catchAsync } from "#utils/index";
import { Response } from "#types";
import { whiteLabelService } from "./whiteLabelService";
import { type CustomerSettingsBody } from "./schema";

export const controller = {
	createCustomerSettings: catchAsync(async (req: Request<{ customerId: string }, CustomerSettingsBody>, res: Response) => {
		const response = await whiteLabelService.createCustomerSettings(req.params, req.body, req.headers.authorization);
		const responseWithImages = await whiteLabelService.addImagesInResponse(response);
		res.jsend.success(responseWithImages, "Created customer settings successfully.");
	}),
	updatePartialCustomerSetting: catchAsync(async (req: Request<{ customerId: string }, Partial<CustomerSettingsBody>>, res: Response) => {
		const response = await whiteLabelService.updatePartialCustomerSettings(req.params, req.body, req.headers.authorization);
		const responseWithImages = await whiteLabelService.addImagesInResponse(response);
		res.jsend.success(responseWithImages, "Updated customer settings successfully.");
	}),
	getCustomerSettings: catchAsync(async (req: Request<{ domain: string }>, res: Response) => {
		const response = await whiteLabelService.getCustomerSettingsDomain(req.params.domain);
		const responseWithImages = await whiteLabelService.addImagesInResponse(response);
		res.jsend.success(responseWithImages, "Customer settings fetched successfully.");
	}),
	getCustomerSettingsById: catchAsync(async (req: Request<{ customerId: string }>, res: Response) => {
		const response = await whiteLabelService.getCustomerSettingsById(req.params.customerId);
		const responseWithImages = await whiteLabelService.addImagesInResponse(response);
		res.jsend.success(responseWithImages, "Get customer settings successfully.");
	}),
	uploadWhiteLabelFile: catchAsync(async (req: Request<{ customerId: string }>, res: Response) => {
		if (!req.file) {
			return res.jsend.fail({}, "File is required");
		}

		const response = await whiteLabelService.uploadFileCustomerSettings(req.file, req.params.customerId, req.body.domain, req.body.type, req.headers.authorization);
		return res.jsend.success(response, "File uploaded successfully.");
	}),
	addIdentityInSES: catchAsync(async (req: Request<{ email: string }>, res: Response) => {
		const response = await whiteLabelService.addIdentityInSES(req.body.email);
		res.jsend.success("", response.message);
	})
};
