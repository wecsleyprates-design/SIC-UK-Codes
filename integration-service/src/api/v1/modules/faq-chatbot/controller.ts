import { Request } from "express";
import { catchAsync } from "#utils/index";
import { Response } from "#types";
import { faqChatbotService } from "./faqChatbotService";

export const controller = {
	submitUserQuery: catchAsync(async (req: Request, res: Response) => {
		const response = await faqChatbotService.submitUserQuery(req.body);
		res.jsend.success(response, "FAQ chatbot successfully responded.");
	})
};
