import { CASE_STATUS_ENUM, kafkaEvents, kafkaTopics } from "#constants";
import { producer } from "#helpers";
import type { KafkaMessage, MapperField } from "#types";
import { sanitizeDate, SerializableMap } from "#utils";
import { MapperError, type Mapper } from "../../mapper";
import {
	assertTruthy,
	parseBool,
	sanitizeCurrency,
	sanitizeNpi,
	sanitizePositiveFloat,
	sanitizePositiveInteger
} from "../utils";
import {
	validateBankAccountType,
	validateHighVolumeMonths,
	validatePercentage,
	validateRoutingNumber,
	validateWireRoutingNumber
} from "../utils/validators";

export async function processIntegrationData(mapper: Mapper, _: MapperField[]) {
	// This just sends a kafka message with the fields
	const metadata = mapper.getAdditionalMetadata();
	const businessID = metadata.data_businesses?.id;
	if (!businessID) {
		return;
	}
	const integrationData = mapper.getPossibleFields()?.reduce((acc, field) => {
		const mappedFields = mapper.getMappedFields()?.filter(f => f.column === field.column);
		// Send message with the "model_field" if available, otherwise the normal column name
		const columnKey = field.model_field ?? field.column;
		acc.set(columnKey, acc.get(columnKey) || null);
		if (mappedFields) {
			for (const mappedField of mappedFields) {
				if (field.concat) {
					const currentValue = acc.get(columnKey) ?? {};
					const newValue = {
						...currentValue,
						[mappedField.providedKey ?? mappedField.column]: mappedField.value
					};
					acc.set(columnKey, newValue);
				} else {
					acc.set(columnKey, mappedField.value || null);
				}
			}
		}
		return acc;
	}, new SerializableMap<string, any>());

	mapper.addAdditionalMetadata({ integration_data: integrationData });
	await Promise.allSettled(
		metadata.data_cases?.map(async caseData => {
			const kafkaMessage: KafkaMessage.MapperIntegrationDataUploaded = {
				id: metadata.id,
				case_id: caseData?.id,
				business_id: metadata.data_businesses?.id,
				customer_id: caseData.customer_id,
				user_id: metadata.userID,
				created_at: new Date(),
				data: integrationData,
				trigger: "bulkCreateBusinessMapper"
			};
			const caseSubmittedMessage = {
				case_id: caseData.id,
				business_id: metadata.data_businesses?.id
			};
			const payload = {
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: metadata.data_businesses?.id,
						value: { ...kafkaMessage, event: kafkaEvents.INTEGRATION_DATA_UPLOADED }
					},
					{
						key: metadata.data_businesses?.id,
						value: {
							event: kafkaEvents.CASE_STATUS_UPDATED,
							...caseSubmittedMessage,
							case_status: CASE_STATUS_ENUM.SUBMITTED
						}
					},
					{
						key: metadata.data_businesses?.id,
						value: { ...caseSubmittedMessage, event: kafkaEvents.CASE_SUBMITTED_EXECUTE_TASKS }
					}
				]
			};
			await producer.send(payload);
		})
	);
}

export async function validateIntegrationData(mapper: Mapper, _: MapperField[]) {
	const fields = mapper.getMappedFields();
	const swipedCards = fields.find(f => f.column === "swiped_cards");
	const typedCards = fields.find(f => f.column === "typed_cards");
	const eCommerce = fields.find(f => f.column === "e_commerce");
	const mailAndTelephone = fields.find(f => f.column === "mail_telephone");
	const bankAccountNumber = fields.find(f => f.column === "bank_account_number");
	const bankRoutingNumber = fields.find(f => f.column === "bank_routing_number");
	const bankAccountSubType = fields.find(f => f.column === "bank_account_subtype");

	if (swipedCards?.value || typedCards?.value || eCommerce?.value || mailAndTelephone?.value) {
		const sum =
			Number(typedCards?.value ?? 0) +
			Number(eCommerce?.value ?? 0) +
			Number(swipedCards?.value ?? 0) +
			Number(mailAndTelephone?.value ?? 0);
		if (sum !== 100) {
			throw new MapperError("The sum of the Point of Sale Volume fields should equal 100.");
		}
	}

	if (bankAccountNumber?.value || bankRoutingNumber?.value || bankAccountSubType?.value) {
		if (!bankAccountNumber?.value || !bankRoutingNumber?.value || !bankAccountSubType?.value) {
			throw new MapperError(
				"Bank account number, routing number, and account subtype are required when providing bank details."
			);
		}
	}
}

