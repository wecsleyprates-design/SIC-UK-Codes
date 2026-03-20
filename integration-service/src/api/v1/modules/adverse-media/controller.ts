import { catchAsync } from "#utils/index";
import { adverseMedia } from "./adverse-media";

export const controller = {
	getAdverseMediaByBusinessId: catchAsync(async (req, res) => {
		const response = await adverseMedia.getAdverseMediaByBusinessId(req.params, req.query);
		res.jsend.success(response, "Adverse Media data fetched successfully");
	}),

	getAdverseMediaDataByCaseId: catchAsync(async (req, res) => {
		const response = await adverseMedia.getAdverseMediaDataByCaseId(req.params, req.query);
		res.jsend.success(response, "Adverse Media data fetched successfully");
	}),

	debugAdverseMedia: catchAsync(async (req, res) => {
		const response = await adverseMedia.debugAdverseMedia(req.body);
		res.jsend.success(response, "Event sent successfully");
	})
};
