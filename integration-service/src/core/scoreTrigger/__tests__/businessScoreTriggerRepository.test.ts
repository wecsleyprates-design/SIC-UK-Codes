import { BusinessScoreTriggerRepository, BusinessScoreTriggerRepositoryError } from "../businessScoreTriggerRepository";
import { SCORE_TRIGGER } from "#constants";
import type { UUID } from "crypto";

const MOCK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001" as UUID;

const createMockScoreTrigger = (overrides = {}) => ({
	id: "00000000-0000-0000-0000-000000000099" as UUID,
	business_id: MOCK_BUSINESS_ID,
	trigger_type: SCORE_TRIGGER.ONBOARDING_INVITE,
	version: 1,
	customer_id: "00000000-0000-0000-0000-000000000002" as UUID,
	created_at: "2025-01-01T00:00:00.000Z",
	...overrides
});

/** Builds a chainable knex mock where the terminal call resolves to `result` */
const createKnexMock = (result: any) => {
	const chain: Record<string, jest.Mock> = {};
	chain.select = jest.fn().mockReturnValue(chain);
	chain.where = jest.fn().mockReturnValue(chain);
	chain.orderBy = jest.fn().mockReturnValue(chain);
	chain.first = jest.fn().mockResolvedValue(result);
	chain.insert = jest.fn().mockReturnValue(chain);
	chain.returning = jest.fn().mockResolvedValue(result);

	const knexFn = jest.fn().mockReturnValue(chain);
	return { knexFn, chain };
};

describe("BusinessScoreTriggerRepository", () => {
	describe("getLatestByBusinessId", () => {
		it("should return the latest score trigger ordered by version desc", async () => {
			const trigger = createMockScoreTrigger({ version: 3 });
			const { knexFn, chain } = createKnexMock(trigger);
			const repo = new BusinessScoreTriggerRepository({ db: knexFn as any });

			const result = await repo.getLatestByBusinessId(MOCK_BUSINESS_ID);

			expect(result).toEqual(trigger);
			expect(knexFn).toHaveBeenCalledWith(BusinessScoreTriggerRepository.TABLE);
			expect(chain.select).toHaveBeenCalledWith("*");
			expect(chain.where).toHaveBeenCalledWith({ business_id: MOCK_BUSINESS_ID });
			expect(chain.orderBy).toHaveBeenCalledWith("version", "desc");
			expect(chain.first).toHaveBeenCalled();
		});

		it("should return undefined when no trigger exists", async () => {
			const { knexFn } = createKnexMock(undefined);
			const repo = new BusinessScoreTriggerRepository({ db: knexFn as any });

			const result = await repo.getLatestByBusinessId(MOCK_BUSINESS_ID);

			expect(result).toBeUndefined();
		});
	});

	describe("create", () => {
		it("should insert and return the new score trigger", async () => {
			const newTrigger = createMockScoreTrigger({
				trigger_type: SCORE_TRIGGER.MANUAL_REFRESH,
				version: 2
			});
			const { knexFn, chain } = createKnexMock([newTrigger]);
			const repo = new BusinessScoreTriggerRepository({ db: knexFn as any });

			const egg = {
				business_id: MOCK_BUSINESS_ID,
				trigger_type: SCORE_TRIGGER.MANUAL_REFRESH,
				version: 2,
				customer_id: "00000000-0000-0000-0000-000000000002" as UUID
			};

			const result = await repo.create(egg);

			expect(result).toEqual(newTrigger);
			expect(chain.insert).toHaveBeenCalledWith(egg);
			expect(chain.returning).toHaveBeenCalledWith("*");
		});

		it("should throw BusinessScoreTriggerRepositoryError when insert returns empty", async () => {
			const { knexFn } = createKnexMock([undefined]);
			const repo = new BusinessScoreTriggerRepository({ db: knexFn as any });

			const egg = {
				business_id: MOCK_BUSINESS_ID,
				trigger_type: SCORE_TRIGGER.MANUAL_REFRESH,
				version: 1
			};

			await expect(repo.create(egg)).rejects.toThrow(BusinessScoreTriggerRepositoryError);
		});
	});
});