export function getIntegrationDataFields(): MapperField[] {
	return [
		{ column: "run_id", description: "internal run id", private: true },
		{ column: "dba1_name", description: "The Doing Business As Name of the business" },
		{
			column: "year_created",
			description: "The year the business was created",
			model_field: "year",
			alternate: ["year_established", "year_of_establishment"]
		},
		{
			column: "npi_provider_number",
			description: "The National Provider Identifier (NPI) number of the business",
			alternate: ["npi", "npi_number"],
			sanitize: sanitizeNpi,
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "string" && ("" + field.value).length === 10, field)
		},
		{
			column: "npi_first_name",
			description:
				"The first name of the primary provider as defined in the National Provider Identifier (NPI) registry"
		},
		{
			column: "npi_last_name",
			description: "The last name of the primary provider as defined in the National Provider Identifier (NPI) registry"
		},
		{
			column: "canada_business_number",
			description: "The Canada Business Number of the business"
		},
		{
			column: "canada_corporate_id",
			description: "The Canada Corporate ID of the business"
		},
		{
			column: "annual_total_income",
			description: "The business's annual total income/sales",
			alternate: ["annualtotalincome", "annual_income", "annual_sales", "sales", "total_revenue", "annual_revenue"],
			model_field: "is_revenue",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "total_wages",
			description: "The business's total wages",
			alternate: ["totalwages"],
			model_field: "is_operatingexpenses",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "annual_net_income",
			description: "The business's annual net income",
			alternate: ["annualnetincome", "net_income", "netincome"],
			model_field: "is_netincome",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "cost_of_goods_sold",
			alternate: ["cogs"],
			description: "Income statement - cost of goods sold",
			model_field: "is_cost_of_goods_sold",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "total_liabilities",
			description: "The business's total liabilities",
			alternate: ["totalliabilities", "liabilities"],
			model_field: "bs_totalliabilities",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "total_assets",
			description: "The business's total assets",
			alternate: ["totalassets", "assets"],
			model_field: "bs_totalassets",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "total_equity",
			description: "The business's total equity",
			alternate: ["totalequity"],
			model_field: "bs_totalequity",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "total_accounts_payable",
			description: "The business's total accounts payable",
			alternate: ["totalaccountspayable", "accounts_payable", "accountspayable"],
			model_field: "bs_accountspayable",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "total_accounts_recievable",
			description: "The business's total accounts receivable",
			alternate: ["totalaccountsreceivable", "accounts_receivable", "accountsreceivable"],
			model_field: "bs_accountsreceivable",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "total_cash_and_cash_equivalents",
			description: "The business's total cash and cash equivalents",
			alternate: ["totalcashandcashequivalents", "cash", "cash_equivalents"],
			model_field: "bs_cashandcashequivalents",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "total_short_term_investments",
			description: "The business's total short term investments",
			alternate: ["totalshortterminvestments"],
			model_field: "bs_shortterminvestments",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "total_current_assets",
			description:
				"This field represents the total value of the current assets owned by the organization. Current assets are assets that are expected to be converted into cash within one year or the operating cycle of the business, whichever is longer. Examples of current assets include cash, accounts receivable, and inventory.",
			alternate: ["totalcurrentassets", "current_assets"],
			model_field: "bs_totalcurrentassets",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "total_current_liabilities",
			description:
				"This field represents the total amount of a company's current liabilities. Current liabilities are obligations that are expected to be settled within one year. Examples of current liabilities include accounts payable, short-term loans, and accrued expenses.",
			alternate: ["totalcurrentliabilities"],
			model_field: "bs_totalcurrentliabilities",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "non_current_liablities",
			description: "Total Non-Current Liabilities",
			alternate: ["noncurrentliabilities"],
			model_field: "bs_totalnoncurrentliabilities",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "annual_cost_of_goods_sold",
			description:
				"This field represents the annual cost of goods sold. It is a financial metric that calculates the total cost of acquiring or producing goods that were sold during a specific period. It includes the cost of raw materials, direct labor, and other production-related expenses.",
			alternate: ["annualcostofgoodssold", "cogs"],
			model_field: "is_costofgoodsold",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "annual_gross_profit",
			description: "The business's annual gross profit",
			alternate: ["annualgrossprofit"],
			model_field: "is_grossprofit",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "annual_taxes_paid",
			description: "The business's annual taxes paid",
			alternate: ["annualtaxespaid", "taxes"],
			model_field: "is_incometaxexpense",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "annual_interest_expenses",
			description: "The business's annual interest expenses",
			alternate: ["annualinterestexpenses", "interest"],
			model_field: "is_interestexpense",
			sanitize: sanitizeCurrency,
			dataType: "number" as const
		},
		{
			column: "number_of_employees",
			description: "Total number of employees",
			alternate: ["numberofemployees", "employees"],
			sanitize: sanitizePositiveInteger,
			dataType: "number" as const
		},
		{ column: "business_type", description: "The type of business", alternate: ["businesstype", "type"] },
		{
			column: "sic_code",
			description: "The Standard Industrial Classification code of the business",
			alternate: ["siccode", "sic"],
			sanitize: sanitizePositiveInteger
		},
		{
			column: "score_retrieval_date",
			model_field: "date_of_observation",
			description: "Date of Observation",
			alterate: ["date_of_observation", "score_retrieval_date", "score_date"],
			sanitize: async (_, str) => sanitizeDate(str)
		},
		{
			column: "business_liens",
			model_field: "lien_count",
			description: "The number of liens on the business",
			alternate: ["liens", "bus_liens_summary_001", "number_of_business_liens"],
			sanitize: sanitizePositiveInteger
		},
		{
			column: "business_liens_file_date",
			description: "The date the most recent lien file date",
			alternate: ["liens_file_date", "lien_date", "bus_liens_summary_002", "most_recent_business_lien_filing_date"],
			sanitize: async (_, str) => sanitizeDate(str)
		},
		{
			column: "business_liens_status",
			description: "The status of the most recent business lien",
			alternate: ["liens_status", "lien_status", "bus_liens_summary_003", "most_recent_business_lien_status"]
		},
		{
			column: "business_liens_status_date",
			description: "The date the most recent lien status was updated",
			alternate: ["liens_status_date", "lien_status_date", "bus_liens_summary_004"],
			sanitize: async (_, str) => sanitizeDate(str)
		},
		{
			column: "business_bankruptcies",
			model_field: "bankruptcy_count",
			description: "The number of bankruptcies the business has filed",
			alternate: ["bankruptcies", "bus_bankruptcy_summary_001", "number_of_bankruptcies"],
			sanitize: sanitizePositiveInteger
		},
		{
			column: "business_bankruptcies_file_date",
			description: "The date the most recent bankruptcy was filed",
			alternate: [
				"bankruptcies_file_date",
				"bankruptcy_date",
				"bus_bankruptcy_summary_002",
				"most_recent_bankruptcy_filing_date"
			],
			sanitize: async (_, str) => sanitizeDate(str)
		},
		{
			column: "business_bankruptcies_chapter",
			description: "The chapter of the most recent bankruptcy",
			alternate: ["bankruptcies_chapter", "bankruptcy_chapter", "bus_bankruptcy_summary_003"]
		},
		{
			column: "business_bankruptcies_voluntary",
			description: "Whether the most recent bankruptcy was voluntary - I = involuntary; V = voluntary",
			alternate: ["bankruptcies_voluntary", "bankruptcy_voluntary", "bus_bankruptcy_summary_004"],
			sanitize: async (_, str) => (str?.toUpperCase()?.startsWith("V") ? "V" : "I")
		},
		{
			column: "business_bankruptcies_status",
			description: "The status of the most recent bankruptcy",
			alternate: ["bankruptcies_status", "bankruptcy_status", "bus_bankruptcy_summary_005"]
		},
		{
			column: "business_bankruptcies_status_date",
			description: "The date the most recent bankruptcy status was updated",
			alternate: ["bankruptcies_status_date", "bankruptcy_status_date", "bus_bankruptcy_summary_006"],
			sanitize: async (_, str) => sanitizeDate(str)
		},
		{
			column: "business_judgements",
			model_field: "judgement_count",
			description: "The number of judgements against the business",
			alternate: [
				"judgements",
				"bus_judgement_summary_001",
				"number_of_judgement_fillings",
				"number_of_judgement_filings"
			],
			sanitize: sanitizePositiveInteger
		},
		{
			column: "business_judgements_file_date",
			description: "The date the most recent judgement was filed",
			alternate: [
				"judgements_file_date",
				"judgement_date",
				"bus_judgement_summary_002",
				"most_recent_judgement_filing_date"
			],
			sanitize: async (_, str) => sanitizeDate(str)
		},
		{
			column: "business_judgements_status",
			description: "The status of the most recent judgement",
			alternate: ["judgements_status", "judgement_status", "bus_judgement_summary_003"]
		},
		{
			column: "business_judgements_status_date",
			description: "The date the most recent judgement status was updated",
			alternate: ["judgements_status_date", "judgement_status_date", "bus_judgement_summary_004"],
			sanitize: async (_, str) => sanitizeDate(str)
		},
		{
			column: "business_judgements_amount",
			description: "The amount of the most recent judgement",
			alternate: ["judgements_amount", "judgement_amount", "bus_judgement_summary_005"]
		},
		{
			column: "social_review_count",
			alternate: ["review_count", "review_cnt"],
			model_field: "review_cnt",
			description: "The number of social reviews for this business",
			sanitize: sanitizePositiveInteger
		},
		{
			column: "social_review_score",
			alternate: ["review_average", "review_avg"],
			model_field: "review_score",
			description: "The average review score for this business. Range between 0-5",
			sanitize: sanitizePositiveInteger,
			validation: (mapper, field) => assertTruthy(field.value >= 0 && field.value <= 5, field)
		},
		{ column: "bank_account_number", description: "The bank account number of the business" },
		{ column: "bank_name", description: "The name of the bank associated with the account" },
		{ column: "institution_name", description: "The name of the institution associated with the account" },
		{
			column: "bank_routing_number",
			description: "The routing number of the bank",
			sanitize: (mapper, value: any) => {
				return value.toString();
			},
			validate: validateRoutingNumber
		},
		{
			column: "bank_wire_routing_number",
			description: "The wire routing number of the bank",
			sanitize: (mapper, value: any) => {
				return value.toString();
			},
			validate: validateWireRoutingNumber
		},
		{ column: "bank_official_name", description: "The official name of the bank" },
		{
			column: "bank_account_type",
			description: "The type of the bank account (e.g., depository, savings)",
			validate: validateBankAccountType
		},
		{
			column: "bank_account_subtype",
			description: "The subtype of the bank account (e.g., checking, savings)",
			validate: validateBankAccountType
		},
		{ column: "bank_account_balance_current", description: "The current balance of bank accoount" },
		{ column: "bank_account_balance_available", description: "The available balance of bank accoount" },
		{ column: "bank_account_balance_limit", description: "The limit balance of bank accoount" },
		{
			column: "deposit_account",
			description: "Indicates if the account is a deposit account (true/false)",
			required: false,
			sanitize: async (_, value) => parseBool(value),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "boolean" && [true, false].includes(field.value), field)
		},
		{
			column: "bank_account_holder_type",
			description: "The type of the bank account holder (e.g., business, personal)",
			validate: validateBankAccountType
		},
		{ column: "bank_account_holder_name", description: "The name of the bank account holder" },
		{
			column: "general_monthly_volume",
			description: "The dollar amount of total volume within a given month.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "general_annual_volume",
			description: "The dollar amount of total volume within a given year.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "general_average_ticket_size",
			description: "The average transaction amount within a given year.",
			sanitize: sanitizePositiveFloat
		},
		{
			column: "general_high_ticket_size",
			description: "The highest transaction amount that is common for the applicant business.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "general_desired_limit",
			description:
				"When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "monthly_occurrence_of_high_ticket",
			description:
				"Applicant selects a range of how frequently a high ticket occurs in a given month. Current ranges are as follows: 1-5, 6-10, 11-15, 16+",
			dataType: "string" as const
		},
		{
			column: "explanation_of_high_ticket",
			description: "Context around when a high ticket occurs.",
			dataType: "string" as const
		},
		{
			column: "visa_mastercard_discover_monthly_volume",
			description: "The summation of volume for Visa, Mastercard, and Discover cards during a given month.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "visa_mastercard_discover_annual_volume",
			description: "The summation of volume for Visa, Mastercard, and Discover cards during a given year.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "visa_mastercard_discover_average_ticket_size",
			description: "The average transaction amount across Visa, Mastercard, and Discover in total.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "visa_mastercard_discover_high_ticket_size",
			description: "The highest ticket size among Visa, Mastercard, and Discover.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "visa_mastercard_discover_desired_limit",
			description:
				"When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "american_express_monthly_volume",
			description: "The summation of volume for all American Express transactions.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "american_express_annual_volume",
			description: "The summation of volume for Visa, Mastercard, and Discover cards during a given year.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "american_express_average_ticket_size",
			description: "The average transaction amount for all American Express transactions.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "american_express_high_ticket_size",
			description: "The highest ticket size for American Express transactions.",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "american_express_desired_limit",
			description:
				"When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).",
			dataType: "number" as const,
			sanitize: sanitizePositiveFloat
		},
		{
			column: "is_seasonal_business",
			description: "Business is seasonal?",
			sanitize: async (_, value) => parseBool(value),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "boolean" && [true, false].includes(field.value), field)
		},
		{
			column: "high_volume_months",
			description: "Which months high volumes are experienced, if the applicant business is seasonal.",
			dataType: "string" as const,
			validate: validateHighVolumeMonths
		},
		{
			column: "explanation_of_high_volume_months",
			description: "Context around high volume months, if the applicant business is seasonal.",
			dataType: "string" as const
		},
		{
			column: "swiped_cards",
			description: "Percent of point of sale volume via credit card swiping.",
			validate: validatePercentage,
			sanitize: async (mapper: Mapper, value: any) => parseFloat(value) || 0
		},
		{
			column: "typed_cards",
			description: "Percent of point of sale volume via credit card typed manually.",
			validate: validatePercentage,
			sanitize: async (mapper: Mapper, value: any) => parseFloat(value) || 0
		},
		{
			column: "e_commerce",
			description: "Percent of point of sale volume via eCommerce.",
			validate: validatePercentage,
			sanitize: async (mapper: Mapper, value: any) => parseFloat(value) || 0
		},
		{
			column: "mail_telephone",
			description: "Percent of point of sale volume via mail or telephone.",
			validate: validatePercentage,
			sanitize: async (mapper: Mapper, value: any) => parseFloat(value) || 0
		}
	].map(f => ({ ...f, table: "integration_data" }));
}
