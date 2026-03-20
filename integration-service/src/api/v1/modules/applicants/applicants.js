import { getBusinessApplicants, logger, producer, sqlQuery, sqlTransaction } from "#helpers/index";
import { escapeRegExp, getStartEndUTC, paginate, parseFloatNum, toMDY, decryptData } from "#utils/index";
import { StatusCodes } from "http-status-codes";
import { ApplicantsApiError } from "./error";
import { ERROR_CODES, INTEGRATION_ID, ROLES, kafkaEvents, kafkaTopics, DIRECTORIES } from "#constants";
import dayjs from "dayjs";
import currency from "currency.js";
import { getCachedSignedUrl, uploadFile } from "#utils/s3";
import { envConfig } from "#configs/index";
import XLSX from "xlsx";

class Applicants {
	/**
	 * This functions returns the latest transaction details of plaid
	 * @param {businessID} businessID
	 * @returns array of objects having transaction details
	 */

	async getBusinessTransactionAccounts({ businessID }, query, userInfo, { authorization }) {
		await this.assertCanSeeBusiness(businessID, userInfo, authorization);

		const platformId = this.platformNameToId("plaid");
		let getPlaidTransactionAccountsQuery;
		let getPlaidTransactionAccountsValues = [];
		let isTaskDataPresentInRelTaskBankAccounts = false;
		if (query?.caseID) {
			const bankingTaskRelAccounts = await this.getBankingTaskAndCheckRelTaskBankAccounts(businessID, query.caseID);
			isTaskDataPresentInRelTaskBankAccounts = bankingTaskRelAccounts.isTaskDataPresentInRelTaskBankAccounts;

			if (isTaskDataPresentInRelTaskBankAccounts) {
				getPlaidTransactionAccountsValues = [bankingTaskRelAccounts.taskId];
			}
		}

		if (isTaskDataPresentInRelTaskBankAccounts) {
			getPlaidTransactionAccountsQuery = `
				SELECT DISTINCT ba.bank_account, ba.bank_name, ba.official_name, ba.institution_name, ba.type, ba.subtype
				FROM integration_data.rel_task_bank_account AS rtba
				JOIN integration_data.bank_accounts AS ba ON ba.id = ANY(rtba.bank_account_id) 
				WHERE rtba.business_integration_task_id = $1`;
		} else {
			// this means business was onboarded previously so there's no linking of task and bank account in rel table
			// so we have to fetch all bank accounts associated with the given business ID
			getPlaidTransactionAccountsQuery = `
				SELECT DISTINCT ba.bank_account, ba.bank_name, ba.official_name, ba.institution_name, ba.type, ba.subtype
				FROM integration_data.bank_account_transactions
				JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = bank_account_transactions.business_integration_task_id
				LEFT JOIN integration_data.bank_accounts ba ON ba.id = bank_account_transactions.bank_account_id
				JOIN integrations.data_connections dc on dbit.connection_id = dc.id
				WHERE dc.business_id = $1 AND dc.platform_id = $2`;

			getPlaidTransactionAccountsValues = [businessID, platformId];
		}

		const getPlaidTransactionAccountsResult = await sqlQuery({
			sql: getPlaidTransactionAccountsQuery,
			values: getPlaidTransactionAccountsValues
		});

		const result = getPlaidTransactionAccountsResult.rows.map(account => {
			return {
				bank_account: account.bank_account,
				account_name: account.bank_name,
				official_name: account.official_name,
				institution_name: account.institution_name,
				type: account.type || null,
				subtype: account.subtype || null
			};
		});

		return result;
	}

	async getBusinessPlaidTransactions({ businessID }, query, userInfo, { authorization }) {
		try {
			await this.assertCanSeeBusiness(businessID, userInfo, authorization);

			let pagination = true;

			if (Object.hasOwn(query, "pagination")) {
				pagination = JSON.parse(query.pagination);
			}

			let itemsPerPage, page;
			if (pagination) {
				itemsPerPage = 20;
				if (query.items_per_page) {
					itemsPerPage = query.items_per_page;
				}

				page = 1;
				if (query.page) {
					page = query.page;
				}
			}

			let queryParams = "";

			const allowedSortParams = ["bank_account_transactions.date"];
			const sortByAmountParams = ["bank_account_transactions.amount"];
			let sortByAmount = false;
			let sortParam = "bank_account_transactions.date";
			let sortParamValue = "DESC";
			if (query.sort) {
				const param = Object.keys(query.sort)[0];
				if (allowedSortParams.includes(param)) {
					sortParam = param;
					sortParamValue = query.sort[sortParam];
				}
				if (sortByAmountParams.includes(param)) {
					sortByAmount = true;
				}
			}

			const allowedFilterParams = ["filter_account", "filter_account_name"];
			const filterColumnMap = {
				filter_account: "ba.bank_account",
				filter_account_name: "ba.bank_name"
			};
			let existingFilterParamsValues = [];
			if (query.filter) {
				existingFilterParamsValues = Object.keys(query.filter).reduce((acc, field) => {
					if (allowedFilterParams.includes(field)) {
						let value;
						// parse string to boolean
						if (query.filter[field] === "true" || query.filter[field] === "false") {
							value = JSON.parse(query.filter[field]);
						}

						// reduce an array into a comma separated string
						if (Array.isArray(query.filter[field])) {
							value = query.filter[field].reduce((str, item) => {
								if (typeof item === "string") {
									str = str.concat(`'${item}'`, ",");
								} else {
									str = str.concat(`${item}`, ",");
								}
								return str;
							}, "");
							value = value.slice(0, -1); // remove the last comma
						} else if (typeof query.filter[field] === "string") {
							value = `'${query.filter[field]}'`;
						} else {
							value = query.filter[field].toString();
						}

						const filter = {
							column: filterColumnMap[field] ? filterColumnMap[field] : field,
							value
						};
						acc.push(filter);
						return acc;
					}
					return acc;
				}, []);
			}

			let useStrictSearchParams = false;
			const strictSearchParams = ["description"];
			const supplementaryStrictSearchParams = ["description"];

			// Make sure all search params columns are mentioned here
			const columnSearchBehavior = {
				description: "contains"
			};

			const allowedSearchParams = ["description"];
			let existingSearchParams = [];
			const existingSearchParamsValue = new Set();
			if (query.search) {
				existingSearchParams = Object.keys(query.search).filter(field => allowedSearchParams.includes(field));
				if (existingSearchParams.length) {
					existingSearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();

						if (query.search[field].includes(" ")) {
							useStrictSearchParams = true;
						}
						// Split the string on spaces and for each element of the split we trim the value and add those values into the set
						// Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						// >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}

						query.search[field].split(" ").forEach(val => {
							val = escapeRegExp(val.trim());
							if (val !== "" && val !== " ") {
								existingSearchParamsValue.add(val);
							}
						});
					});
				}
			}

			// SupplementarySearchParams works in conjunction with allowedSearchParams
			const allowedSupplementarySearchParams = ["description"];

