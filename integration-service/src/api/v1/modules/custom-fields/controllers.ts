import { catchAsync } from "#utils/catchAsync";
import { logger } from "#helpers/logger";
import type { NextFunction, Request } from "express";
import type { Response } from "#types/index";
import type { UUID } from "crypto";
import { CustomFieldsService } from "./custom-fields";
import type { UpdateCustomFieldsRequestBody } from "./types";

export const controller = {
	/**
	 * GET /custom-fields/business/:businessID/override/:fieldId?
	 */
	getCustomFields: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const businessID = req.params.businessID as UUID;
		const fieldId = req.params.fieldId as UUID | undefined;
		const customerID = (req.query.customerID ?? res.locals.user?.customer_id) as UUID;

		if (!customerID) {
			throw new Error("Customer ID is required");
		}

		const customFields = await CustomFieldsService.getCustomFields({
			businessID,
			customerID
		});

		if (fieldId) {
			const field = customFields.find(f => f.field_id === fieldId);
			res.jsend.success(field ?? {}, "Custom field fetched successfully");
			return;
		}

		res.jsend.success(customFields, "Custom fields fetched successfully");
	}),

	/**
	 * PATCH/PUT /custom-fields/business/:businessID/override/:fieldId?
	 * 
	 * Body format (same as facts override):
	 * {
	 *   "[fieldId]": { "value": "...", "comment": "..." },
	 *   ...
	 * }
	 */
	updateCustomFields: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const userID = res.locals?.user?.user_id ?? (req.query.userId as UUID);
		if (!userID) {
			throw new Error("User ID is required");
		}

		const businessID = req.params.businessID as UUID;
		const fieldId = req.params.fieldId as UUID | undefined;
		const customerID = (req.query.customerID ?? res.locals.user?.customer_id) as UUID;

		if (!customerID) {
			throw new Error("Customer ID is required");
		}

		const overrides: UpdateCustomFieldsRequestBody = req.body;

		// If fieldId is in URL, validate it matches the body
		if (fieldId) {
			if (!overrides[fieldId]) {
				throw new Error(`Field ${fieldId} does not exist in the request body`);
			}
			if (Object.keys(overrides).length !== 1) {
				throw new Error("Only one field may be provided when specifying fieldId in URL");
			}
		}

		await CustomFieldsService.updateCustomFields(overrides, {
			method: req.method as "PATCH" | "PUT",
			userID,
			customerID,
			businessID
		});

		// Return same format as facts override
		res.jsend.success(overrides, "Custom field override update has been successfully queued");
	}),

	/**
	 * DELETE /custom-fields/business/:businessID/override/:fieldId?
	 * 
	 * Body format: { "fieldIds": ["uuid1", "uuid2"] } or use fieldId in URL
	 */
	deleteCustomFields: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const userID = res.locals?.user?.user_id ?? (req.query.userId as UUID);
		if (!userID) {
			throw new Error("User ID is required");
		}

		const businessID = req.params.businessID as UUID;
		const fieldId = req.params.fieldId as UUID | undefined;
		const customerID = (req.query.customerID ?? res.locals.user?.customer_id) as UUID;

		if (!customerID) {
			throw new Error("Customer ID is required");
		}

		let fieldIds: string[] = [];
		if (fieldId) {
			fieldIds = [fieldId];
		} else if (req.body?.fieldIds && Array.isArray(req.body.fieldIds)) {
			fieldIds = req.body.fieldIds;
		}

		const result = await CustomFieldsService.deleteCustomFields(fieldIds, {
			method: "DELETE",
			userID,
			customerID,
			businessID
		});

		logger.info({ businessID, fieldIdsCount: fieldIds.length }, "Custom fields deleted");

		res.jsend.success(result, "Custom field deleted successfully");
	})
};
