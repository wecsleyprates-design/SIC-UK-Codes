import { catchAsync } from "#utils";
import { electronicConsent } from "./electronic-consent";

export const controller = {
	createSession: catchAsync(async (req, res) => {
		const response = await electronicConsent.createSession(req.params, req.body, req.headers);
		res.jsend.success(response, "Session created successfully");
	})
};
