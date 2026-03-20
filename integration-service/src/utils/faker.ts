import { VerificationRreviewWebhookEvent } from "#lib/middesk";
import { Owner } from "#types/worthApi";
import { version } from "os";
import { v4 as uuidv4 } from "uuid";
import { AccountingType, PlacesType, TaxFilingRecord } from "#api/v1/modules/faker/types";

import type { IdentityVerification as PlaidIdentityVerification } from "plaid";
const { faker } = require("@faker-js/faker");

export const getDummyMiddeskResponse = ({ unique_external_id, business_name, tin, business_id }): VerificationRreviewWebhookEvent => {
	return {
		type: "verification_review",
		object: "event",
		id: business_id,
		data: {
			object: {
				object: "business",
				id: business_id,
				external_id: null,
				unique_external_id,
				name: business_name,
				created_at: faker.date.recent().toISOString(),
				updated_at: faker.date.recent().toISOString(),
				status: faker.helpers.arrayElement(["in_review", "approved"]),
				tags: [],
				requester: {
					id: faker.string.uuid(),
					type: "account",
					name: faker.person.firstName(),
					requested_at: faker.date.recent().toISOString()
				},
				assignee_id: faker.string.uuid(),
				supported_document_types: ["Articles of Incorporation", "Certificate of Good Standing"],
				review: {
					object: "review",
					id: faker.string.uuid(),
					created_at: faker.date.recent().toISOString(),
					updated_at: faker.date.recent().toISOString(),
					completed_at: null,
					tasks: [
						{
							category: "name",
							key: "name",
							label: "Business Name",
							message: "Match identified to the submitted Business Name",
							name: "name",
							status: "success",
							sub_label: "Verified",
							sources: [
								{
									id: faker.string.uuid(),
									type: "name",
									metadata: {
										name: business_name,
										submitted: true,
										is_mock: true
									}
								}
							]
						},
						{
							category: "address",
							key: "address_verification",
							label: "Office Address",
							message: "Match identified to the submitted Office Address",
							name: "address",
							status: "success",
							sub_label: "Verified",
							sources: [
								{
									id: faker.string.uuid(),
									type: "address",
									metadata: {
										city: faker.location.city(),
										state: faker.location.state({ abbreviated: true }),
										submitted: true,
										postal_code: faker.location.zipCode(),
										full_address: faker.location.streetAddress(),
										address_line1: faker.location.streetAddress(),
										address_line2: null,
										is_mock: true
									}
								}
							]
						}
						// Add more tasks as needed
					],
					assignee: {
						object: "user",
						id: faker.string.uuid(),
						name: `${faker.person.firstName()} ${faker.person.lastName()}`,
						email: faker.internet.email(),
						roles: ["admin", "member"],
						image_url: faker.image.avatar(),
						last_login_at: faker.date.recent().toISOString(),
						settings: { receives_agent_emails: false }
					}
				},
				tin: {
					name: business_name,
					mismatch: false,
					unknown: false,
					verified: true,
					error: null,
					updated_at: faker.date.recent().toISOString(),
					issued: true,
					verified_by: "business",
					business_id,
					tin
				},
				business_batch_id: null,
				formation: {
					entity_type: "CORPORATION",
					formation_date: faker.date.past().toISOString().split("T")[0],
					formation_state: faker.location.state({ abbreviated: true }),
					created_at: faker.date.recent().toISOString(),
					updated_at: faker.date.recent().toISOString()
				},
				website: {
					object: "website",
					id: faker.string.uuid(),
					url: faker.internet.url(),
					created_at: faker.date.past().toISOString(),
					updated_at: faker.date.past().toISOString(),
					status: "online",
					http_status_code: null,
					title: faker.lorem.words(2),
					description: faker.lorem.sentence(),
					domain: {
						domain: faker.internet.domainName(),
						domain_id: faker.number.int().toString() + "_DOMAIN_COM-VRSN",
						creation_date: faker.date.past().toISOString(),
						expiration_date: faker.date.future().toISOString(),
						registrar: {
							organization: "GoDaddy.com, LLC",
							name: "GoDaddy.com, LLC",
							url: "http://www.godaddy.com"
						}
					},
					pages: [
						{
							url: faker.internet.url(),
							category: "home",
							screenshot_url: faker.image.url()
						}
					],
					parked: false,
					error: null,
					business_id: faker.string.uuid(),
					business_name_match: true,
					phone_numbers: [],
					people: null,
					addresses: [],
					email_addresses: null
				},
				watchlist: {
					object: "watchlist",
					id: faker.string.uuid(),
					hit_count: 0,
					agencies: [
						{
							abbr: "OFAC",
							name: "Office of Foreign Assets Control",
							org: "U.S. Department of Treasury"
						},
						{
							abbr: "BIS",
							name: "Bureau of Industry and Security",
							org: "U.S. Department of Commerce"
						}
						// Add more agencies as needed
					],
					lists: [
						{
							object: "watchlist_source",
							agency: "Office of Foreign Assets Control",
							agency_abbr: "OFAC",
							organization: "U.S. Department of Treasury",
							title: "Capta List",
							abbr: "CAP",
							results: []
						},
						{
							object: "watchlist_source",
							agency: "Bureau of Industry and Security",
							agency_abbr: "BIS",
							organization: "U.S. Department of Commerce",
							title: "Denied Persons List",
							abbr: "DPL",
							results: []
						}
						// Add more lists as needed
					],
					people: []
				},
				bankruptcies: [],
				certifications: [],
				documents: [],
				liens: [],
				names: [
					{
						object: "name",
						id: faker.string.uuid(),
						name: business_name,
						submitted: true,
						type: "legal",
						business_id,
						sources: [
							{
								id: faker.string.uuid(),
								type: "registration",
								metadata: {
									state: faker.location.state({ abbreviated: true }),
									status: "active",
									file_number: `FN-${faker.string.alphanumeric(7)}`,
									jurisdiction: "DOMESTIC"
								}
							}
						]
					}
				],
				addresses: [
					{
						object: "address",
						address_line1: faker.location.streetAddress(),
						address_line2: null,
						city: faker.location.city(),
						state: faker.location.state({ abbreviated: true }),
						postal_code: faker.location.zipCode(),
						full_address: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state({ abbreviated: true })} ${faker.location.zipCode()}`,
						submitted: true,
						id: faker.string.uuid(),
						latitude: parseFloat(faker.location.latitude()),
						longitude: parseFloat(faker.location.longitude()),
						property_type: null,
						deliverable: true,
						deliverability_analysis: null,
						street_view_available: false,
						labels: [],
						created_at: faker.date.recent().toISOString(),
						updated_at: faker.date.recent().toISOString(),
						registered_agent_name: null,
						cmra: false,
						business_id,
						sources: [
							{
								id: faker.string.uuid(),
								type: "registration",
								metadata: {
									state: faker.location.state({ abbreviated: true }),
									status: "active",
									file_number: `FN-${faker.string.alphanumeric(7)}`,
									jurisdiction: "DOMESTIC"
								}
							}
						]
					}
					// Add more addresses as needed
				],
				people: [],
				phone_numbers: [],
				profiles: [],
				registrations: [
					{
						object: "registration",
						id: faker.string.uuid(),
						business_id,
						name: business_name,
						status: "active",
						sub_status: "GOOD_STANDING",
						status_details: "Active-Good Standing",
						jurisdiction: "DOMESTIC",
						entity_type: "CORPORATION",
						file_number: `FN-${faker.string.alphanumeric(7)}`,
						addresses: [faker.location.streetAddress(), faker.location.streetAddress()],
						officers: [],
						registered_agent: {},
						registration_date: faker.date.past().toISOString().split("T")[0],
						state: faker.location.state({ abbreviated: true }),
						source: "http://search.sunbiz.org/Inquiry/CorporationSearch/ByName"
					}
					// Add more registrations as needed
				],
				orders: [
					{
						object: "order",
						id: faker.string.uuid(),
						business_id,
						completed_at: faker.date.recent().toISOString(),
						created_at: faker.date.recent().toISOString(),
						product: "bankruptcies",
						package: "bankruptcies",
						requester: { name: faker.person.firstName(), type: "account" },
						status: "completed",
						subproducts: [],
						updated_at: faker.date.recent().toISOString()
					},
					{
						object: "order",
						id: faker.string.uuid(),
						business_id,
						completed_at: faker.date.recent().toISOString(),
						created_at: faker.date.recent().toISOString(),
						product: "business_verification_verify",
						package: "business_verification_verify",
						requester: { name: faker.person.firstName(), type: "account" },
						status: "completed",
						subproducts: [],
						updated_at: faker.date.recent().toISOString()
					}
				],
				industry_classification: null,
				monitor: null,
				tax_exempt_organization: null,
				fmcsa_registrations: [],
				litigations: [],
				actions: [],
				policy_results: [],
				politically_exposed_person_screening: null,
				adverse_media_screening: null,
				signal: null,
				submitted: {
					object: "submitted_attributes",
					name: business_name,
					entity_type: null,
					addresses: [
						{
							city: faker.location.city(),
							state: faker.location.state({ abbreviated: true }),
							postal_code: faker.location.zipCode(),
							address_line1: faker.location.streetAddress()
						}
					],
					orders: null,
					people: [],
					phone_numbers: null,
					tags: null,
					external_id: null,
					unique_external_id,
					website: null,
					assignee_id: null,
					formation: null,
					names: null
				},
				subscription: null
			}
		}
	};
};

export const getDummyPlaidIdvResponse = (owner: Owner): PlaidIdentityVerification => {
	return {
		id: `idv_${faker.random.alphaNumeric(13)}`,
		user: {
			name: {
				given_name: owner.first_name,
				family_name: owner.last_name
			},
			address: {
				city: owner.address_city,
				region: owner.address_state,
				street: owner.address_line_1,
				country: owner.address_country,
				street2: owner.address_line_2,
				postal_code: owner.address_postal_code
			},
			id_number: {
				type: "us_ssn_last_4",
				value: faker.random.numeric(4)
			},
			ip_address: faker.internet.ip(),
			phone_number: faker.phone.number("+1##########"),
			date_of_birth: faker.date.birthdate({ min: 1950, max: 2000 }).toISOString().split("T")[0],
			email_address: owner.email ?? faker.internet.email()
		},
		steps: {
			kyc_check: "success",
			accept_tos: "skipped",
			risk_check: "success",
			verify_sms: "not_applicable",
			selfie_check: "not_applicable",
			watchlist_screening: "not_applicable",
			documentary_verification: "not_applicable"
		},
		status: "success",
		template: {
			id: `idvtmp_${faker.random.alphaNumeric(13)}`,
			version: faker.datatype.number({ min: 1, max: 10 })
		},
		kyc_check: {
			name: {
				summary: "match"
			},
			status: "success",
			address: {
				type: "no_data",
				po_box: "no_data",
				summary: "match"
			},
			id_number: {
				summary: "match"
			},
			phone_number: {
				summary: "no_match",
				area_code: "match"
			},
			date_of_birth: {
				summary: "match"
			}
		},
		created_at: faker.date.recent().toISOString(),
		request_id: faker.random.alphaNumeric(10),
		risk_check: {
			email: null,
			phone: {
				linked_services: ["facebook", "google", "twitter", "instagram", "yahoo", "whatsapp", "telegram", "viber", "ok"]
			},
			status: "success",
			devices: [],
			behavior: null,
			identity_abuse_signals: null
		},
		redacted_at: null,
		completed_at: faker.date.recent().toISOString(),
		selfie_check: null,
		shareable_url: null,
		client_user_id: faker.string.uuid(),
		previous_attempt_id: null,
		watchlist_screening_id: null,
		documentary_verification: null
	} as unknown as PlaidIdentityVerification;
};

export const generateFakeTaxFilingRecord = (business_integration_task_id: string, business_type: string = "BUSINESS"): TaxFilingRecord[] => {
	const validBusinessTypes = ["INDIVIDUAL", "BUSINESS"];

	const formatFakerDate = (date: Date): string => {
		const options = {
			year: "numeric",
			month: "short",
			day: "numeric"
		} as const;
		return new Intl.DateTimeFormat("en-US", options).format(date).toUpperCase();
	};

	const quarters = ["03", "06", "09", "12"];
	const currentYear = new Date().getFullYear();
	const startYear = currentYear - 5;

	const getRandomForm = (): string => {
		const forms = ["1040", "941", "1041", "1065", "1120"];
		return forms[Math.floor(Math.random() * forms.length)];
	};

	const finalBusinessType = validBusinessTypes.includes(business_type) ? business_type : "BUSINESS";

	const records: TaxFilingRecord[] = [];

	for (let year = startYear; year <= currentYear; year++) {
		for (const quarter of quarters) {
			records.push({
				id: uuidv4(),
				business_type: finalBusinessType,
				business_integration_task_id: business_integration_task_id,
				naics: 0,
				naics_title: "",
				period: `${year}${quarter}`,
				form: getRandomForm(),
				form_type: "RETR",
				filing_status: "",
				adjusted_gross_income: Number(faker.finance.amount({ min: 50000, max: 5000000, dec: 2 })),
				total_income: 0,
				total_sales: 0,
				total_compensation: 0,
				total_wages: Number(faker.finance.amount({ min: 50000, max: 500000, dec: 2 })),
				irs_balance: 0,
				lien_balance: 0,
				interest: 0,
				interest_date: formatFakerDate(faker.date.past()),
				penalty: 0,
				penalty_date: formatFakerDate(faker.date.past()),
				filed_date: faker.date.past().toISOString().substring(0, 10),
				balance: 0,
				tax_period_ending_date: faker.date.past().toISOString().substring(0, 10),
				amount_filed: 0,
				cost_of_goods_sold: 0,
				version: 1
			});
		}
	}

	return records;
};

export const generateFakeVerdataRecord = (business_integration_task_id: string) => {
	const createdAt = faker.date.past().toISOString();
	const updatedAt = faker.date.between({ from: createdAt, to: new Date() }).toISOString();

	const generateDate = () => faker.date.past().toISOString();
	const generateInt = (min: number, max: number) => faker.number.int({ min, max });
	const generateFloat = (min: number, max: number, decimals: number = 2) => randomFloat(min, max, decimals);

	return {
		id: uuidv4(),
		business_integration_task_id: business_integration_task_id,
		number_of_business_liens: generateInt(0, 10),
		most_recent_business_lien_filing_date: generateDate(),
		most_recent_business_lien_status: getRandomEnumValue(BusinessLienStatus),
		number_of_bankruptcies: generateInt(0, 5),
		most_recent_bankruptcy_filing_date: generateDate(),
		number_of_judgement_fillings: generateInt(0, 5),
		most_recent_judgement_filling_date: null,
		corporate_filing_business_name: "ONE STOP FURNITURE AND MATTRESS LLC",
		corporate_filing_filling_date: generateDate(),
		corporate_filing_incorporation_state: null,
		corporate_filing_corporation_type: "Corporation",
		corporate_filing_resgistration_type: "Domestic Limited Liability Company",
		corporate_filing_secretary_of_state_status: "Active",
		corporate_filing_secretary_of_state_status_date: generateDate(),
		average_rating: generateFloat(1, 5, 2),
		angi_review_count: generateInt(0, 1000),
		angi_review_percentage: generateFloat(0, 1, 2),
		bbb_review_count: generateInt(0, 1000),
		bbb_review_percentage: generateFloat(0, 1, 2),
		google_review_count: generateInt(0, 9999),
		google_review_percentage: Math.random() > 0.5 ? randomFloat(0, 1, 2) : 1.0,
		yelp_review_count: generateInt(0, 999),
		yelp_review_percentage: generateFloat(0, 1, 2),
		healthgrades_review_count: generateInt(0, 999),
		healthgrades_review_percentage: generateFloat(0, 1, 2),
		vitals_review_count: generateInt(0, 999),
		vitals_review_percentage: generateFloat(0, 1, 2),
		webmd_review_count: generateInt(0, 999),
		webmd_review_percentage: generateFloat(0, 1, 2),
		created_at: createdAt,
		updated_at: updatedAt,
		monthly_rating: generateFloat(0, 5, 2),
		monthly_rating_date: generateDate() ?? "2024-08-01 00:00:00.000",
		official_website: null
	};
};

export const generatePlaidData = task_id => {
	const plaidData = {
		id: faker.string.uuid(),
		business_integration_task_id: task_id,
		// bank_account: faker.finance.accountNumber(),
		bank_account: faker.string.alpha(40),
		bank_name: faker.company.name(),
		official_name: `${faker.company.name()} ${faker.finance.accountName()} ${(Math.random() * (2.0 - 0.1) + 0.1).toFixed(2)}% Interest Saving`,
		institution_name: faker.company.name(),
		verification_status: null,
		balance_current: parseFloat((Math.random() * (300 - 200) + 200).toFixed(2)),
		balance_available: parseFloat((Math.random() * (300 - 200) + 200).toFixed(2)),
		balance_limit: null,
		currency: "USD",
		type: "depository",
		subtype: "savings",
		mask: null,
		created_at: faker.date.past().toISOString(),
		average_balance: parseFloat((Math.random() * (300 - 200) + 200).toFixed(2)),
		transactions: [
			{
				id: faker.string.uuid(),
				bank_account_id: faker.string.uuid(),
				// bank_account_id: "156910ea-3c4a-483d-9d03-42125d99a47d",

				business_integration_task_id: task_id,
				transaction_id: faker.string.alpha(30),
				date: faker.date.past().toISOString(),
				// amount: parseFloat((Math.random() * (0 - -100) + -100).toFixed(2)),
				amount: parseFloat((Math.random() * 200 - 100).toFixed(2)),
				description: faker.finance.transactionDescription(),
				payment_metadata: JSON.stringify({
					by_order_of: null,
					payee: null,
					payer: null,
					payment_method: null,
					payment_processor: null,
					ppd_id: null,
					reason: null,
					reference_number: null
				}),
				currency: "USD",
				category: "Transfer,Payroll",
				payment_type: "special",
				is_pending: null,
				created_at: faker.date.recent().toISOString()
			}
		]
	};

	return { plaidData };
};

export const generateGoogleBusinessData = task_id => {
	const googleBusinessData = {
		id: faker.string.uuid(),
		business_integration_task_id: task_id,
		average_rating: faker.number.float({ min: 1, max: 5, precision: 0.1 }),
		total_reviews: faker.number.int({ min: 0, max: 1000 })
	};

	return { googleBusinessData };
};

export enum BusinessLienStatus {
	Active = "Active",
	Released = "Released",
	Pending = "Pending"
}

const randomFloat = (min: number, max: number, decimals: number = 2): number => {
	const factor = Math.pow(10, decimals);
	return Math.round((Math.random() * (max - min) + min) * factor) / factor;
};

const getRandomEnumValue = <T>(enumObj: { [key: string]: T }): T => {
	const enumValues = Object.values(enumObj);
	return enumValues[Math.floor(Math.random() * enumValues.length)];
};

const generateRandomAmount = (min = 500, max = 20000) => {
	return (Math.random() * (max - min) + min).toFixed(2);
};

const generateRandomAssetObject = () => {
	// Generate random values for leaf nodes
	const checking = generateRandomAmount(1000, 5000);
	const savings = generateRandomAmount(1000, 5000);
	const accountsReceivable = generateRandomAmount(2000, 8000);
	const inventoryAsset = generateRandomAmount(500, 2000);
	const undeposited = generateRandomAmount(1000, 4000);
	const truckCost = generateRandomAmount(10000, 25000);

	// Calculate parent sums
	const bankAccountsTotal = (parseFloat(checking) + parseFloat(savings)).toFixed(2);
	const arTotal = accountsReceivable;
	const otherAssetsTotal = (parseFloat(inventoryAsset) + parseFloat(undeposited)).toFixed(2);
	const currentAssetsTotal = (parseFloat(bankAccountsTotal) + parseFloat(arTotal) + parseFloat(otherAssetsTotal)).toFixed(2);
	const fixedAssetsTotal = truckCost;
	const totalAssets = (parseFloat(currentAssetsTotal) + parseFloat(fixedAssetsTotal)).toFixed(2);

	return {
		name: "ASSETS",
		items: [
			{
				name: "Current Assets",
				items: [
					{
						name: "Bank Accounts",
						items: [
							{ name: "Checking", items: [], value: checking, account_id: "35" },
							{ name: "Savings", items: [], value: savings, account_id: "36" }
						],
						value: bankAccountsTotal,
						account_id: null
					},
					{ name: "Accounts Receivable", items: [{ name: "Accounts Receivable (A/R)", items: [], value: accountsReceivable, account_id: "84" }], value: arTotal, account_id: null },
					{
						name: "Other Current Assets",
						items: [
							{ name: "Inventory Asset", items: [], value: inventoryAsset, account_id: "81" },
							{ name: "Undeposited Funds", items: [], value: undeposited, account_id: "4" }
						],
						value: otherAssetsTotal,
						account_id: null
					}
				],
				value: currentAssetsTotal,
				account_id: null
			},
			{
				name: "Fixed Assets",
				items: [{ name: "Truck", items: [{ name: "Original Cost", items: [], value: truckCost, account_id: "38" }], value: fixedAssetsTotal, account_id: null }],
				value: fixedAssetsTotal,
				account_id: null
			}
		],
		value: totalAssets,
		account_id: null
	};
};

const generateRandomEquityObject = () => {
	// Generate random values for the inner items
	const openingBalanceEquityValue = (Math.random() * 10000 - 5000).toFixed(2); // Random value between -5000 and 5000
	const retainedEarningsValue = (Math.random() * 5000).toFixed(2); // Random value between 0 and 5000
	const otherValue = (Math.random() * 1000).toFixed(2); // Random value between 0 and 1000

	// Calculate the sum of inner values to assign to the outer value
	const totalValue = (parseFloat(openingBalanceEquityValue) + parseFloat(retainedEarningsValue) + parseFloat(otherValue)).toFixed(2);

	return {
		name: "Equity",
		items: [
			{ name: "Opening Balance Equity", items: [], value: openingBalanceEquityValue, account_id: "34" },
			{ name: "Retained Earnings", items: [], value: retainedEarningsValue, account_id: "2" },
			{ name: "", items: [], value: otherValue, account_id: null }
		],
		value: totalValue,
		account_id: null
	};
};

const generateRandomLiabilitiesObject = () => {
	// Generate random values for the inner items
	const accountsPayableValue = (Math.random() * 5000).toFixed(2); // Random value between 0 and 5000
	const creditCardsValue = (Math.random() * 1000).toFixed(2); // Random value between 0 and 1000
	const otherLiabilitiesValue = (Math.random() * 10000).toFixed(2); // Random value between 0 and 10000
	const notesPayableValue = (Math.random() * 30000).toFixed(2); // Random value between 0 and 30000

	// Calculate the sums of the inner values to assign to the outer values
	const currentLiabilitiesValue = (parseFloat(accountsPayableValue) + parseFloat(creditCardsValue) + parseFloat(otherLiabilitiesValue)).toFixed(2);
	const longTermLiabilitiesValue = notesPayableValue;

	const totalLiabilitiesValue = (parseFloat(currentLiabilitiesValue) + parseFloat(longTermLiabilitiesValue)).toFixed(2);

	return {
		name: "Liabilities",
		items: [
			{
				name: "Current Liabilities",
				items: [
					{ name: "Accounts Payable", items: [{ name: "Accounts Payable (A/P)", items: [], value: accountsPayableValue, account_id: "33" }], value: accountsPayableValue, account_id: null },
					{ name: "Credit Cards", items: [{ name: "Mastercard", items: [], value: creditCardsValue, account_id: "41" }], value: creditCardsValue, account_id: null },
					{
						name: "Other Current Liabilities",
						items: [
							{ name: "Arizona Dept. of Revenue Payable", items: [], value: "0.00", account_id: "89" },
							{ name: "Board of Equalization Payable", items: [], value: (Math.random() * 500).toFixed(2), account_id: "90" },
							{ name: "Loan Payable", items: [], value: (Math.random() * 5000).toFixed(2), account_id: "43" }
						],
						value: otherLiabilitiesValue,
						account_id: null
					}
				],
				value: currentLiabilitiesValue,
				account_id: null
			},
			{ name: "Long-Term Liabilities", items: [{ name: "Notes Payable", items: [], value: notesPayableValue, account_id: "44" }], value: longTermLiabilitiesValue, account_id: null }
		],
		value: totalLiabilitiesValue,
		account_id: null
	};
};

const generateRandomRevenueObject = () => {
	// Generate random values for the inner items
	const designIncomeValue = (Math.random() * 2000).toFixed(2); // Random value between 0 and 2000
	const discountsGivenValue = (Math.random() * -100).toFixed(2); // Random negative value between -100 and 0
	const jobMaterialsValue = (Math.random() * 3000).toFixed(2); // Random value between 0 and 3000
	const pestControlServicesValue = (Math.random() * -200).toFixed(2); // Random negative value between -200 and 0
	const salesOfProductIncomeValue = (Math.random() * 500).toFixed(2); // Random value between 0 and 500
	const servicesIncomeValue = (Math.random() * 1000).toFixed(2); // Random value between 0 and 1000

	// Generate random values for Landscaping Services items
	const fountainsAndGardenLightingValue = (Math.random() * 1000).toFixed(2); // Random value between 0 and 1000
	const plantsAndSoilValue = (Math.random() * 2000).toFixed(2); // Random value between 0 and 2000
	const sprinklersAndDripSystemsValue = (Math.random() * 200).toFixed(2); // Random value between 0 and 200

	// Calculate the sums of inner values
	const landscapingServicesValue = (parseFloat(fountainsAndGardenLightingValue) + parseFloat(plantsAndSoilValue) + parseFloat(sprinklersAndDripSystemsValue)).toFixed(2);
	const totalIncomeValue = (
		parseFloat(designIncomeValue) +
		parseFloat(discountsGivenValue) +
		parseFloat(landscapingServicesValue) +
		parseFloat(pestControlServicesValue) +
		parseFloat(salesOfProductIncomeValue) +
		parseFloat(servicesIncomeValue)
	).toFixed(2);

	return {
		name: "Income",
		items: [
			{ name: "Design income", items: [], value: designIncomeValue, account_id: "82" },
			{ name: "Discounts given", items: [], value: discountsGivenValue, account_id: "86" },
			{
				name: "Landscaping Services",
				items: [
					{
						name: "Job Materials",
						items: [
							{ name: "Fountains and Garden Lighting", items: [], value: fountainsAndGardenLightingValue, account_id: "48" },
							{ name: "Plants and Soil", items: [], value: plantsAndSoilValue, account_id: "49" },
							{ name: "Sprinklers and Drip Systems", items: [], value: sprinklersAndDripSystemsValue, account_id: "50" }
						],
						value: jobMaterialsValue,
						account_id: null
					}
				],
				value: landscapingServicesValue,
				account_id: null
			},
			{ name: "Pest Control Services", items: [], value: pestControlServicesValue, account_id: "54" },
			{ name: "Sales of Product Income", items: [], value: salesOfProductIncomeValue, account_id: "79" },
			{ name: "Services", items: [], value: servicesIncomeValue, account_id: "1" }
		],
		value: totalIncomeValue,
		account_id: null
	};
};

const generateRandomExpensesObject = () => {
	// Generate random values for the inner items
	const fuelValue = (Math.random() * 200).toFixed(2); // Random value between 0 and 200
	const automobileValue = (parseFloat(fuelValue) + Math.random()).toFixed(2); // Sum for Automobile
	const insuranceValue = (Math.random() * 500).toFixed(2); // Random value between 0 and 500
	const jobMaterialsValue = (Math.random() * 500).toFixed(2); // Random value between 0 and 500
	const legalFeesValue = (Math.random() * 300).toFixed(2); // Random value between 0 and 300
	const maintenanceRepairValue = (Math.random() * 300).toFixed(2); // Random value between 0 and 300
	const mealsEntertainmentValue = (Math.random() * 50).toFixed(2); // Random value between 0 and 50
	const officeExpensesValue = (Math.random() * 50).toFixed(2); // Random value between 0 and 50
	const rentLeaseValue = (Math.random() * 1000).toFixed(2); // Random value between 0 and 1000
	const gasElectricValue = (Math.random() * 200).toFixed(2); // Random value between 0 and 200
	const telephoneValue = (Math.random() * 100).toFixed(2); // Random value between 0 and 100
	const utilitiesValue = (parseFloat(gasElectricValue) + parseFloat(telephoneValue)).toFixed(2); // Sum for Utilities

	// Calculate the total Expenses
	const totalExpensesValue = (
		parseFloat(automobileValue) +
		parseFloat(insuranceValue) +
		parseFloat(jobMaterialsValue) +
		parseFloat(legalFeesValue) +
		parseFloat(maintenanceRepairValue) +
		parseFloat(mealsEntertainmentValue) +
		parseFloat(officeExpensesValue) +
		parseFloat(rentLeaseValue) +
		parseFloat(utilitiesValue)
	).toFixed(2);

	return {
		name: "Expenses",
		items: [
			{ name: "Automobile", items: [{ name: "Fuel", items: [], value: fuelValue, account_id: "56" }], value: automobileValue, account_id: null },
			{ name: "Insurance", items: [], value: insuranceValue, account_id: "11" },
			{
				name: "Job Expenses",
				items: [
					{
						name: "Job Materials",
						items: [
							{ name: "Decks and Patios", items: [], value: (Math.random() * 100).toFixed(2), account_id: "64" },
							{ name: "Plants and Soil", items: [], value: (Math.random() * 100).toFixed(2), account_id: "66" },
							{ name: "Sprinklers and Drip Systems", items: [], value: (Math.random() * 100).toFixed(2), account_id: "67" }
						],
						value: jobMaterialsValue,
						account_id: null
					}
				],
				value: jobMaterialsValue,
				account_id: null
			},
			{
				name: "Legal & Professional Fees",
				items: [
					{ name: "Accounting", items: [], value: (Math.random() * 100).toFixed(2), account_id: "69" },
					{ name: "Lawyer", items: [], value: (Math.random() * 100).toFixed(2), account_id: "71" }
				],
				value: legalFeesValue,
				account_id: null
			},
			{ name: "Maintenance and Repair", items: [], value: maintenanceRepairValue, account_id: "72" },
			{ name: "Meals and Entertainment", items: [], value: mealsEntertainmentValue, account_id: "13" },
			{ name: "Office Expenses", items: [], value: officeExpensesValue, account_id: "15" },
			{ name: "Rent or Lease", items: [], value: rentLeaseValue, account_id: "17" },
			{
				name: "Utilities",
				items: [
					{ name: "Gas and Electric", items: [], value: gasElectricValue, account_id: "76" },
					{ name: "Telephone", items: [], value: telephoneValue, account_id: "77" }
				],
				value: utilitiesValue,
				account_id: null
			}
		],
		value: totalExpensesValue,
		account_id: null
	};
};

export const generateAccountingData = (business_integration_task_id: string, business_id: string, platform_id: number) => {
	try {
		const creationDate = faker.date.anytime();

		const updationDate = faker.date.future({ refDate: creationDate });

		const data: AccountingType = {
			id: faker.string.uuid(),
			business_integration_task_id: business_integration_task_id,
			business_id: business_id,
			platform_id: platform_id,
			external_id: faker.string.uuid(),
			balance: faker.finance.amount(),
			category: Math.random() < 0.5 ? "liability" : "asset",
			status: Math.random() < 0.5 ? "active" : "not active",
			account_type: Math.random() < 0.5 ? "accounts_receivable" : "accounts_payable",
			currency: "USD",
			created_at: creationDate,
			updated_at: updationDate,
			start_date: faker.date.past(),
			end_date: faker.date.future(),
			total_expenses: 0,
			total_assets: faker.finance.amount(),
			total_equity: faker.finance.amount(),
			total_liabilities: faker.finance.amount(),
			assets: generateRandomAssetObject(),
			equity: generateRandomEquityObject(),
			liabilities: generateRandomLiabilitiesObject(),
			display_name: faker.company.name(),
			currencies: faker.finance.currencyCode(),
			addresses: {
				mailing: [`${faker.location.street()}, ${faker.location.city()}, ${faker.location.state()}, ${faker.location.zipCode()}, ${faker.location.country()}`]
			},
			starting_balance: 0,
			ending_balance: 0,
			net_flow: 0,
			gross_cash_in: 0,
			gross_cash_out: 0,
			total_operating_activities: 0,
			total_investing_activities: 0,
			total_financing_activities: 0,
			operating_activities: {},
			investing_activities: {},
			financing_activities: {},
			accounting_standard: 2,
			net_income: 0,
			total_revenue: 0,
			revenue: generateRandomRevenueObject(),
			expenses: generateRandomExpensesObject(),
			cost_of_sales: { name: "Cost of Sales", items: [{ name: "", items: [], value: null, account_id: null }], value: null, account_id: null }
		};
		return data;
	} catch (err) {
		throw err;
	}
};

export const generatePlacesData = () => {
	try {
		const creationDate = faker.date.anytime();
		const updationDate = faker.date.future({ refDate: creationDate });
		const averageRating = faker.datatype.float({
			min: 0,
			max: 5,
			precision: 0.1
		});
		const totalReviews = faker.datatype.number({ min: 0, max: 100000 });

		const data: PlacesType = {
			id: faker.string.uuid(),
			average_rating: averageRating,
			total_reviews: totalReviews,
			created_at: creationDate,
			updated_at: updationDate,
			text: faker.lorem.paragraph(),
			star_rating: faker.number.int({ min: 1, max: 5 }),
			review_datetime: faker.date.anytime()
		};
		return data;
	} catch (err) {
		throw err;
	}
};
