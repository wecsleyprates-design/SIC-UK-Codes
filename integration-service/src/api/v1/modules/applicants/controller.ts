import { catchAsync } from "#utils/index";
import { applicants } from "./applicants";

export const controller = {
	getBusinessPlaidTransactions: catchAsync(async (req, res) => {
		const response = await applicants.getBusinessPlaidTransactions(req.params, req.query, res.locals.user, req.headers);
		res.jsend.success(response, "Banking transactions fetched successfully.");
	}),

	getBusinessTransactionAccounts: catchAsync(async (req, res) => {
		const response = await applicants.getBusinessTransactionAccounts(req.params, req.query, res.locals.user, req.headers);
		res.jsend.success(response, "Banking accounts fetched successfully.");
	}),

	getAccountBalances: catchAsync(async (req, res) => {
		const response = await applicants.getAccountBalances(req.params, req.query);
		res.jsend.success(response, "Banking account balances fetched successfully.");
	}),

	getTransactionsStats: catchAsync(async (req, res) => {
		const response = await applicants.getTransactionsStats(req.params, req.query, res.locals.user, req.headers);
		res.jsend.success(response, "Transactions stats fetched successfully.");
	}),

	getTransactionYears: catchAsync(async (req, res) => {
		const response = await applicants.getTransactionYears(req.params, req.query, res.locals.user, req.headers);
		res.jsend.success(response, "Transactions years fetched successfully.");
	}),

	getBalancesStats: catchAsync(async (req, res) => {
		const response = await applicants.getBalancesStats(req.params, req.query, res.locals.user, req.headers);
		res.jsend.success(response, "Balances stats fetched successfully.");
	}),

	getBalanceSheetStats: catchAsync(async (req, res) => {
		const response = await applicants.getBalanceSheetStats(req.params, req.query, res.locals.user, req.headers);
		res.jsend.success(response, "Balances sheet stats fetched successfully.");
	}),

	getIncomeStatementStats: catchAsync(async (req, res) => {
		const response = await applicants.getIncomeStatementStats(req.params, req.query, res.locals.user, req.headers);
		res.jsend.success(response, "Income statement stats fetched successfully.");
	}),

	exportBusinessTransactionsAsCSV: catchAsync(async (req, res) => {
		const response = await applicants.exportBusinessTransactionsAsCSV(req.params, req.query, res.locals.user, req.headers);
		res.jsend.success(response, "Transaction export generated successfully.");
	})
};
