import { Request } from "express";
import { catchAsync } from "#utils/index";
import { Response } from "#types";
import { getDataScrapeService } from "./dataScrapeService";
import { UUID } from "crypto";
import { getGoogleProfileMatchResult, searchGoogleProfileMatchResult } from "./dataScrape";
import { StatusCodes } from "http-status-codes";

export const controller = {
	searchForBusiness: catchAsync(async (req: Request, res: Response) => {
		const typedBusinessID = req.params.businessID as UUID;
		const service = await getDataScrapeService(typedBusinessID);
		const response = await service.searchSerpAPI({
			businessID: typedBusinessID,
			businessName: req.body.businessName,
			businessDbaNames: req.body.businessDbaName ? [req.body.businessDbaName] : [],
			businessAddress: req.body.businessAddress,
			persistGoogleReviews: req.body.persistGoogleReviews,
			is_bulk: req.body.is_bulk
		});
		res.jsend.success(response, response.message || "Matches found in search for business details.");
	}),

	getSerpResult: catchAsync(async (req: Request, res: Response) => {
		const typedBusinessID = req.params.businessID as UUID;
		const service = await getDataScrapeService(typedBusinessID);
		const result = await service.getLatestSerpResultForBusiness(typedBusinessID);
		if (!result) {
			res.jsend.error("No meaningful SERP data found for this business.");
			return;
		}
		res.jsend.success(result, "Matches found in search for business details.");
	}),

	searchGoogleProfile: catchAsync(async (req: Request, res: Response) => {
		const businessID = req.params.businessID as UUID;
		const taskId = await searchGoogleProfileMatchResult(businessID);

		if (!taskId) {
			res.jsend.error("Failed to create Google profile fetch task.");
			return;
		}

		res.jsend.success({ taskId }, "Google profile fetch completed successfully.");
	}),

	getGoogleProfile: catchAsync(async (req: Request, res: Response) => {
		const businessID = req.params.businessID as UUID;
		const result = await getGoogleProfileMatchResult(businessID);

		if (!result) {
			res.jsend.error("No meaningful SERP data found for this business.", StatusCodes.NOT_FOUND);
			return;
		}

		res.jsend.success(result, "Google profile data retrieved successfully.");
	})
};
