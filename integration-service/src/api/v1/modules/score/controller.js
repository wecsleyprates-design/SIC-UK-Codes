import { catchAsync } from "#utils/index";
import { score } from "./score";

export const controller = {
	getBankingData: catchAsync(async (req, res) => {
		const response = await score.getBankingData(req.body);
		res.jsend.success(response, "Success");
	}),

	getPublicRecords: catchAsync(async (req, res) => {
		const response = await score.getPublicRecords(req.body);
		res.jsend.success(response, "Success");
	})
};
