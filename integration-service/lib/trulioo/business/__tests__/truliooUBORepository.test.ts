import { TruliooUBORepository } from "../truliooUBORepository";
import { db } from "#helpers/knex";
import { INTEGRATION_ID } from "#constants";

let mockQueryResult: any[] = [];

jest.mock("#helpers/knex", () => {
	const qb = {
		select: jest.fn().mockReturnThis(),
		join: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		then: jest.fn().mockImplementation((resolve: (rows: any[]) => unknown) => resolve(mockQueryResult))
	};
	return {
		db: jest.fn(() => qb)
	};
});

jest.mock("#constants", () => ({
	INTEGRATION_ID: { MIDDESK: 16 }
}));

describe("TruliooUBORepository", () => {
	beforeEach(() => {
		mockQueryResult = [];
		jest.clearAllMocks();
	});

	it("should query Middesk discovered officers with explicit columns", async () => {
		const repository = new TruliooUBORepository();
		const mockDb = db as unknown as jest.Mock;
		const qb = mockDb();
		mockQueryResult = [{ id: "officer-1", name: "Officer Name", titles: ["CEO"] }];

		const result = await repository.fetchMiddeskDiscoveredOfficers("business-id" as any);

		expect(mockDb).toHaveBeenCalledWith("integration_data.business_entity_people as bep");
		expect(qb.select).toHaveBeenCalledWith(
			"bep.id",
			"bep.business_entity_verification_id",
			"bep.created_at",
			"bep.updated_at",
			"bep.name",
			"bep.submitted",
			"bep.metadata",
			"bep.source",
			"bep.titles"
		);
		expect(qb.where).toHaveBeenCalledWith("conn.business_id", "business-id");
		expect(qb.where).toHaveBeenCalledWith("conn.platform_id", INTEGRATION_ID.MIDDESK);
		expect(qb.where).toHaveBeenCalledWith("bep.submitted", false);
		expect(result).toEqual(mockQueryResult);
	});
});
