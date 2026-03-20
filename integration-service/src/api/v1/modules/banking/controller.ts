import { catchAsync } from "#utils/index";
import { banking } from "./banking";

export const controller = {
	plaidLinkInit: catchAsync(async (req, res) => {
		const response = await banking.plaidLinkInit(req.params, req.headers, req.body);
		res.jsend.success(response.data, response.message);
	}),

	getDepositAccount: catchAsync(async (req, res) => {
		const response = await banking.getDepositAccount(req.params);
		res.jsend.success(response, "Deposit account details fetched successfully");
	}),

	getDepositAccountInfo: catchAsync(async (req, res) => {
		const response = await banking.getDepositAccountInfo(req.params, req.headers, res.locals.user);
		res.jsend.success(response, "Deposit account details fetched successfully");
	}),

	setDepositAccountInfo: catchAsync(async (req, res) => {
		const response = await banking.setDepositAccountInfo(req.params, req.body, req.headers, res.locals.user);
		res.jsend.success(response, "Deposit account details have been set successfully");
	}),

	plaidTokenExchange: catchAsync(async (req, res) => {
		const response = await banking.plaidTokenExchange(req.body, req.params, req.headers, res.locals.user);
		res.jsend.success(response, "Token Exchanged successfully");
	}),

	handleAssetReportWebhook: catchAsync(async (req, res) => {
		const response = await banking.enqueueAssetReportWebhook(req.body);
		res.jsend.success(response);
	}),

	enqueueLinkWebhook: catchAsync(async (req, res) => {
		const response = await banking.enqueueLinkWebhook(req.body);
		res.jsend.success(response);
	}),

	refreshBankingAssets: catchAsync(async (req, res) => {
		const response = await banking.refreshBankingAssets(req.body, req.params);
		res.jsend.success(response);
	}),

	getBankingInformation: catchAsync(async (req, res) => {
		const response = await banking.getBankingInformation(req.params, req.query);
		res.jsend.success(response.data, response.message);
	}),

	getBankingTradeLines: catchAsync(async (req, res) => {
		const response = await banking.getBankingTradeLines(req.params, req.query);
		res.jsend.success(response.data, response.message);
	}),

	revokePlaidConnection: catchAsync(async (req, res) => {
		const response = await banking.revokePlaidConnection(req.params, req.query, req.headers, res.locals.user);
		res.jsend.success(response, "Banking connection has been revoked successfully.");
	}),
	getAllAccountInfo: catchAsync(async (req, res) => {
		const response = await banking.getAllBankingAccounts(req.params, req.query);
		res.jsend.success(response, "Bank account information fetched successfully.");
	}),
	getAdditionalAccountInfo: catchAsync(async (req, res) => {
		const response = await banking.getAdditionalAccountInfo(req.params, req.query);
		res.jsend.success(response, "Additional account information fetched successfully.");
	}),

	setAdditionalAccountInfo: catchAsync(async (req, res) => {
		const response = await banking.setAdditionalAccountInfo(req.params, req.body, req.headers, res.locals.user);
		res.jsend.success(response, "Additional account information has been set successfully");
	}),

	updateAdditionalAccountInfo: catchAsync(async (req, res) => {
		const response = await banking.updateAdditionalAccountInfo(req.params, req.body, req.headers, res.locals.user);
		res.jsend.success(response, "Additional account information has been updated successfully");
	}),

	deleteAdditionalAccountInfo: catchAsync(async (req, res) => {
		const response = await banking.deleteAdditionalAccountInfo(req.params, req.body, req.headers, res.locals.user);
		res.jsend.success(response, "Additional account information has been deleted successfully");
	}),

	addBankStatement: catchAsync(async (req, res) => {
		const response = await banking.addBankStatement(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Statements added successfully");
	}),

	getBankStatements: catchAsync(async (req, res) => {
		const response = await banking.getBankStatements(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Success");
	}),

	getUploadedBankStatements: catchAsync(async (req, res) => {
		const response = await banking.getUploadedBankStatements(req.params, req.body);
		res.jsend.success(response, "Uploaded statements retrieved successfully!");
	}),

	deleteBankStatement: catchAsync(async (req, res) => {
		const response = await banking.deleteBankStatement(req.params, res.locals.user);
		res.jsend.success(response, "Statement removed successfully.");
	})
};
