import type { StateUpdateContext } from "../types";
import { rerunIntegration } from "../helpers";
import { verdataFetchPublicRecordsStateUpdateHandler } from "../handlers/verdataFetchPublicRecords";
import { serpRerunStateUpdateHandler } from "../handlers/serpRerun";
import { middeskBusinessStateUpdateHandler } from "../handlers/middeskBusinessEntityVerification";
import { entityMatchStateUpdateHandler } from "../handlers/entityMatchRequest";

jest.mock("../helpers", () => ({
	rerunIntegration: jest.fn().mockResolvedValue({ ok: true })
}));

const rerunIntegrationMock = rerunIntegration as unknown as jest.Mock;

const baseContext: StateUpdateContext = {
	businessId: "biz-1",
	customerId: "cust-1",
	source: "test",
	changes: {},
	changedFields: []
};

describe("stateUpdate rerun handlers", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("verdataFetchPublicRecordsStateUpdateHandler calls rerunIntegration", async () => {
		expect(verdataFetchPublicRecordsStateUpdateHandler.trigger).toBe("asynchronous");
		expect(verdataFetchPublicRecordsStateUpdateHandler.platformCode).toBe("VERDATA");
		expect(verdataFetchPublicRecordsStateUpdateHandler.taskCode).toBe("fetch_public_records");
		expect(verdataFetchPublicRecordsStateUpdateHandler.fields).toEqual([
			"data_business_names.__self",
			"data_business_addresses.__self",
			"data_business_owners.__self"
		]);

		await verdataFetchPublicRecordsStateUpdateHandler.run(baseContext);
		expect(rerunIntegrationMock).toHaveBeenCalledWith(
			baseContext.businessId,
			verdataFetchPublicRecordsStateUpdateHandler
		);
	});

	it("serpRerunStateUpdateHandler calls rerunIntegration", async () => {
		expect(serpRerunStateUpdateHandler.trigger).toBe("asynchronous");
		expect(serpRerunStateUpdateHandler.platformCode).toBe("SERP_SCRAPE");
		expect(serpRerunStateUpdateHandler.taskCode).toBe("fetch_business_entity_website_details");
		expect(serpRerunStateUpdateHandler.fields).toEqual([
			"data_business_names.__self",
			"data_business_addresses.__self",
			"data_business_owners.__self"
		]);

		await serpRerunStateUpdateHandler.run(baseContext);
		expect(rerunIntegrationMock).toHaveBeenCalledWith(baseContext.businessId, serpRerunStateUpdateHandler);
	});

	it("middeskBusinessStateUpdateHandler calls rerunIntegration", async () => {
		expect(middeskBusinessStateUpdateHandler.trigger).toBe("synchronous");
		expect(middeskBusinessStateUpdateHandler.platformCode).toBe("MIDDESK");
		expect(middeskBusinessStateUpdateHandler.taskCode).toBe("fetch_business_entity_verification");
		expect(middeskBusinessStateUpdateHandler.fields).toEqual([
			"data_businesses.tin",
			"data_business_names.__self",
			"data_business_addresses.__self",
			"data_business_owners.__self"
		]);

		await middeskBusinessStateUpdateHandler.run(baseContext);
		expect(rerunIntegrationMock).toHaveBeenCalledWith(baseContext.businessId, middeskBusinessStateUpdateHandler);
	});

	it("entityMatchStateUpdateHandler calls rerunIntegration", async () => {
		expect(entityMatchStateUpdateHandler.trigger).toBe("asynchronous");
		expect(entityMatchStateUpdateHandler.platformCode).toBe("ENTITY_MATCHING");
		expect(entityMatchStateUpdateHandler.taskCode).toBe("fetch_business_entity_verification");
		expect(entityMatchStateUpdateHandler.fields).toEqual([
			"data_businesses.tin",
			"data_business_names.__self",
			"data_business_addresses.__self",
			"data_business_owners.__self"
		]);

		await entityMatchStateUpdateHandler.run(baseContext);
		expect(rerunIntegrationMock).toHaveBeenCalledWith(baseContext.businessId, entityMatchStateUpdateHandler);
	});
});