			let existingSupplementarySearchParams = [];
			const existingSupplementarySearchParamsValue = new Set();
			if (query.search) {
				existingSupplementarySearchParams = Object.keys(query.search).filter(field =>
					allowedSupplementarySearchParams.includes(field)
				);
				if (existingSupplementarySearchParams.length) {
					existingSupplementarySearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();
						// Split the string on spaces and for each element of the split we trim the value and add those values into the set
						// Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						// >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}

						query.search[field].split(" ").forEach(val => {
							val = escapeRegExp(val.trim());
							if (val !== "" && val !== " ") {
								existingSupplementarySearchParamsValue.add(val);
							}
						});
					});
				}
			}

			const allowedFilterDateParams = ["bank_account_transactions.date"];
			let existingFilterDateParamsValues = [];
			if (query.filter_date) {
				existingFilterDateParamsValues = Object.keys(query.filter_date).reduce((acc, field) => {
					if (allowedFilterDateParams.includes(field)) {
						const filterDate = {
							column: field,
							value: query.filter_date[field].toString()
						};
						acc.push(filterDate);
						return acc;
					}
					return acc;
				}, []);
			}

			// Helper function to generate search conditions based on search behavior
			function generateSearchCondition(column, value, searchBehavior) {
				switch (searchBehavior) {
					case "startsWith":
						return `${column} ILIKE '${value}%'`;
					case "contains":
						return `${column} ILIKE '%${value}%'`;
					default:
						return ""; // Handle unsupported search behaviors
				}
			}

			let counter = 1;
			if (existingFilterParamsValues.length) {
				let filter = " AND ";
				counter++;
				filter += existingFilterParamsValues
					.reduce((acc, field) => {
						acc.push(`${field.column} IN (${field.value})`);
						return acc;
					}, [])
					.join(" AND ");
				queryParams += filter;
			}

			if (existingFilterDateParamsValues.length && existingFilterDateParamsValues?.[0]?.value?.length !== 0) {
				let filterDate = " AND ";
				counter++;
				filterDate += existingFilterDateParamsValues
					.reduce((acc, field) => {
						const values = field.value.split(",");
						acc.push(`${field.column} >= '${values[0]}' AND ${field.column} <= '${values[1]}'`);
						return acc;
					}, [])
					.join(" AND ");
				queryParams += filterDate;
			}

			if (
				(existingSearchParams.length && [...existingSearchParamsValue].length) ||
				(existingSupplementarySearchParams.length && [...existingSupplementarySearchParamsValue].length)
			) {
				let search = "";
				if (counter === 0) {
					search += " WHERE (";
					counter++;
				} else {
					search += " AND (";
				}

				search += existingSearchParams.length ? " ( " : "";
				if (useStrictSearchParams) {
					search += strictSearchParams
						.flatMap(field =>
							[...existingSearchParamsValue].map(value => {
								const searchBehavior = columnSearchBehavior[field];
								return generateSearchCondition(field, value, searchBehavior);
							})
						)
						.join(" OR ");
				} else {
					search += existingSearchParams
						.flatMap(field =>
							[...existingSearchParamsValue].map(value => {
								const searchBehavior = columnSearchBehavior[field];
								return generateSearchCondition(field, value, searchBehavior);
							})
						)
						.join(" OR ");
				}

				if (existingSupplementarySearchParams.length && [...existingSupplementarySearchParamsValue].length > 1) {
					search += existingSearchParams.length ? ") AND ( " : "";
					if (useStrictSearchParams) {
						search += supplementaryStrictSearchParams
							.flatMap(field =>
								[...existingSupplementarySearchParamsValue].map(value => {
									const searchBehavior = columnSearchBehavior[field];
									return generateSearchCondition(field, value, searchBehavior);
								})
							)
							.join(" OR ");
					} else {
						search += existingSupplementarySearchParams
							.flatMap(field =>
								[...existingSupplementarySearchParamsValue].map(value => {
									const searchBehavior = columnSearchBehavior[field];
									return generateSearchCondition(field, value, searchBehavior);
								})
							)
							.join(" OR ");
					}
				}
				search += existingSearchParams.length ? " ) " : "";

				search += " )";
				queryParams += search;
			}
			let sort = ``;
			if (sortByAmount) {
				// Sort by credit / positive amount
				if (
					Object.hasOwn(query.sort, "bank_account_transactions.amount") &&
					query.sort["bank_account_transactions.amount"] === "ASC"
				) {
					// as the amount has to be sorted Ascending, hence maximum positive amount should be first
					// e.g. 100, 10, -5, -20
					sort = ` ORDER BY amount DESC `;
				} else if (
					Object.hasOwn(query.sort, "bank_account_transactions.amount") &&
					query.sort["bank_account_transactions.amount"] === "DESC"
				) {
					// Sort by debit / negative amount
					// as the amount has to be sorted Descending, hence maximum negative amount should be first
					// e.g. -100, -10, 5, 20
					sort = ` ORDER BY amount ASC `;
				}
			} else {
				sort = ` ORDER BY ${sortParam} ${sortParamValue} `;
			}

			const platformId = this.platformNameToId(query.platform || "plaid");
			let countQuery = "";
			let getPlaidTransactionsQuery = "";
			let getPlaidTransactionsValues = [];
			let isTaskDataPresentInRelTaskBankAccounts = false;
			if (query?.caseID) {
				const bankingTaskRelAccounts = await this.getBankingTaskAndCheckRelTaskBankAccounts(businessID, query.caseID);
				isTaskDataPresentInRelTaskBankAccounts = bankingTaskRelAccounts.isTaskDataPresentInRelTaskBankAccounts;

				if (isTaskDataPresentInRelTaskBankAccounts) {
					getPlaidTransactionsValues = [bankingTaskRelAccounts.taskId];
				}
			}

			if (isTaskDataPresentInRelTaskBankAccounts) {
				countQuery = `SELECT COUNT(*) as totalcount
					FROM integration_data.rel_task_bank_account AS rtba
					JOIN integration_data.bank_accounts AS ba ON ba.id = ANY(rtba.bank_account_id) 
					JOIN integration_data.bank_account_transactions ON bank_account_transactions.bank_account_id = ba.id
					WHERE rtba.business_integration_task_id = $1
					${queryParams}`;

				// Add sort to the query (errors if part of the countQuery)
				queryParams += sort;

				getPlaidTransactionsQuery = `
					SELECT integration_data.bank_account_transactions.*, ba.bank_account, ba.bank_name, ba.official_name, ba.institution_name, ba.type, ba.subtype, ba.mask
					FROM integration_data.rel_task_bank_account AS rtba
					JOIN integration_data.bank_accounts AS ba ON ba.id = ANY(rtba.bank_account_id) 
					JOIN integration_data.bank_account_transactions ON bank_account_transactions.bank_account_id = ba.id
					WHERE rtba.business_integration_task_id = $1
					${queryParams}`;
			} else {
				// this means business was onboarded previously so there's no linking of task and bank account in rel table
				// so we have to fetch all bank accounts associated with the given business ID
				countQuery = `SELECT COUNT(*) as totalcount
					FROM integration_data.bank_account_transactions
					JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = bank_account_transactions.business_integration_task_id
					LEFT JOIN integration_data.bank_accounts ba ON ba.id = bank_account_transactions.bank_account_id
					JOIN integrations.data_connections dc on dbit.connection_id = dc.id
					WHERE dc.business_id = $1 AND dc.platform_id = $2
					${queryParams}`;

				// Add sort to the query (errors if part of the countQuery)
				queryParams += sort;

				getPlaidTransactionsQuery = `
					SELECT integration_data.bank_account_transactions.*, ba.bank_account, ba.bank_name, ba.official_name, ba.institution_name, ba.type, ba.subtype, ba.mask
					FROM integration_data.bank_account_transactions
					JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = bank_account_transactions.business_integration_task_id
					LEFT JOIN integration_data.bank_accounts ba ON ba.id = bank_account_transactions.bank_account_id
					JOIN integrations.data_connections dc on dbit.connection_id = dc.id
					WHERE dc.business_id = $1 AND dc.platform_id = $2
					${queryParams}`;

				getPlaidTransactionsValues = [businessID, platformId];
			}

			const count = await sqlQuery({ sql: countQuery, values: getPlaidTransactionsValues });

			if (!count.rowCount) {
				return {
					records: [],
					total: 0,
					total_pages: 0,
					total_items: 0
				};
			}

			const totalUsers = count.rows[0].totalcount;
			if (!pagination) {
				itemsPerPage = totalUsers;
			}

			const paginationDetails = paginate(totalUsers, itemsPerPage);

			if (page > paginationDetails.totalPages && paginationDetails.totalPages !== 0) {
				throw new ApplicantsApiError("Page Requested is Out of Max Page Range", StatusCodes.BAD_REQUEST);
			}
			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				getPlaidTransactionsQuery += paginationQuery;
			}

			const plaidTransactionResult = await sqlQuery({
				sql: getPlaidTransactionsQuery,
				values: getPlaidTransactionsValues
			});

			// TODO: currently returing static balance, need to update this
			let total = 0;
			const result = plaidTransactionResult.rows.map(transaction => {
				const data = {
					date: transaction.date,
					description: transaction.description,
					merchant_name: transaction.merchant_name || null, // Merchant name from Plaid (when include_insights is true)
					currency: transaction.currency,
					transaction: parseFloatNum(transaction.amount),
					account: transaction.bank_account,
					bank_name: transaction.bank_name,
					official_name: transaction.official_name,
					institution_name: transaction.institution_name,
					account_type: transaction.type || null,
					account_subtype: transaction.subtype || null,
					mask: transaction.mask || null,
					balance: 0
				};

				total += data.balance;

				return data;
			});

			return {
				records: result,
				total,
				total_pages: parseInt(paginationDetails.totalPages),
				total_items: parseInt(paginationDetails.totalItems)
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Export bank transactions as CSV
	 * @param {businessID} businessID
	 * @param {caseID} caseID (optional)
	 * @param {userInfo} userInfo
	 * @param {authorization} authorization
	 * @returns CSV file content
	 */
	async exportBusinessTransactionsAsCSV({ businessID }, query, userInfo, { authorization }) {
		try {
			// Build query params for getBusinessPlaidTransactions
			const exportQuery = { ...query, pagination: false };

			// Calculate date range from period if provided
			if (query.period && query.period !== "All Time") {
				const now = dayjs();
				let startDate;
				switch (query.period) {
					case "7 Days":
						startDate = now.subtract(7, "day").format("YYYY-MM-DD");
						break;
					case "1 Month":
						startDate = now.subtract(1, "month").format("YYYY-MM-DD");
						break;
					case "3 Months":
						startDate = now.subtract(3, "month").format("YYYY-MM-DD");
						break;
					case "1 Year":
						startDate = now.subtract(1, "year").format("YYYY-MM-DD");
						break;
					default:
						startDate = null;
				}
				if (startDate) {
					const endDate = now.format("YYYY-MM-DD");
					exportQuery.filter_date = {
						"bank_account_transactions.date": `${startDate},${endDate}`
					};
				}
			}

			// Apply account name filter if provided
			if (query.filter_account_name && query.filter_account_name !== "All Accounts") {
				exportQuery.filter = {
					filter_account_name: query.filter_account_name
				};
			}

			// Get transactions using existing getBusinessPlaidTransactions method
			const transactionsData = await this.getBusinessPlaidTransactions({ businessID }, exportQuery, userInfo, {
				authorization
			});

			if (!transactionsData.records || transactionsData.records.length === 0) {
				throw new ApplicantsApiError("No transactions found for export", StatusCodes.NOT_FOUND);
			}

			// Helper function to format account type
			const formatAccountType = (type, subtype) => {
				if (!type && !subtype) return "";
				if (subtype) {
					return subtype.charAt(0).toUpperCase() + subtype.slice(1);
				}
				if (type) {
					return type.charAt(0).toUpperCase() + type.slice(1);
				}
				return "";
			};

			// Helper function to format currency
			const formatCurrency = (amount, _currencyCode = "USD") => {
				try {
					return currency(amount, { symbol: "", separator: ",", decimal: "." }).format();
				} catch (_e) {
					return amount.toFixed(2);
				}
			};

			// Generate entries (similar to case export pattern)
			const entries = transactionsData.records.map(transaction => {
				const currencyCode = transaction.currency || "USD";
				const amount = transaction.transaction || 0;
				const formattedAmount = formatCurrency(amount * -1, currencyCode); // Multiply by -1 as per frontend logic
				const accountType = formatAccountType(transaction.account_type, transaction.account_subtype);
				const balance =
					transaction.balance !== undefined && transaction.balance !== null
						? formatCurrency(transaction.balance, currencyCode)
						: "";

				// Format date - transaction.date might be a Date object or string
				const formattedDate = toMDY(transaction.date);

				// Decrypt the bank account number
				let decryptedAccountNumber = "";
				try {
					if (transaction.account) {
						decryptedAccountNumber = decryptData(transaction.account);
					}
				} catch (error) {
					logger.error({ error }, "Error decrypting account number for transaction export");

					// If decryption fails, use mask as fallback
					// Ensure mask is treated as a string and pad with leading zeros if it's a number
					if (transaction.mask) {
						decryptedAccountNumber = String(transaction.mask).padStart(4, "0");
					} else {
						decryptedAccountNumber = "";
					}
				}

				return {
					Date: formattedDate,
					"Merchant Name": transaction.merchant_name || "",
					Description: transaction.description,
					"Bank Account Number": decryptedAccountNumber,
					"Account Name": transaction.official_name || "",
					"Bank Name": transaction.bank_name || "",
					"Institution Name": transaction.institution_name || "",
					"Official Name": transaction.official_name || "",
					"Account Type": accountType,
					Amount: formattedAmount,
					Currency: currencyCode,
					Balance: balance
				};
			});

			// Convert to CSV using XLSX
			const workbook = XLSX.utils.book_new();
			const workSheet = XLSX.utils.json_to_sheet(entries);
			XLSX.utils.book_append_sheet(workbook, workSheet, "Sheet 1");
			const csvContent = XLSX.write(workbook, { bookType: "csv", type: "string" });

			const buffer = Buffer.from(csvContent, "utf-8");
			const fileType = "text/csv;charset=UTF-8";
			const fileName = `transactions_business_${businessID}_${query?.caseID ? `case_${query.caseID}_` : ""}${new Date().toISOString().split("T")[0]}.csv`;

			// Upload to S3
			let directory = DIRECTORIES.TRANSACTION_EXPORTS.replace(":businessID", businessID);
			if (query?.caseID) {
				directory = `${directory}/cases/${query.caseID}`;
			}
			await uploadFile({ buffer }, fileName, fileType, directory);

			// Get signed URL
			const signedUrl = await getCachedSignedUrl(fileName, directory, envConfig.AWS_ASSETS_BUCKET);

			// Send audit trail event via Kafka
			if (query?.caseID && userInfo) {
				try {
					await producer.send({
						topic: kafkaTopics.NOTIFICATIONS,
						messages: [
							{
								key: businessID,
								value: {
									event: kafkaEvents.TRANSACTION_EXPORTED_AUDIT,
									case_id: query.caseID,
									business_id: businessID,
									customer_user_id: userInfo.user_id
								}
							}
						]
					});
				} catch (auditError) {
					logger.error(`Failed to create audit trail for transaction export: ${JSON.stringify(auditError)}`);
					// Don't fail the export if audit trail fails
				}
			}

			return { file_path: signedUrl.signedRequest };
		} catch (error) {
			logger.error({ error }, "Error exporting transactions as CSV");
			throw error;
		}
	}

	/**
	 * This function returns the most recent balances of different accounts of the business
	 * @param {string} businessID
	 * @param {object} query
	 * @returns array of objects representing the institution name along with the balance
	 */
	async getAccountBalances({ businessID }, query) {
		try {
			// TODO: to check whether current applicant is having current business or not

			let queryParams = "";

			const allowedSortParams = ["institution_name", "balance"];
			let sortParam = "balance";
			let sortParamValue = "DESC";
			if (query.sort) {
				const param = Object.keys(query.sort)[0];
				if (allowedSortParams.includes(param)) {
					sortParam = param;
					sortParamValue = query.sort[sortParam];
				}
			}

			const sort = ` ORDER BY ${sortParam} ${sortParamValue} `;
			queryParams += sort;

			const getPlaidAccountBalancesQuery = `SELECT integration_data.banking_balances.*, ba.bank_name, ba.institution_name, ba.type
				FROM integration_data.banking_balances
				JOIN integration_data.bank_accounts ba ON ba.id = banking_balances.bank_account_id
				JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = banking_balances.business_integration_task_id
				JOIN integrations.data_connections dc on dbit.connection_id = dc.id
				WHERE dc.business_id = $1 AND dc.platform_id = $2 ${queryParams}
			`;

			const platformId = this.platformNameToId(query.platform || "plaid");
			const accountBalancesResult = await sqlQuery({
				sql: getPlaidAccountBalancesQuery,
				values: [businessID, platformId]
			});

			if (!accountBalancesResult.rowCount) {
				return {
					records: [],
					total: 0
				};
			}

			const institutions = {};
			let mostRecentMonth;
			accountBalancesResult.rows.forEach(row => {
				let institutionName = row.institution_name;
				if (row.type === "credit") {
					institutionName = row.bank_name;
				}
				const thisMonth = dayjs()
					.month(row.month - 1)
					.year(row.year)
					.startOf("month");
				if (!mostRecentMonth || thisMonth.isAfter(mostRecentMonth)) {
					mostRecentMonth = thisMonth;
				}
				if (mostRecentMonth.isSame(thisMonth, "month")) {
					if (
						!(institutions[institutionName]?.year === row.year && institutions[institutionName]?.month === row.month)
					) {
						institutions[institutionName] = {
							institution: institutionName,
							year: parseInt(row.year),
							month: parseInt(row.month),
							type: row.type,
							balance: 0
						};
					}
					institutions[institutionName].balance = currency(institutions[institutionName]?.balance ?? 0).add(
						row.balance
					).value;
				}
			});

			let total = 0;
			const records = Object.values(institutions).filter(item => {
				const thisMonth = dayjs()
					.month(item.month - 1)
					.year(item.year)
					.startOf("month");
				if (mostRecentMonth.isSame(thisMonth, "month")) {
					total = currency(total ?? 0).add(item.balance).value;
					return true;
				}
				return false;
			});

			return {
				records,
				total
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This functions fetches statistical data needed for charts on UI for banking (specifically transactions)
	 *
	 * @param {Object} params - The parameters for retrieving business statistics.
	 * @param {string} params.businessID - The ID of the business.
	 * @param {Object} query - The query parameters for filtering the statistics.
	 * @param {Object} userInfo - The information of the user.
	 * @returns {Object} - The business statistics.
	 */
	async getTransactionsStats({ businessID }, query, userInfo, { authorization, shouldAssertCanSeeBusiness = true }) {
		try {
			if (shouldAssertCanSeeBusiness) {
				await this.assertCanSeeBusiness(businessID, userInfo, authorization);
			}

			const baseQuery = `SELECT integration_data.bank_account_transactions.*
					FROM integration_data.bank_account_transactions
					JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = bank_account_transactions.business_integration_task_id
					JOIN integrations.data_connections dc on dbit.connection_id = dc.id
					WHERE dc.business_id = $1 AND dc.platform_id = $2 AND dc.connection_status = 'SUCCESS'
					-- Exclude Transfers from transaction statistics
					AND NOT 'transfer' = ANY(string_to_array(lower(coalesce(bank_account_transactions.category,'')),','))
					additional-queries
			`;
			const platformId = this.platformNameToId(query.platform || "plaid");
			// We have 3 different params for date filter because we need to query tables differently for different charts
			// Params are prefixed with 'deposits.', 'spendings.' and 'average_transactions.' because we need to determine which Chart / UI / Stat front end wants to apply filter on.
			// As we have different charts on UI, all work on independent date_filters. We can't apply the same date_filter to every chart

			const allowedDepositsFilterDateParams = ["deposits.bank_account_transactions.date"];
			const allowedSpendingsFilterDateParams = ["spendings.bank_account_transactions.date"];
			const allowedAverageTransactionsFilterDateParams = ["average_transactions.bank_account_transactions.date"];
			const sumTransactionsFilterDateParams = ["sum_transactions.bank_account_transactions.date"];

			let existingDepositsFilterDateValues = [];
			let existingSpendingsFilterDateValues = [];
			let existingAverageTransactionsFilterDateValues = [];
			let existingSumTransactionsFilterDateValues = [];

			// The query object is expected to have a filter_date property, which itself is an object with properties for deposits.bank_account_transactions.date, spendings.bank_account_transactions.date,
			// and average_transactions.bank_account_transactions.date. If any of these properties are missing, the code will attempt to fill them in with default values.
			// Default values for deposit UI chart would be the latest/last date a deposit was made.
			// Default values for spendings UI chart would be the latest/last date an expenditure was done.
			// Default values for average_transactions UI chart start of the year till the current date.
			if (
				!Object.hasOwn(query, "filter_date") ||
				(Object.hasOwn(query, "filter_date") &&
					!Object.hasOwn(query.filter_date, "deposits.bank_account_transactions.date")) ||
				(Object.hasOwn(query, "filter_date") &&
					!Object.hasOwn(query.filter_date, "spendings.bank_account_transactions.date")) ||
				(Object.hasOwn(query, "filter_date") &&
					!Object.hasOwn(query.filter_date, "average_transactions.bank_account_transactions.date")) ||
				(Object.hasOwn(query, "filter_date") &&
					!Object.hasOwn(query.filter_date, "sum_transactions.bank_account_transactions.date"))
			) {
				// WE replace "additional-queries" in the baseQuery with our custom sql clause
				// For latest deposit, fetch the latest row that has amount <  0. Amount <  0 is considered as deposit.
				const getLatestDepositDateQuery = baseQuery.replace(
					"additional-queries",
					"AND amount < 0 ORDER BY date DESC LIMIT 1"
				);
				// For latest spend, fetch the latest row that has amount  > 0. Amount  > 0 is considered as spending/expenditure.
				const getLatestSpendingDateQuery = baseQuery.replace(
					"additional-queries",
					"AND amount > 0 ORDER BY date DESC LIMIT 1"
				);
				const [latestDeposit, latestSpending] = await sqlTransaction(
					[getLatestDepositDateQuery, getLatestSpendingDateQuery],
					[
						[businessID, platformId],
						[businessID, platformId]
					]
				);

				// Running a loop to create filter_date object with the latest deposit and spending entries as default date for stats.
				// After the whole loop is executed, the final object would look like :
				// filter_date: {
				// 'deposits.bank_account_transactions.date': '2024-01-24T18:30:00.000Z,2024-01-25T18:30:00.000Z',
				// 'spendings.bank_account_transactions.date': '2024-01-24T18:30:00.000Z,2024-01-25T18:30:00.000Z',
				// 'average_transactions.bank_account_transactions.date': '2023-12-31T18:30:00.000Z,2024-04-18T12:23:25.101Z'
				// 'sum_transactions.bank_account_transactions.date': '2023-12-31T18:30:00.000Z,2024-04-18T12:23:25.101Z'
				// }
				if (latestDeposit.rowCount || latestSpending.rowCount) {
					query.filter_date = Object.hasOwn(query, "filter_date") ? query.filter_date : {};
					// convert latestDepositsDate to js date type
					const latestDepositsDate = latestDeposit.rows?.[0]?.date ? new Date(latestDeposit.rows[0].date) : new Date();
					// convert latestSpendingDate to js date type
					const latestSpendingDate = latestSpending.rows?.[0]?.date
						? new Date(latestSpending.rows[0].date)
						: new Date();
					if (!Object.hasOwn(query.filter_date, "deposits.bank_account_transactions.date") && latestDeposit.rowCount) {
						// get start & end date of latestDepositsDate month. Ex: If last deposit date was 4th April, fetch all transactions between 1st April to 30th April
						const { startDate, endDate } = getStartEndUTC(
							latestDepositsDate.getFullYear(),
							latestDepositsDate.getMonth() + 1
						);
						// Append "deposits.bank_account_transactions.date" to existing filter_date
						query.filter_date = {
							...query.filter_date,
							"deposits.bank_account_transactions.date": [startDate, endDate]
						};
					}
					if (
						!Object.hasOwn(query.filter_date, "spendings.bank_account_transactions.date") &&
						latestSpending.rowCount
					) {
						// get start & end date of latestDepositsDate month. Ex: If last deposit date was 4th April, fetch all transactions between 1st April to 30th April
						const { startDate, endDate } = getStartEndUTC(
							latestSpendingDate.getFullYear(),
							latestSpendingDate.getMonth() + 1
						);
						// Append "spendings.bank_account_transactions.date" to existing filter_date
						query.filter_date = {
							...query.filter_date,
							"spendings.bank_account_transactions.date": [startDate, endDate]
						};
					}
					if (!Object.hasOwn(query.filter_date, "average_transactions.bank_account_transactions.date")) {
						// Extract the year and set the starting date as 1/1/Extracted_year
						// Extract the year and set the ending date as 12/31/Extracted_year
						const latestDate = latestDepositsDate > latestSpendingDate ? latestDepositsDate : latestSpendingDate;
						const startOfTheYear = dayjs().year(latestDate.getFullYear()).startOf("year").toISOString();
						const endOfTheYear = dayjs().year(latestDate.getFullYear()).endOf("year").toISOString();
						// Ex: If Today is 4th April of 2024 and last spend entry was on 3rd of march 2024 then fetch data from 1/1/2024 to 12/31/2024
						query.filter_date = {
							...query.filter_date,
							"average_transactions.bank_account_transactions.date": [startOfTheYear, endOfTheYear]
						};
					}
					if (!Object.hasOwn(query.filter_date, "sum_transactions.bank_account_transactions.date")) {
						// Extract the year and set the starting date as 1/1/Extracted_year
						// Extract the year and set the ending date as 12/31/Extracted_year
						const latestDate = latestDepositsDate > latestSpendingDate ? latestDepositsDate : latestSpendingDate;
						const startOfTheYear = dayjs().year(latestDate.getFullYear()).startOf("year").toISOString();
						const endOfTheYear = dayjs().year(latestDate.getFullYear()).endOf("year").toISOString();
						// Ex: If Today is 4th April of 2024 and last spend entry was on 3rd of march 2024 then fetch data from 1/1/2024 to 4/4/2024
						query.filter_date = {
							...query.filter_date,
							"sum_transactions.bank_account_transactions.date": [startOfTheYear, endOfTheYear]
						};
					}
				}

				if (!latestDeposit.rowCount && !latestSpending.rowCount) {
					return {
						deposits: {
							categories: [],
							total_deposits: "N/A",
							period: []
						},
						spendings: {
							categories: [],
							total_spendings: "N/A",
							period: []
						},
						average_transactions: {
							transaction_type: {},
							period: []
						},
						sum_transactions: {
							transaction_type: {},
							period: []
						},
						last_month_delta: "N/A",
						total_balance: "N/A"
					};
				}
			}

			if (query.filter_date) {
				existingDepositsFilterDateValues = Object.keys(query.filter_date).reduce((acc, field) => {
					if (allowedDepositsFilterDateParams.includes(field)) {
						// Convert "deposits.bank_account_transactions.date" to "bank_account_transactions.date" so that it is compatible to query in db
						const filterDate = {
							column: field.replace("deposits.", ""),
							value: query.filter_date[field].toString()
						};
						acc.push(filterDate);
						return acc;
					}
					return acc;
				}, []);

				existingSpendingsFilterDateValues = Object.keys(query.filter_date).reduce((acc, field) => {
					if (allowedSpendingsFilterDateParams.includes(field)) {
						// Convert "spendings.bank_account_transactions.date" to "bank_account_transactions.date" so that it is compatible to query in db
						const filterDate = {
							column: field.replace("spendings.", ""),
							value: query.filter_date[field].toString()
						};
						acc.push(filterDate);
						return acc;
					}
					return acc;
				}, []);

				existingAverageTransactionsFilterDateValues = Object.keys(query.filter_date).reduce((acc, field) => {
					if (allowedAverageTransactionsFilterDateParams.includes(field)) {
						// Convert "average_transactions.bank_account_transactions.date" to "bank_account_transactions.date" so that it is compatible to query in db
						const filterDate = {
							column: field.replace("average_transactions.", ""),
							value: query.filter_date[field].toString()
						};
						acc.push(filterDate);
						return acc;
					}
					return acc;
				}, []);

				existingSumTransactionsFilterDateValues = Object.keys(query.filter_date).reduce((acc, field) => {
					if (sumTransactionsFilterDateParams.includes(field)) {
						// Convert "sum_transactions.bank_account_transactions.date" to "bank_account_transactions.date" so that it is compatible to query in db
						const filterDate = {
							column: field.replace("sum_transactions.", ""),
							value: query.filter_date[field].toString()
						};
						acc.push(filterDate);
						return acc;
					}
					return acc;
				}, []);
			}

			// An internal function that build filterDate query that will be apended to base query later on
			const appendFilterDate = (queryParams, filterDateValues) => {
				let filterDate = " AND ";
				filterDate += filterDateValues
					.reduce((acc, field) => {
						const values = field.value.split(",");
						acc.push(`${field.column} >= '${values[0]}' AND ${field.column} <= '${values[1]}'`);
						return acc;
					}, [])
					.join(" AND ");
				queryParams += filterDate;

				return queryParams;
			};

			let depositsQueryParams = "";
			let spendingsQueryParams = "";
			let averageTransactionsQueryParams = "";
			let sumTransactionsQueryParams = "";

			if (existingDepositsFilterDateValues.length && existingDepositsFilterDateValues?.[0]?.value?.length !== 0) {
				depositsQueryParams = appendFilterDate(depositsQueryParams, existingDepositsFilterDateValues);
			}

			if (existingSpendingsFilterDateValues.length && existingSpendingsFilterDateValues?.[0]?.value?.length !== 0) {
				spendingsQueryParams = appendFilterDate(spendingsQueryParams, existingSpendingsFilterDateValues);
			}

			if (
				existingAverageTransactionsFilterDateValues.length &&
				existingAverageTransactionsFilterDateValues?.[0]?.value?.length !== 0
			) {
				averageTransactionsQueryParams = appendFilterDate(
					averageTransactionsQueryParams,
					existingAverageTransactionsFilterDateValues
				);
			}

			if (
				existingSumTransactionsFilterDateValues.length &&
				existingSumTransactionsFilterDateValues?.[0]?.value?.length !== 0
			) {
				sumTransactionsQueryParams = appendFilterDate(
					sumTransactionsQueryParams,
					existingSumTransactionsFilterDateValues
				);
			}

			const dateFilter = existingDepositsFilterDateValues[0].value.split(",");
			const dateFilterStart = new Date(dateFilter[0]);
			const dateFilterEnd = new Date(dateFilter[1]);

			const lastMonthsFirstDay = new Date(dateFilterStart);
			lastMonthsFirstDay.setMonth(dateFilterStart.getMonth() - 1);
			lastMonthsFirstDay.setHours(0, 0, 0, 0);

			const lastMonthsLastDay = new Date(dateFilterEnd);
			lastMonthsLastDay.setMonth(dateFilterEnd.getMonth() - 1);
			lastMonthsLastDay.setHours(0, 0, 0, 0);

			// This would look something like `... date_filter_query AND amount < 0 ...` so that we fetch only rows with deposit entries
			let getDepositsByCategoryQuery = baseQuery.replace(
				"integration_data.bank_account_transactions.*",
				`integration_data.bank_account_transactions.category, SUM (amount) as amount_sum, COUNT(category) as category_count`
			);
			depositsQueryParams += ` AND amount < 0 GROUP BY (integration_data.bank_account_transactions.category) ORDER BY amount_sum DESC, category_count DESC`;
			getDepositsByCategoryQuery = getDepositsByCategoryQuery.replace("additional-queries", depositsQueryParams);

			// This would look something like `... date_filter_query AND amount < 0 ...` so that we fetch only rows with spending entries
			let getSpendingsByCategoryQuery = baseQuery.replace(
				"integration_data.bank_account_transactions.*",
				`integration_data.bank_account_transactions.category, SUM (amount) as amount_sum, COUNT(category) as category_count`
			);
			spendingsQueryParams += ` AND amount > 0 
			GROUP BY (integration_data.bank_account_transactions.category) 
			ORDER BY amount_sum DESC, category_count DESC`;
			getSpendingsByCategoryQuery = getSpendingsByCategoryQuery.replace("additional-queries", spendingsQueryParams);

			// This would look something like `... date_filter_query ORDER BY date ASC` so that we fetch entries in ASC order to show monthly ascending data on UI
			const getAverageTransactionsQuery = baseQuery.replace("additional-queries", averageTransactionsQueryParams);

			// This would look something like `... date_filter_query ORDER BY date ASC` so that we fetch entries in ASC order to show monthly ascending data on UI
			const getSumTransactionsQuery = baseQuery.replace("additional-queries", sumTransactionsQueryParams);

			const lastMonthsTransactionsQueryParams = ` AND bank_account_transactions.date >= '${lastMonthsFirstDay.toISOString()}' AND bank_account_transactions.date <= '${lastMonthsLastDay.toISOString()}' ORDER BY date ASC`;
			const getLastMonthsTransactionsQuery = baseQuery.replace("additional-queries", lastMonthsTransactionsQueryParams);

			const [
				depositEntries,
				spendingEntries,
				averageTransactionEntries,
				sumTransactionEntries,
				lastMonthsTransactionEntries
			] = await sqlTransaction(
				[
					getDepositsByCategoryQuery,
					getSpendingsByCategoryQuery,
					getAverageTransactionsQuery,
					getSumTransactionsQuery,
					getLastMonthsTransactionsQuery
				],
				[
					[businessID, platformId],
					[businessID, platformId],
					[businessID, platformId],
					[businessID, platformId],
					[businessID, platformId]
				]
			);

			// The purpose of the reducer function in this case is to build an array where each item in the array is a deposit category with a count and amount property.
			// Count relates to no of deposit transactions in a category, amount relates to total amount deposited for a category
			let totalDeposits = 0;
			let depositsCategories = depositEntries.rows.reduce((acc, item) => {
				acc.push({
					category: item.category,
					count: item.category_count,
					amount: Math.abs(parseFloat(item.amount_sum))
				});
				totalDeposits += Math.abs(parseFloat(item.amount_sum));

				return acc;
			}, []);
			totalDeposits = Math.abs(totalDeposits.toFixed(2));

			// If there are too many categories then we should not return all as it would cause issues on UI
			if (depositsCategories.length > 5) {
				depositsCategories = depositsCategories.slice(0, 5);
			}

			// The purpose of the reducer function in this case is to build an array where each item in the array is a spending category with a count and amount property.
			// Count relates to no of spends/expenditure transactions in a category, amount relates to total amount spent for a category
			let totalSpendings = 0;
			const spendingsCategories = spendingEntries.rows.reduce((acc, item) => {
				acc.push({
					category: item.category,
					count: item.category_count,
					amount: Math.abs(parseFloat(item.amount_sum))
				});
				totalSpendings += Math.abs(parseFloat(item.amount_sum));

				return acc;
			}, []);
			totalSpendings = totalSpendings.toFixed(2);
			// The purpose of the reducer function in this case is to build an object where each property is a MONTHLY category, and the value of each property is an object with a count and amount property.
			// If a Month exist then increase its count as well as total amount of that month
			// Count relates to no of transactions made in a Month, amount relates to total summation of expenditure and deposits in that Month
			let averageTransactions = averageTransactionEntries.rows.reduce((acc, item) => {
				const month = new Date(item.date).toLocaleString("default", { month: "long" });
				let transactionType = "";

				if (item.amount < 0) {
					transactionType = "deposits";
				} else {
					transactionType = "spendings";
				}

				// Initialising base object
				if (!Object.hasOwn(acc, "deposits") || !Object.hasOwn(acc, "spendings")) {
					acc = { deposits: {}, spendings: {} };
				}

				if (!Object.hasOwn(acc[transactionType], month)) {
					acc[transactionType][month] = {
						month,
						count: 1,
						amount: Math.abs(parseFloat(item.amount).toFixed(2))
					};
				} else {
					acc[transactionType][month].count += 1;
					// parse amount to 2 decimal places only
					acc[transactionType][month].amount = parseFloat(
						Math.abs(acc[transactionType][month].amount) + parseFloat(Math.abs(item.amount))
					).toFixed(2);
				}

				return acc;
			}, {});

			if (Object.keys(averageTransactions).length) {
				averageTransactions.deposits = Object.values(averageTransactions.deposits);
				averageTransactions.spendings = Object.values(averageTransactions.spendings);

				const averagedDeposits = [];
				const averagedSpendings = [];
				averageTransactions.deposits.forEach(deposit =>
					averagedDeposits.push({ ...deposit, amount: deposit.amount / deposit.count })
				);
				averageTransactions.deposits = averagedDeposits;
				averageTransactions.spendings.forEach(spendings =>
					averagedSpendings.push({ ...spendings, amount: spendings.amount / spendings.count })
				);
				averageTransactions.spendings = averagedSpendings;
			} else {
				averageTransactions = {
					deposits: [],
					spendings: []
				};
			}

			let sumTransactions = sumTransactionEntries.rows.reduce((acc, item) => {
				const month = new Date(item.date).toLocaleString("default", { month: "long" });
				let transactionType = "";

				if (item.amount < 0) {
					transactionType = "deposits";
				} else {
					transactionType = "spendings";
				}

				// Initialising base object
				if (!Object.hasOwn(acc, "deposits") || !Object.hasOwn(acc, "spendings")) {
					acc = { deposits: {}, spendings: {} };
				}

				if (!Object.hasOwn(acc[transactionType], month)) {
					acc[transactionType][month] = {
						month,
						count: 1,
						amount: Math.abs(parseFloat(item.amount).toFixed(2))
					};
				} else {
					acc[transactionType][month].count += 1;
					// parse amount to 2 decimal places only
					acc[transactionType][month].amount = parseFloat(
						Math.abs(acc[transactionType][month].amount) + parseFloat(Math.abs(item.amount))
					).toFixed(2);
				}

				return acc;
			}, {});

			if (Object.keys(sumTransactions).length) {
				sumTransactions.deposits = Object.values(sumTransactions.deposits);
				sumTransactions.spendings = Object.values(sumTransactions.spendings);

				const sumDeposits = [];
				const sumSpendings = [];
				sumTransactions.deposits.forEach(deposit => sumDeposits.push({ ...deposit, amount: deposit.amount }));
				sumTransactions.deposits = sumDeposits;
				sumTransactions.spendings.forEach(spendings => sumSpendings.push({ ...spendings, amount: spendings.amount }));
				sumTransactions.spendings = sumSpendings;
			} else {
				sumTransactions = {
					deposits: [],
					spendings: []
				};
			}

			let lastMonthsTransactionDelta = 0;
			lastMonthsTransactionEntries.rows.forEach(row => {
				lastMonthsTransactionDelta += parseFloat(row.amount);
			});
			// reversing the sign as entries coming from plaid are reversed by default as well
			lastMonthsTransactionDelta = -lastMonthsTransactionDelta.toFixed(2);

			return {
				deposits: {
					categories: depositsCategories,
					total_deposits: totalDeposits,
					period: query.filter_date["deposits.bank_account_transactions.date"]
				},
				spendings: {
					categories: spendingsCategories,
					total_spendings: totalSpendings,
					period: query.filter_date["spendings.bank_account_transactions.date"]
				},
				average_transactions: {
					transaction_type: averageTransactions,
					period: query.filter_date["average_transactions.bank_account_transactions.date"]
				},
				sum_transactions: {
					transaction_type: sumTransactions,
					period: query.filter_date["sum_transactions.bank_account_transactions.date"]
				},
				last_month_delta: (totalDeposits - totalSpendings - lastMonthsTransactionDelta).toFixed(2),
				total_balance: (totalDeposits - totalSpendings).toFixed(2)
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This functions fetches statastical data needed for charts on UI for banking (specifically transactions)
	 *
	 * @param {Object} params - The parameters for retrieving business statistics.
	 * @param {string} params.businessID - The ID of the business.
	 * @param {Object} query - The query parameters for filtering the statistics.
	 * @param {Object} userInfo - The information of the user.
	 * @returns {Object} - The business statistics.
	 */
	async getBalancesStats({ businessID }, query, userInfo, { authorization, shouldAssertCanSeeBusiness = true }) {
		if (shouldAssertCanSeeBusiness) {
			await this.assertCanSeeBusiness(businessID, userInfo, authorization);
		}
		/**
			 Unlike some of the other stats queries we don't filter on specific task id because the banking balances are always a running total,
			 the most recent task will only have the most recent transactions brought in
			 */
		const baseQuery = `SELECT integration_data.banking_balances.*, ba.bank_name, ba.institution_name, ba.type
			FROM integrations.data_business_integrations_tasks dbit
			JOIN integrations.data_connections dc ON dbit.connection_id = dc.id
			JOIN integration_data.banking_balances ON banking_balances.business_integration_task_id = dbit.id
			JOIN integration_data.bank_accounts ba ON ba.id = banking_balances.bank_account_id
			WHERE dc.business_id = $1 AND dc.connection_status = 'SUCCESS'
			additional-queries
		`;
		const allowedFilterDateParams = ["banking_balances.date"];
		let existingAllowedFilterDateValues = [];

		if (
			!Object.hasOwn(query, "filter_date") ||
			(Object.hasOwn(query, "filter_date") && !Object.hasOwn(query.filter_date, "banking_balances.date"))
		) {
			// WE replace "additional-queries" in the baseQuery with our custom sql clause
			// For latest balance, fetch the latest row.
			const getLatestBalanceQuery = baseQuery.replace("additional-queries", "ORDER BY year DESC, month DESC LIMIT 1");
			const latestBalance = await sqlQuery({ sql: getLatestBalanceQuery, values: [businessID] });

			// Running a loop to create filter_date object with the latestbalance entry as default date for stats.
			// After the whole loop is executed, the final object would look like :
			// filter_date: {
			// 'banking_balances.date': '2023-12-31T18:30:00.000Z,2024-04-18T12:23:25.101Z'
			// }

			if (latestBalance.rowCount) {
				query.filter_date = Object.hasOwn(query, "filter_date") ? query.filter_date : {};
				// Create date object for the latest deposit.
				// WE only get month and year from plaid, therefore I am creating date object with 1st date of the month and year given
				// For ex: If i have month = 4(April) and year 2024, then I am creating the object = 1/4/2024
				const latestDepositDate = dayjs()
					.month(latestBalance.rows[0].month - 1)
					.year(latestBalance.rows[0].year)
					.endOf("month");

				if (Object.hasOwn(query, "default_duration") && query.default_duration === "month") {
					// start date of the month of the latest balance
					const startDate = dayjs()
						.month(latestBalance.rows[0].month - 1)
						.year(latestBalance.rows[0].year)
						.startOf("month");
					query.filter_date = {
						...query.filter_date,
						"banking_balances.date": `${startDate.toISOString()},${latestDepositDate.toISOString()}`
					};
				} else if (!Object.hasOwn(query.filter_date, "banking_balances.date")) {
					// Extract the starting date of the year and set the date as 1/1/Extracted_year
					const startOfTheYear = dayjs().year(latestBalance.rows[0].year).startOf("year");
					// Ex: If Today is 4th April of 2024 and last spend entry was on 3rd of march 2024 then fetch data from 1/1/2024 to 4/4/2024
					query.filter_date = {
						...query.filter_date,
						"banking_balances.date": `${startOfTheYear.toISOString()},${latestDepositDate.toISOString()}`
					};
				}
			} else {
				return {
					average_balances: {
						monthly_balances: [],
						latest_balance: {},
						total_balance: "N/A",
						period: []
					},
					last_month_delta: "N/A"
				};
			}
		}

		if (query.filter_date) {
			existingAllowedFilterDateValues = Object.keys(query.filter_date).reduce((acc, field) => {
				if (allowedFilterDateParams.includes(field)) {
					// Convert "deposits.bank_account_transactions.date" to "bank_account_transactions.date" so that it is compatible to query in db
					const filterDate = {
						column: field,
						value: query.filter_date[field].toString()
					};
					acc.push(filterDate);
					return acc;
				}
				return acc;
			}, []);
		}
		// Default order
		let additionalQuery = `ORDER by year desc, month desc`;
		let trueStart = dayjs().subtract(1, "year").subtract(1, "month").startOf("month");
		let endDate = trueStart.endOf("year");

		if (existingAllowedFilterDateValues.length && existingAllowedFilterDateValues?.[0]?.value?.length !== 0) {
			const dates = existingAllowedFilterDateValues[0].value.split(",");
			// Assign the dates to endDate & trueStart
			endDate = dayjs(dates[1]);
			// Override the requested startMonth & startYear to go a month earlier so we can calculate the delta between previous->current
			trueStart = dayjs(dates[0]).subtract(1, "month").startOf("month");

			additionalQuery = ` AND to_date(year::text || LPAD(month::text, 2, '0'), 'YYYYMM')
					BETWEEN
					to_date('${trueStart.format("YYYY-MM-DD")}','YYYY-MM-DD') AND
					to_date(  '${endDate.format("YYYY-MM-DD")}','YYYY-MM-DD')
					ORDER BY year ASC, month ASC`;
		}
		const getBalancesQuery = baseQuery.replace("additional-queries", additionalQuery);
		const balancesEntries = await sqlQuery({ sql: getBalancesQuery, values: [businessID] });
		// The purpose of the reducer function in this case is to build an object where each property is a MONTHLY category, and the value of each property is an object with a count and amount property.
		// If a Month exist then increase its count as well as total amount of that month
		// Count relates to no of transactions made in a Month, amount relates to total summation of expenditure and deposits in that Month
		// Prepopulate the object with a 0 balance for each month between endDate & trueStart
		let balances = {};
		for (
			let evaluatedDate = dayjs(trueStart).startOf("month");
			evaluatedDate.isBefore(endDate.endOf("month"));
			evaluatedDate = evaluatedDate.add(1, "month").startOf("month")
		) {
			const key = evaluatedDate.format();
			balances[key] = {
				month: evaluatedDate.format("MMMM"),
				date: evaluatedDate,
				year: evaluatedDate.year(),
				balance: 0,
				accounts: 0,
				previousMonthBalance: 0,
				institutions: {}
			};
		}

		let mostRecentKey, earliestKey;
		balances = balancesEntries.rows.reduce((acc, item) => {
			let institutionName = item.institution_name;
			if (item.type === "credit") {
				institutionName = item.bank_name;
			}
			const itemDate = dayjs()
				.month(item.month - 1)
				.year(item.year)
				.startOf("month");

			const key = itemDate.format(); // 202401, 202402 ... 202412

			if (!acc[key]) {
				logger.warn(`No entry for key ${key} found`);
				return acc;
			}
			acc[key].accounts++;
			acc[key].balance = currency(acc[key].balance ?? 0).add(item.balance ?? 0).value;
			if (!mostRecentKey || key > mostRecentKey) {
				mostRecentKey = key;
			}
			if (!earliestKey || key < earliestKey) {
				earliestKey = key;
			}
			acc[key].institutions[institutionName] = acc[key].institutions[institutionName] ?? 0;
			acc[key].institutions[institutionName] = currency(acc[key].institutions[institutionName]).add(item.balance).value;
			return acc;
		}, balances);

		const filteredBalances = Object.entries(balances)
			.filter(([_, entry]) => entry.date.isAfter(trueStart))
			.reduce((acc, [key, entry]) => {
				// Get previous month balance
				const previousMonthKey = entry?.date.subtract(1, "month").startOf("month").format();
				const previousMonthEntry = balances[previousMonthKey];
				balances[key].previousMonthBalance = currency(previousMonthEntry?.balance ?? 0).value;
				acc[key] = {
					...entry,
					previousMonthBalance: previousMonthEntry
						? currency(previousMonthEntry?.balance ?? entry.balance).value
						: undefined
				};
				return acc;
			}, {});

		return {
			average_balances: {
				monthly_balances: Object.values(filteredBalances).filter(
					entry => entry.date.isAfter(trueStart) && entry.accounts > 0
				),
				latest_balance: filteredBalances[mostRecentKey] ?? {},
				total_balance: currency(filteredBalances[mostRecentKey]?.balance ?? 0).toString(),
				period: [trueStart.add(1, "month").toISOString(), endDate.toISOString()]
			},
			last_month_delta: currency(filteredBalances[mostRecentKey]?.balance ?? 0)
				.subtract(filteredBalances[mostRecentKey]?.previousMonthBalance ?? 0)
				.toString()
		};
	}

	async getBalanceSheetStats({ businessID }, query, userInfo, { authorization }) {
		await this.assertCanSeeBusiness(businessID, userInfo, authorization);

		const mostRecentTask = await this.getMostRecentTask(businessID, "fetch_balance_sheet");
		if (!mostRecentTask) {
			return { balance_sheet: null, period: query.filter_date["accounting_balancesheet.start_date"] };
		}
		const baseQuery = `SELECT integration_data.accounting_balancesheet.* , dc.platform_id
			FROM integrations.data_business_integrations_tasks dbit
			JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
			JOIN integration_data.accounting_balancesheet ON integration_data.accounting_balancesheet.business_integration_task_id = dbit.id
			WHERE dbit.id = $1 AND dc.connection_status = 'SUCCESS' additional-queries
			`;

		const allowedFilterDateParams = ["accounting_balancesheet.start_date"];
		let existingAllowedFilterDateValues = [];

		if (
			!Object.hasOwn(query, "filter_date") ||
			(Object.hasOwn(query, "filter_date") && !Object.hasOwn(query.filter_date, "accounting_balancesheet.start_date"))
		) {
			// WE replace "additional-queries" in the baseQuery with our custom sql clause
			// For latest balance, fetch the latest row.
			const getLatestBalanceSheetQuery = baseQuery.replace("additional-queries", "ORDER BY start_date DESC LIMIT 1");
			const latestBalanceSheet = await sqlQuery({ sql: getLatestBalanceSheetQuery, values: [mostRecentTask.id] });

			// Running a loop to create filter_date object with the latestBalanceSheet entry as default date for stats.
			// After the whole loop is executed, the final object would look like :
			// filter_date: {
			// 'accounting_balancesheet.start_date': '2023-12-31T18:30:00.000Z,2024-04-18T12:23:25.101Z'
			// }

			if (latestBalanceSheet.rowCount) {
				query.filter_date = Object.hasOwn(query, "filter_date") ? query.filter_date : {};
				if (!Object.hasOwn(query.filter_date, "accounting_balancesheet.start_date")) {
					const latestBalanceSheetEntryDate = new Date(latestBalanceSheet.rows[0].start_date);
					// Set the fromDate to the start of the year of the toDate
					const startOfTheYear = dayjs().year(latestBalanceSheetEntryDate.getFullYear()).startOf("year").toISOString();
					const endOfTheYear = dayjs().year(latestBalanceSheetEntryDate.getFullYear()).endOf("year").toISOString();
					query.filter_date = {
						...query.filter_date,
						"accounting_balancesheet.start_date": [startOfTheYear, endOfTheYear]
					};
				}
			} else {
				return {
					balance_sheet: {},
					period: []
				};
			}
		}

		if (query.filter_date) {
			existingAllowedFilterDateValues = Object.keys(query.filter_date).reduce((acc, field) => {
				if (allowedFilterDateParams.includes(field)) {
					const filterDate = {
						column: field,
						value: query.filter_date[field].toString()
					};
					acc.push(filterDate);
					return acc;
				}
				return acc;
			}, []);
		}

		// Default order
		let additionalQuery = ``;
		// An internal function that build filterDate query that will be apended to base query later on
		const appendFilterDate = (queryParams, filterDateValues) => {
			let filterDate = " AND ";
			filterDate += filterDateValues
				.reduce((acc, field) => {
					const values = field.value.split(",");
					acc.push(`${field.column} >= '${values[0]}' AND ${field.column} <= '${values[1]}'`);
					return acc;
				}, [])
				.join(" AND ");
			queryParams += filterDate;

			return queryParams;
		};

		if (existingAllowedFilterDateValues.length && existingAllowedFilterDateValues?.[0]?.value?.length !== 0) {
			additionalQuery = appendFilterDate(additionalQuery, existingAllowedFilterDateValues);
		}

		const getBalanceSheetQuery = baseQuery.replace("additional-queries", additionalQuery);

		const balanceSheetEntries = await sqlQuery({ sql: getBalanceSheetQuery, values: [mostRecentTask.id] });

		// The purpose of the reducer function in this case is to build an object where each property is a MONTHLY category, and the value of each property is an object with a count and amount property.
		// If a Month exist then increase its count as well as total amount of that month
		// Count relates to no of transactions made in a Month, amount relates to total summation of expenditure and deposits in that Month
		const balanceSheet = balanceSheetEntries.rows.reduce((acc, item) => {
			const startDate = new Date(item.start_date);
			// Get the long month name using toLocaleDateString()
			const month = startDate.toLocaleDateString("en-US", { month: "long" });

			const platformCode = this.platformIdToName(item.platform_id);

			if (!Object.hasOwn(acc, platformCode)) {
				acc[platformCode] = {
					monthly_data: []
				};

				acc[platformCode].monthly_data.push({
					month,
					total_assets: item.total_assets,
					total_equity: item.total_equity,
					total_liabilities: item.total_liabilities
				});
			} else {
				acc[platformCode].monthly_data.push({
					month,
					total_assets: item.total_assets,
					total_equity: item.total_equity,
					total_liabilities: item.total_liabilities
				});
			}
			return acc;
		}, {});

		const response = {
			platforms: Object.keys(balanceSheet).map(platformCode => {
				return { platform: platformCode, ...balanceSheet[platformCode] };
			})
		};
		return {
			balance_sheet: response,
			period: query.filter_date["accounting_balancesheet.start_date"]
		};
	}

	async getIncomeStatementStats({ businessID }, query, userInfo, { authorization }) {
		await this.assertCanSeeBusiness(businessID, userInfo, authorization);

		const mostRecentTask = await this.getMostRecentTask(businessID, "fetch_profit_and_loss_statement");
		if (!mostRecentTask) {
			return {
				income_statement: {},
				period: query.filter_date["accounting_incomestatement.start_date"]
			};
		}
		const baseQuery = `SELECT integration_data.accounting_incomestatement.* , dc.platform_id
		    FROM integrations.data_connections dc
			JOIN integrations.data_business_integrations_tasks dbit ON dbit.connection_id = dc.id
			JOIN integration_data.accounting_incomestatement ON integration_data.accounting_incomestatement.business_integration_task_id = dbit.id
			WHERE dc.business_id = $1
			AND dbit.id = $2 AND dc.connection_status = 'SUCCESS'
			additional-queries
			`;

		const allowedFilterDateParams = ["accounting_incomestatement.start_date"];
		let existingAllowedFilterDateValues = [];

		if (
			!Object.hasOwn(query, "filter_date") ||
			(Object.hasOwn(query, "filter_date") &&
				!Object.hasOwn(query.filter_date, "accounting_incomestatement.start_date"))
		) {
			// WE replace "additional-queries" in the baseQuery with our custom sql clause
			// For latest balance, fetch the latest row.
			const getLatestIncomeStatementQuery = baseQuery.replace(
				"additional-queries",
				" AND (total_revenue > 0 OR total_expenses > 0) ORDER BY start_date DESC, total_revenue DESC LIMIT 1 "
			);
			const latestIncomeStatement = await sqlQuery({
				sql: getLatestIncomeStatementQuery,
				values: [businessID, mostRecentTask?.id]
			});

			// Running a loop to create filter_date object with the latestBalanceSheet entry as default date for stats.
			// After the whole loop is executed, the final object would look like :
			// filter_date: {
			// 'accounting_incomestatement.start_date': '2023-12-31T18:30:00.000Z,2024-04-18T12:23:25.101Z'
			// }

			if (latestIncomeStatement.rowCount) {
				query.filter_date = Object.hasOwn(query, "filter_date") ? query.filter_date : {};
				if (!Object.hasOwn(query.filter_date, "accounting_incomestatement.start_date")) {
					const latestIncomeStatementEntryDate = new Date(latestIncomeStatement.rows[0].start_date);
					// Set the start & end date to the start and end of the year of the latestIncomeStatementEntryDate
					const startOfTheYear = dayjs()
						.year(latestIncomeStatementEntryDate.getFullYear())
						.startOf("year")
						.toISOString();
					const endOfTheYear = dayjs().year(latestIncomeStatementEntryDate.getFullYear()).endOf("year").toISOString();

					query.filter_date = {
						...query.filter_date,
						"accounting_incomestatement.start_date": [startOfTheYear, endOfTheYear]
					};
				}
			} else {
				return {
					income_statement: {},
					period: []
				};
			}
		}

		if (query.filter_date) {
			existingAllowedFilterDateValues = Object.keys(query.filter_date).reduce((acc, field) => {
				if (allowedFilterDateParams.includes(field)) {
					const filterDate = {
						column: field,
						value: query.filter_date[field].toString()
					};
					acc.push(filterDate);
					return acc;
				}
				return acc;
			}, []);
		}

		let additionalQuery = ``;
		// An internal function that build filterDate query that will be apended to base query later on
		const appendFilterDate = (queryParams, filterDateValues) => {
			let filterDate = " AND ";
			filterDate += filterDateValues
				.reduce((acc, field) => {
					const values = field.value.split(",");
					acc.push(`${field.column} >= '${values[0]}' AND ${field.column} <= '${values[1]}'`);
					return acc;
				}, [])
				.join(" AND ");
			queryParams += filterDate;

			return queryParams;
		};

		if (existingAllowedFilterDateValues.length && existingAllowedFilterDateValues?.[0]?.value?.length !== 0) {
			additionalQuery = appendFilterDate(additionalQuery, existingAllowedFilterDateValues);
		}

		const getIncomeStatmentQuery = baseQuery.replace("additional-queries", additionalQuery);

		const incomeStatementEntries = await sqlQuery({
			sql: getIncomeStatmentQuery,
			values: [businessID, mostRecentTask?.id]
		});

		const incomeStatement = incomeStatementEntries.rows.reduce((acc, item) => {
			const startDate = new Date(item.start_date);
			const month = startDate.getMonth() + 1; // Adding 1 because getMonth() returns 0-based index

			let quarter;
			if (month >= 1 && month <= 3) {
				quarter = 1;
			} else if (month >= 4 && month <= 6) {
				quarter = 2;
			} else if (month >= 7 && month <= 9) {
				quarter = 3;
			} else {
				quarter = 4;
			}

			const platformCode = this.platformIdToName(item.platform_id);

			if (!Object.hasOwn(acc, platformCode)) {
				acc[platformCode] = {
					quaterly_data: {
						[quarter]: {
							quarter,
							total_revenue: parseFloat(item.total_revenue) || 0,
							total_expenses: parseFloat(item.total_expenses) || 0
						}
					}
				};
			} else if (Object.hasOwn(acc[platformCode].quaterly_data, quarter)) {
				acc[platformCode].quaterly_data[quarter].total_revenue = (
					parseFloat(acc[platformCode].quaterly_data[quarter].total_revenue) + parseFloat(item.total_revenue)
				).toFixed(2);
				acc[platformCode].quaterly_data[quarter].total_expenses = (
					parseFloat(acc[platformCode].quaterly_data[quarter].total_expenses) + parseFloat(item.total_expenses)
				).toFixed(2);
			} else {
				acc[platformCode].quaterly_data[quarter] = {
					quarter,
					total_revenue: parseFloat(item.total_revenue) || 0,
					total_expenses: parseFloat(item.total_expenses) || 0
				};
			}
			return acc;
		}, {});

		const response = {
			platforms: Object.keys(incomeStatement).map(platformCode => {
				return { platform: platformCode, quaterly_data: Object.values(incomeStatement[platformCode].quaterly_data) };
			})
		};
		return {
			income_statement: response,
			period: query.filter_date["accounting_incomestatement.start_date"]
		};
	}

	async getTransactionYears({ businessID }, query, userInfo, { authorization }) {
		await this.assertCanSeeBusiness(businessID, userInfo, authorization);
		const getTransactionsYearQuery = `SELECT distinct year
			from integration_data.banking_balances bb
			join integrations.data_business_integrations_tasks dbit ON bb.business_integration_task_id = dbit.id
			join integrations.data_connections dc on dc.id = dbit.connection_id
			where dc.business_id = $1 and dc.platform_id = $2`;

		const platformId = this.platformNameToId(query.platform || "plaid");
		const transactionYears = await sqlQuery({ sql: getTransactionsYearQuery, values: [businessID, platformId] });
		return transactionYears.rows.map(e => e.year);
	}

	async getMostRecentTask(businessID, taskCode, taskStatus = "SUCCESS") {
		const getMostRecentTaskQuery = `select dbit.id, dbit."task_status" from "integrations"."data_business_integrations_tasks" dbit
 join integrations.data_connections dc on dc.id = dbit.connection_id
 join integrations.rel_tasks_integrations rti on rti.id = dbit.integration_task_id
join integrations.core_tasks ct on ct.id = rti.task_category_id
WHERE
 dc.business_id = $1 AND
 ct.code = $2 AND
 dbit.task_status = $3
order by dbit.created_at desc limit 1`;

		const mostRecentTask = await sqlQuery({ sql: getMostRecentTaskQuery, values: [businessID, taskCode, taskStatus] });
		return mostRecentTask.rows[0];
	}

	async assertCanSeeBusiness(businessID, userInfo, authorization) {
		if (userInfo?.role?.code === ROLES.ADMIN) {
			logger.debug(`businessId=${businessID} Bypassing user check - admin user`);
		} else if (userInfo?.role?.code === ROLES.CUSTOMER) {
			// access middleware already has provisions to check if business is related to a customer
			logger.debug(`businessId=${businessID} Bypassing user check - customer user`);
		} else {
			const records = await getBusinessApplicants(businessID, authorization);
			const applicants = records.map(applicant => applicant.id);

			if (!applicants.includes(userInfo.user_id)) {
				throw new ApplicantsApiError(
					"Applicant is not related to business",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
		}
	}

	platformIdToName(id) {
		const entry = Object.entries(INTEGRATION_ID).find(([_, value]) => value === id);
		return entry ? entry[0] : null;
	}
	platformNameToId(name) {
		const entry = Object.entries(INTEGRATION_ID).find(([key, _]) => key.toLowerCase() === name.toLowerCase());
		return entry ? entry[1] : null;
	}

	async getBankingTaskAndCheckRelTaskBankAccounts(businessID, caseID) {
		// fetch banking task associated with the case ID
		const getBankingTaskQuery = `
			SELECT integrations.data_business_integrations_tasks.*
			FROM integrations.data_business_integrations_tasks
			JOIN integrations.data_connections ON data_connections.id = data_business_integrations_tasks.connection_id
			JOIN integrations.business_score_triggers ON business_score_triggers.id = data_business_integrations_tasks.business_score_trigger_id
			JOIN public.data_cases ON data_cases.score_trigger_id = business_score_triggers.id
			WHERE data_connections.business_id = $1
			AND data_cases.id = $2
			AND data_connections.platform_id = $3
			LIMIT 1
		`;

		const bankingTask = await sqlQuery({
			sql: getBankingTaskQuery,
			values: [businessID, caseID, INTEGRATION_ID.PLAID]
		});

		if (bankingTask.rowCount === 0) {
			throw new ApplicantsApiError("Banking task not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		// check if task data is present in rel_task_bank_accounts table
		const taskBankAccountQuery = `
			SELECT * 
			FROM integration_data.rel_task_bank_account 
			WHERE business_integration_task_id = $1
			LIMIT 1
		`;

		const taskBankAccount = await sqlQuery({
			sql: taskBankAccountQuery,
			values: [bankingTask.rows[0].id]
		});

		let isTaskDataPresentInRelTaskBankAccounts = false;
		if (taskBankAccount && taskBankAccount.rowCount > 0) {
			isTaskDataPresentInRelTaskBankAccounts = true;
		}

		return {
			taskId: bankingTask.rows[0].id,
			isTaskDataPresentInRelTaskBankAccounts
		};
	}

	/**
	 * Build transaction query based on business ID, case ID, and filters
	 * @param {string} businessID
	 * @param {string} caseID (optional)
	 * @param {string} platformId
	 * @param {string} queryParams - Additional WHERE clause conditions
	 * @returns {Object} { query, values, isTaskDataPresentInRelTaskBankAccounts }
	 */
	async buildTransactionQuery(businessID, caseID, platformId, queryParams = "") {
		let getPlaidTransactionsQuery = "";
		let getPlaidTransactionsValues = [];
		let isTaskDataPresentInRelTaskBankAccounts = false;

		if (caseID) {
			const bankingTaskRelAccounts = await this.getBankingTaskAndCheckRelTaskBankAccounts(businessID, caseID);
			isTaskDataPresentInRelTaskBankAccounts = bankingTaskRelAccounts.isTaskDataPresentInRelTaskBankAccounts;

			if (isTaskDataPresentInRelTaskBankAccounts) {
				getPlaidTransactionsValues = [bankingTaskRelAccounts.taskId];
			}
		}

		if (isTaskDataPresentInRelTaskBankAccounts) {
			getPlaidTransactionsQuery = `
				SELECT integration_data.bank_account_transactions.*, ba.bank_account, ba.bank_name, ba.official_name, ba.institution_name, ba.type, ba.subtype
				FROM integration_data.rel_task_bank_account AS rtba
				JOIN integration_data.bank_accounts AS ba ON ba.id = ANY(rtba.bank_account_id) 
				JOIN integration_data.bank_account_transactions ON bank_account_transactions.bank_account_id = ba.id
				WHERE rtba.business_integration_task_id = $1${queryParams}`;
		} else {
			getPlaidTransactionsQuery = `
				SELECT integration_data.bank_account_transactions.*, ba.bank_account, ba.bank_name, ba.official_name, ba.institution_name, ba.type, ba.subtype
				FROM integration_data.bank_account_transactions
				JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = bank_account_transactions.business_integration_task_id
				LEFT JOIN integration_data.bank_accounts ba ON ba.id = bank_account_transactions.bank_account_id
				JOIN integrations.data_connections dc on dbit.connection_id = dc.id
				WHERE dc.business_id = $1 AND dc.platform_id = $2${queryParams}`;

			getPlaidTransactionsValues = [businessID, platformId];
		}

		return {
			query: getPlaidTransactionsQuery,
			values: getPlaidTransactionsValues,
			isTaskDataPresentInRelTaskBankAccounts
		};
	}
}

export const applicants = new Applicants();
