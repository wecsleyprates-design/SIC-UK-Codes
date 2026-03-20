import { FactEngine, FactRules, FactUtils } from "#lib/facts";
import { kybFacts } from "..";
import { sources } from "#lib/facts/sources";
import type { OpenCorporateResponse } from "#lib/opencorporates/types";
import type { GetBusinessEntityReview } from "#api/v1/modules/verification/types";

describe("sos_filings", () => {
	let factEngine: FactEngine;
	const businessID = "00000000-0000-0000-0000-000000000123";

	let middeskRawResponse: Record<string, any>;
	let openCorporatesResponse: OpenCorporateResponse | null;
	let equifaxResponse: Record<string, any>;
	let verdataResponse: Record<string, any>;

	const sosFilingsFactNames = FactUtils.getAllFactsThatDependOnFacts(["sos_filings", "people"], kybFacts);
	const sosFilingFacts = kybFacts.filter(fact => sosFilingsFactNames.includes(fact.name));

	beforeEach(() => {
		/* Override these as appropriate per test 
		Make sure that the default responses are set to derive a is_sole_prop = true response
	*/
		equifaxResponse = {};
		verdataResponse = {};
		middeskRawResponse = {};
		openCorporatesResponse = {
			match: {
				zip: "02790",
				city: "WESTPORT",
				index: 45,
				line1: "712 STATE RD",
				state: "MA",
				address: "712 STATE RD., WESTPORT, MA, 02790, USA",
				suppliedname: "State Road Liquors",
				company_number: "043051801",
				normalized_name: "STATE ROAD MOTORS INC",
				suppliedaddress:
					'{"number":"123","street":"STATE","type":"RD","city":"WESTPORT","state":"MA","zip":"02790","zip_ext":"USA","country":"USA","line1":"123 STATE RD","line3":"WESTPORT, MA 02790"}',
				jurisdiction_code: "us_ma",
				normalized_address: "712 STATE RD, WESTPORT, MA 02790",
				extra_verification: {
					npi_match: null,
					name_match: null,
					canada_open_business_number_match: null,
					canada_open_corporate_id_match: null
				}
			},
			names: [
				{
					name: "STATE ROAD MOTORS, INC.",
					name1: "S",
					name2: "ST",
					source: "companies",
					company_number: "043051801",
					normalized_name: "STATE ROAD MOTORS INC",
					jurisdiction_code: "us_ma"
				}
			],
			officers: [
				{
					name: "GEORGE SILVA",
					title: "PRESIDENT"
				},
				{
					name: "AGOSTINHO M. SILVA",
					title: "TREASURER"
				},
				{
					name: "GEORGE SILVA",
					title: "SECRETARY"
				}
			],
			addresses: [
				{
					zip: "02790",
					city: "WESTPORT",
					zip2: "02",
					zip3: "027",
					zip4: "0279",
					line1: "712 STATE RD",
					state: "MA",
					source: "companies",
					address: "712 STATE RD., WESTPORT, MA, 02790, USA",
					address_parts:
						'{"city": "WESTPORT", "zip_ext": "USA", "zip": "02790", "country": "USA", "line3": "WESTPORT, MA 02790", "number": "712", "line1": "712 STATE RD", "state": "MA", "street": "STATE", "type": "RD"}',
					company_number: "043051801",
					jurisdiction_code: "us_ma",
					normalized_address: "712 STATE RD, WESTPORT, MA 02790"
				}
			],
			sosFilings: [],
			firmographic: {
				name: "STATE ROAD MOTORS, INC.",
				branch: "",
				inactive: false,
				nonprofit: false,
				company_type: "Domestic Profit Corporation",
				registry_url: "https://corp.sec.state.ma.us/CorpWeb/CorpSearch/CorpSearch.aspx",
				retrieved_at: "2025-05-12 00:00:00 UTC",
				company_number: "043051801",
				current_status: "Active",
				previous_names: "",
				business_number: "",
				normalised_name: "state road motors incorporated",
				dissolution_date: "1998-08-31",
				accounts_next_due: "",
				jurisdiction_code: "us_ma",
				incorporation_date: "1989-05-15",
				industry_code_uids: "",
				has_been_liquidated: null,
				number_of_employees: "",
				latest_accounts_cash: null,
				latest_accounts_date: "",
				native_company_number: "",
				annual_return_next_due: "",
				has_charges: null,
				has_insolvency_history: null,
				home_jurisdiction_code: "",
				home_jurisdiction_text: "",
				latest_accounts_assets: null,
				accounts_reference_date: "",
				restricted_for_marketing: null,
				"registered_address.region": "MA",
				accounts_last_made_up_date: "",
				"registered_address.country": "USA",
				"registered_address.in_full": "712 STATE RD., WESTPORT, MA, 02790, USA",
				latest_accounts_liabilities: null,
				"registered_address.locality": "WESTPORT",
				current_alternative_legal_name: "",
				"registered_address.postal_code": "02790",
				annual_return_last_made_up_date: "",
				home_jurisdiction_company_number: "",
				"registered_address.street_address": "712 STATE RD.",
				current_alternative_legal_name_language: ""
			}
		};

		/* Override the source getters for each test to just return the mock response */
		sources.middesk.getter = async () => middeskRawResponse;
		sources.opencorporates.getter = async () => openCorporatesResponse;
		sources.equifax.getter = async () => equifaxResponse;
		sources.verdataRaw.getter = async () => verdataResponse;
	});

	it("should render opencorporates when available", async () => {
		factEngine = new FactEngine(sosFilingFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		const sosFilings = await factEngine.getResolvedFact("sos_filings");
		const people = await factEngine.getResolvedFact("people");

		const expectedPeople = [
			{
				address: { country: undefined, full_address: undefined, locality: undefined, postal_code: undefined, region: undefined, street: undefined },
				first_name: undefined,
				jurisdictions: ["us::ma"],
				last_name: undefined,
				name: "GEORGE SILVA",
				officer_type: undefined,
				start_date: undefined,
				status: undefined,
				titles: ["PRESIDENT"]
			},
			{
				address: { country: undefined, full_address: undefined, locality: undefined, postal_code: undefined, region: undefined, street: undefined },
				first_name: undefined,
				jurisdictions: ["us::ma"],
				last_name: undefined,
				name: "AGOSTINHO M. SILVA",
				officer_type: undefined,
				start_date: undefined,
				status: undefined,
				titles: ["TREASURER"]
			},
			{
				address: { country: undefined, full_address: undefined, locality: undefined, postal_code: undefined, region: undefined, street: undefined },
				first_name: undefined,
				jurisdictions: ["us::ma"],
				last_name: undefined,
				name: "GEORGE SILVA",
				officer_type: undefined,
				start_date: undefined,
				status: undefined,
				titles: ["SECRETARY"]
			}
		];
		const expectedSosFilings = [
			{
				active: false,
				entity_type: "corporation",
				filing_date: "1989-05-15",
				filing_name: "STATE ROAD MOTORS, INC.",
				foreign_domestic: "domestic",
				id: "us_ma-043051801",
				jurisdiction: "us::ma",
				non_profit: false,
				officers: expectedPeople,
				registration_date: "1989-05-15",
				state: "MA",
				url: "https://corp.sec.state.ma.us/CorpWeb/CorpSearch/CorpSearch.aspx"
			}
		];
		expect(people?.value).toEqual(expectedPeople);

		expect(sosFilings?.value).toEqual(expectedSosFilings);
	});

	it("should render middesk when available", async () => {
		openCorporatesResponse = null;
		middeskRawResponse = {
			businessEntityVerification: {
				id: "e9e9f610-0ab0-40b9-a860-37872831ec88",
				created_at: "2025-03-25T23:12:11.268Z",
				updated_at: null,
				business_integration_task_id: "9f40ed52-183f-45be-9f41-5db57e20129e",
				external_id: "99f9fa1f-fa1b-4357-ab81-f232d1294499",
				business_id: "b63dca5f-7806-43cc-bf3f-b02670f555da",
				name: "Cultural Survival Inc",
				status: "in_review",
				tin: null,
				formation_state: "MA",
				formation_date: "1972-03-02T05:00:00.000Z",
				unique_external_id: null,
				year: null,
				number_of_employees: null
			},
			reviewTasks: [],
			registrations: [
				{
					id: "a77152d7-48f1-4379-b732-9b0f7eb25cd0",
					business_entity_verification_id: "e9e9f610-0ab0-40b9-a860-37872831ec88",
					created_at: "2025-02-24T04:02:32.136Z",
					updated_at: null,
					external_id: "4d5c8c1d-86a8-4f5f-80e1-950e50cd571e",
					name: "CULTURAL SURVIVAL,INC.",
					status: "active",
					sub_status: null,
					status_details: null,
					jurisdiction: "DOMESTIC",
					entity_type: "NON-PROFIT",
					file_number: "237182593",
					full_addresses: ["2067 MASSACHUSETTS AVE, CAMBRIDGE, MA 02140-1340"],
					registration_date: "1972-03-02T05:00:00.000Z",
					registration_state: "MA",
					source: "http://corp.sec.state.ma.us/CorpWeb/CorpSearch/CorpSearch.aspx"
				}
			],
			addressSources: [],
			people: [
				{
					id: "ffea41f1-8182-45f6-b1ba-602c2b0d6fb6",
					business_entity_verification_id: "e9e9f610-0ab0-40b9-a860-37872831ec88",
					created_at: "2025-02-24T04:02:32.139Z",
					updated_at: null,
					name: "DAMIEN K BARCARSE",
					titles: ["PRESIDENT"],
					submitted: false,
					source: [
						{
							id: "4d5c8c1d-86a8-4f5f-80e1-950e50cd571e",
							type: "registration",
							metadata: {
								state: "MA",
								status: "active",
								file_number: "237182593",
								jurisdiction: "DOMESTIC"
							}
						}
					]
				},
				{
					id: "34c68f91-f704-4820-ad9c-03764df369f0",
					business_entity_verification_id: "e9e9f610-0ab0-40b9-a860-37872831ec88",
					created_at: "2025-02-24T04:02:32.139Z",
					updated_at: null,
					name: "EVELYN ARCE",
					titles: ["OTHER OFFICER"],
					submitted: false,
					source: [
						{
							id: "4d5c8c1d-86a8-4f5f-80e1-950e50cd571e",
							type: "registration",
							metadata: {
								state: "MA",
								status: "active",
								file_number: "237182593",
								jurisdiction: "DOMESTIC"
							}
						}
					]
				},
				{
					id: "371307cf-62eb-4419-84c7-479cd8756303",
					business_entity_verification_id: "e9e9f610-0ab0-40b9-a860-37872831ec88",
					created_at: "2025-02-24T04:02:32.139Z",
					updated_at: null,
					name: "GALINA ANGAROVA",
					titles: ["DIRECTOR"],
					submitted: false,
					source: [
						{
							id: "4d5c8c1d-86a8-4f5f-80e1-950e50cd571e",
							type: "registration",
							metadata: {
								state: "MA",
								status: "active",
								file_number: "237182593",
								jurisdiction: "DOMESTIC"
							}
						}
					]
				}
			],
			names: []
		};

		factEngine = new FactEngine(sosFilingFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		const sosFilings = await factEngine.getResolvedFact("sos_filings");
		const people = await factEngine.getResolvedFact("people");

		const expectedPeople = [
			{
				name: "DAMIEN K BARCARSE",
				titles: ["PRESIDENT"],
				submitted: false,
				source: ["4d5c8c1d-86a8-4f5f-80e1-950e50cd571e"],
				jurisdictions: ["us::ma"]
			},
			{
				name: "EVELYN ARCE",
				titles: ["OTHER OFFICER"],
				submitted: false,
				source: ["4d5c8c1d-86a8-4f5f-80e1-950e50cd571e"],
				jurisdictions: ["us::ma"]
			},
			{
				name: "GALINA ANGAROVA",
				titles: ["DIRECTOR"],
				submitted: false,
				source: ["4d5c8c1d-86a8-4f5f-80e1-950e50cd571e"],
				jurisdictions: ["us::ma"]
			}
		];
		const expectedSosFilings = [
			{
				jurisdiction: "us::ma",
				id: "4d5c8c1d-86a8-4f5f-80e1-950e50cd571e",
				internal_reference: "a77152d7-48f1-4379-b732-9b0f7eb25cd0",
				filing_date: "1972-03-02T05:00:00.000Z",
				entity_type: "NON-PROFIT",
				active: true,
				state: "MA",
				url: "http://corp.sec.state.ma.us/CorpWeb/CorpSearch/CorpSearch.aspx",
				filing_name: "CULTURAL SURVIVAL,INC.",
				registration_date: "1972-03-02T05:00:00.000Z",
				foreign_domestic: "domestic",
				officers: expectedPeople
			}
		];

		expect(people?.value).toEqual(expectedPeople);

		expect(sosFilings?.value).toEqual(expectedSosFilings);
	});
});
