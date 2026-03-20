import { ApplicantFlowOwnersClient } from "../applicantFlowOwnersClient";
import { getOwnersUnencrypted } from "#helpers/api";

jest.mock("#helpers/api", () => ({
	getOwnersUnencrypted: jest.fn()
}));

describe("ApplicantFlowOwnersClient", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should delegate owner lookup to getOwnersUnencrypted", async () => {
		const owners = [{ first_name: "John", last_name: "Doe" }];
		(getOwnersUnencrypted as jest.Mock).mockResolvedValue(owners);
		const client = new ApplicantFlowOwnersClient();

		const result = await client.getOwnersUnencryptedByBusinessId("business-id" as any);

		expect(getOwnersUnencrypted).toHaveBeenCalledWith("business-id");
		expect(result).toEqual(owners);
	});
});
