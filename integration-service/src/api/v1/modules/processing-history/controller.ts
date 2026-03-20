import { catchAsync } from "#utils";
import { processingHistory } from "./processingHistory";

export const controller = {
	 getProcessingHistory: catchAsync(async (req, res) => {
		const response = await processingHistory.getProcessingHistory(req.params, req.query);
		res.jsend.success(response, "Successfully fetched processing history");
	 }),
	 addProcessingHistory: catchAsync(async (req, res) => {
		const response = await processingHistory.addProcessingHistory(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Successfully added processing history");
	 })

}