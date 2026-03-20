import { catchAsync } from "#utils/index";
import { ProgressionService } from "./service";

export const controller = {
	getProgression: catchAsync(async (req, res) => {
		const response = await ProgressionService.getProgression(req.params, req.query, req.headers);
		if (response.success) {
			res.jsend.success(response, "Progression fetched successfully (v2)");
		} else {
			res.jsend.fail(response.message ?? "Request failed", response.status);
		}
	})
};
