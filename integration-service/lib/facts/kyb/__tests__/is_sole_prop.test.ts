import { IDV_STATUS } from "#constants";
import { IdentityVerificationStatus, IDNumberType } from "plaid";
import { FactEngine } from "../../factEngine";
import { FactRules, FactUtils } from "#lib/facts";
import { kybFacts } from "..";
import { sources } from "#lib/facts/sources";
import { maskString } from "#utils/encryption";

describe("is_sole_prop", () => {
	let factEngine: FactEngine;
	const businessID = "00000000-0000-0000-0000-000000000123";

	let middeskRawResponse: Record<string, any>;
	let manualCustomerResponse: Record<string, any>;
	let businessDetailsResponse: Record<string, any>;
	let plaidIdvResponse: Record<string, any>;

	const solePropFactNames = FactUtils.getAllFactsThatDependOnFacts(["is_sole_prop", "tin_submitted", "idv_status", "idv_passed", "idv_passed_boolean"], kybFacts);
	const solePropFacts = kybFacts.filter(fact => solePropFactNames.includes(fact.name));

	beforeEach(() => {
		/* Override these as appropriate per test 
		Make sure that the default responses are set to derive a is_sole_prop = true response
	*/
		middeskRawResponse = {
			submitted: { tin: { tin: "123456789" } }
		};
		manualCustomerResponse = {
			tin: "123456789"
		};
		businessDetailsResponse = {
			owners: [{ name: "John Doe" }],
			tin: "123456789"
		};
		plaidIdvResponse = [{ status: IDV_STATUS.SUCCESS, meta: { status: IdentityVerificationStatus.Success, user: { id_number: { type: IDNumberType.UsSsnLast4, value: "6789" } } } }];

		/* Override the source getters for each test to just return the mock response */
		sources.middeskRaw.getter = async () => middeskRawResponse;
		sources.manualCustomer.getter = async () => manualCustomerResponse;
		sources.businessDetails.getter = async () => businessDetailsResponse;
		sources.plaidIdv.getter = async () => plaidIdvResponse;
	});

	it("should prefer the businessDetails tin", async () => {
		businessDetailsResponse.tin = "999999999";
		middeskRawResponse.submitted.tin.tin = "111111111";
		manualCustomerResponse.tin = "222222222";
		factEngine = new FactEngine(solePropFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		const tinSubmitted = await factEngine.getResolvedFact("tin_submitted");
		expect(tinSubmitted?.value).toEqual(maskString(businessDetailsResponse.tin));
	});

	it("should accurately map idv statuses by type", async () => {
		plaidIdvResponse = [
			{ status: IDV_STATUS.SUCCESS, meta: { status: IdentityVerificationStatus.Success, user: { id_number: { type: IDNumberType.UsSsnLast4, value: "6789" } } } },
			{ status: IDV_STATUS.FAILED, meta: { status: IdentityVerificationStatus.Failed, user: { id_number: { type: IDNumberType.UsSsnLast4, value: "6789" } } } },
			{ status: IDV_STATUS.PENDING, meta: { status: IdentityVerificationStatus.PendingReview, user: { id_number: { type: IDNumberType.UsSsnLast4, value: "6789" } } } },
			{ status: IDV_STATUS.EXPIRED, meta: { status: IdentityVerificationStatus.Expired, user: { id_number: { type: IDNumberType.UsSsnLast4, value: "6789" } } } },
			{ status: IDV_STATUS.CANCELED, meta: { status: IdentityVerificationStatus.Canceled, user: { id_number: { type: IDNumberType.UsSsnLast4, value: "6789" } } } },
			{ status: IDV_STATUS.SUCCESS, meta: { status: IdentityVerificationStatus.Success, user: { id_number: { type: IDNumberType.UsSsnLast4, value: "1111" } } } }
		];

		factEngine = new FactEngine(solePropFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const idvStatus = await factEngine.getResolvedFact("idv_status");
		expect(idvStatus?.value).toEqual({
			CANCELED: 1,
			EXPIRED: 1,
			SUCCESS: 2,
			FAILED: 1,
			PENDING: 1
		});
	});

	it("should return null when no owners or TIN is present", async () => {
		businessDetailsResponse.owners = [];
		manualCustomerResponse.tin = null;
		middeskRawResponse.submitted.tin.tin = null;
		businessDetailsResponse.tin = null;
		factEngine = new FactEngine(solePropFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const isSoleProp = (await factEngine.getResolvedFact("is_sole_prop")?.value) ?? null;
		expect(isSoleProp).toBeNull();
	});

	it("should return false when there are multiple owners", async () => {
		businessDetailsResponse.owners = [{ name: "John Doe1" }, { name: "John Doe2" }];
		factEngine = new FactEngine(solePropFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const isSoleProp = (await factEngine.getResolvedFact("is_sole_prop")?.value) ?? null;
		expect(isSoleProp).toBe(false);
	});

	it("should return null when no idv responses are present", async () => {
		plaidIdvResponse = [];

		factEngine = new FactEngine(solePropFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const isSoleProp = (await factEngine.getResolvedFact("is_sole_prop")?.value) ?? null;
		expect(isSoleProp).toBeNull();
	});

	it("should return false when no successful IDV records", async () => {
		plaidIdvResponse = [{ status: IDV_STATUS.FAILED, meta: { status: IdentityVerificationStatus.Failed, user: { id_number: { type: IDNumberType.UsSsnLast4, value: "6789" } } } }];

		factEngine = new FactEngine(solePropFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const isSoleProp = (await factEngine.getResolvedFact("is_sole_prop")?.value) ?? null;
		expect(isSoleProp).toBe(false);
	});

	it("should return true when TIN matches SSN in successful IDV", async () => {
		plaidIdvResponse = [{ status: IDV_STATUS.SUCCESS, meta: { status: IdentityVerificationStatus.Success, user: { id_number: { type: IDNumberType.UsSsn, value: "123456789" } } } }];

		factEngine = new FactEngine(solePropFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const isSoleProp = (await factEngine.getResolvedFact("is_sole_prop")?.value) ?? null;
		expect(isSoleProp).toBe(true);
	});

	it("should return true when TIN matches last 4 of SSN in successful IDV", async () => {
		factEngine = new FactEngine(solePropFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const isSoleProp = (await factEngine.getResolvedFact("is_sole_prop")?.value) ?? null;
		expect(isSoleProp).toBe(true);
	});

	it("should return true when TIN matches SIN in successful IDV", async () => {
		plaidIdvResponse = [{ status: IDV_STATUS.SUCCESS, meta: { status: IdentityVerificationStatus.Success, user: { id_number: { type: IDNumberType.CaSin, value: "123456789" } } } }];

		factEngine = new FactEngine(solePropFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const isSoleProp = (await factEngine.getResolvedFact("is_sole_prop")?.value) ?? null;
		expect(isSoleProp).toBe(true);
	});

	it("should return false when TIN doesn't match any IDV records", async () => {
		plaidIdvResponse = [{ status: IDV_STATUS.SUCCESS, meta: { status: IdentityVerificationStatus.Success, user: { id_number: { type: IDNumberType.UsSsnLast4, value: "2222" } } } }];

		factEngine = new FactEngine(solePropFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const isSoleProp = (await factEngine.getResolvedFact("is_sole_prop")?.value) ?? null;
		expect(isSoleProp).toBe(false);
	});
});
