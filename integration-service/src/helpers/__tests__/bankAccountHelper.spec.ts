import BankAccount from "#api/v1/modules/banking/models/bankAccount";
import { INTEGRATION_ID } from "#constants/integrations.constant";
import { deduplicateBankAccounts } from "../bankAccountHelper";

// Mock dependencies
jest.mock("#utils/encryption", () => ({ decryptData: jest.fn() }));

describe("deduplicateBankAccounts", () => {
	// Helper function to create mock bank account
	const createMockAccount = (overrides = {}) => ({
		getRecord: () => ({
			bank_account: "encrypted_123",
			bank_name: "Chase Bank",
			subtype: "checking",
			mask: "1234",
			business_integration_task_id: "task_123",
			...overrides
		})
	}) as BankAccount;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should return accounts when no duplicates exist", async () => {
		// Mocking two different accounts
		const account1 = createMockAccount({
			bank_account: "encrypted_111",
			bank_name: "Chase Bank"
		});
		
		const account2 = createMockAccount({
			bank_account: "encrypted_222",
			bank_name: "Wells Fargo"
		});

		// Different decrypted account numbers
		const { decryptData } = require("#utils/encryption");
		decryptData
			.mockReturnValueOnce("1111111111")
			.mockReturnValueOnce("2222222222");

		const result = await deduplicateBankAccounts([account1, account2]);

		// Should return both accounts
		expect(result).toHaveLength(2);
		expect(result[0].getRecord().bank_account).toBe("encrypted_111");
		expect(result[1].getRecord().bank_account).toBe("encrypted_222");
	});

	it("should prefer Plaid accounts over manual duplicates", async () => {
		// Mocking manual account and Plaid account with same details
		const manualAccount = createMockAccount({
			business_integration_task_id: "manual_task_123",
			platform_id: INTEGRATION_ID.MANUAL
		});
		
		const plaidAccount = createMockAccount({
			business_integration_task_id: "plaid_task_456",
			platform_id: INTEGRATION_ID.PLAID
		});

		// Same decrypted account number for both
		const { decryptData } = require("#utils/encryption");
		decryptData.mockReturnValue("123456789");

		const result = await deduplicateBankAccounts([manualAccount, plaidAccount]);

		// Should return only one account that is a Plaid account
		expect(result).toHaveLength(1);
		expect(result[0].getRecord().business_integration_task_id).toBe("plaid_task_456");
		expect(result[0].getRecord().platform_id).toBe(INTEGRATION_ID.PLAID);
	});

});
