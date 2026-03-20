import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";
import { RiskMonitoringApiError } from "../../riskMonitoringApiError";
import { MonitoringTemplateService } from "../monitoringTemplateService";
import { TemplateRepository } from "../monitoringTemplateRepository";
import type { MonitoringTemplateRow } from "../../riskMonitoringTypes";

jest.mock("#helpers/index", () => ({
	db: {},
	logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() }
}));
jest.mock("../monitoringTemplateRepository", () => ({
	TemplateRepository: {
		listByCustomer: jest.fn(),
		getByIdAndCustomer: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		clearOtherDefaultsForCustomer: jest.fn(),
		getActiveTemplateIdByCustomerAndPriority: jest.fn(),
		getIntegrationGroupsByTemplateId: jest.fn(),
		replaceIntegrationGroups: jest.fn(),
		getRuleIdsByTemplateId: jest.fn(),
		replaceRules: jest.fn(),
		setIntegrationGroupsAndRules: jest.fn(),
		upsertBusinessTemplate: jest.fn(),
		getBusinessTemplate: jest.fn(),
		getLastRunAtByTemplateId: jest.fn(),
		getBusinessCountByTemplateId: jest.fn()
	}
}));

const mockTemplateRepo = TemplateRepository as unknown as jest.Mocked<TemplateRepository>;

const customerID = "11111111-1111-1111-1111-111111111111" as UUID;
const templateID = "22222222-2222-2222-2222-222222222222" as UUID;
const userId = "33333333-3333-3333-3333-333333333333" as UUID;
const ruleId = "44444444-4444-4444-4444-444444444444" as UUID;
const otherTemplateID = "55555555-5555-5555-5555-555555555555" as UUID;

const baseRow: MonitoringTemplateRow = {
	id: templateID,
	customer_id: customerID,
	priority: 0,
	is_active: true,
	is_default: false,
	label: "Test Template",
	created_at: "2025-01-01T00:00:00Z",
	updated_at: "2025-01-01T00:00:00Z",
	created_by: userId,
	updated_by: userId
};

describe("TemplateService", () => {
	function createService() {
		return new MonitoringTemplateService(customerID, mockTemplateRepo);
	}

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("list", () => {
		it("returns records and total_items with relations", async () => {
			mockTemplateRepo.listByCustomer.mockResolvedValue([baseRow]);
			mockTemplateRepo.getIntegrationGroupsByTemplateId.mockResolvedValue([]);
			mockTemplateRepo.getRuleIdsByTemplateId.mockResolvedValue([]);
			mockTemplateRepo.getLastRunAtByTemplateId.mockResolvedValue(null);
			mockTemplateRepo.getBusinessCountByTemplateId.mockResolvedValue(2);

			const result = await createService().list();

			expect(result.records).toHaveLength(1);
			expect(result.total_items).toBe(1);
			expect(result.records[0]).toMatchObject(baseRow);
			expect(result.records[0].integration_groups).toEqual([]);
			expect(result.records[0].rule_ids).toEqual([]);
			expect(result.records[0].last_run_at).toBeNull();
			expect(result.records[0].business_count).toBe(2);
			expect(mockTemplateRepo.listByCustomer).toHaveBeenCalledWith(customerID);
		});
	});

	describe("get", () => {
		it("returns template with relations when found", async () => {
			mockTemplateRepo.getByIdAndCustomer.mockResolvedValue(baseRow);
			mockTemplateRepo.getIntegrationGroupsByTemplateId.mockResolvedValue([
				{ integration_group: 1, cadence: "WEEKLY" }
			]);
			mockTemplateRepo.getRuleIdsByTemplateId.mockResolvedValue([ruleId]);
			mockTemplateRepo.getLastRunAtByTemplateId.mockResolvedValue("2025-01-02T00:00:00Z");
			mockTemplateRepo.getBusinessCountByTemplateId.mockResolvedValue(1);

			const result = await createService().get(templateID);

			expect(result).toMatchObject(baseRow);
			expect(result.integration_groups).toEqual([{ integration_group: 1, cadence: "WEEKLY" }]);
			expect(result.rule_ids).toEqual([ruleId]);
			expect(result.last_run_at).toBe("2025-01-02T00:00:00Z");
			expect(result.business_count).toBe(1);
		});

		it("throws NOT_FOUND when template does not exist", async () => {
			mockTemplateRepo.getByIdAndCustomer.mockResolvedValue(undefined);

			await expect(createService().get(templateID)).rejects.toThrow(RiskMonitoringApiError);
			await expect(createService().get(templateID)).rejects.toMatchObject({
				status: StatusCodes.NOT_FOUND,
				errorCode: ERROR_CODES.NOT_FOUND
			});
		});
	});

	describe("create", () => {
		const body = { label: "New Template" };

		it("creates template and returns with relations", async () => {
			mockTemplateRepo.clearOtherDefaultsForCustomer.mockResolvedValue(undefined);
			mockTemplateRepo.getActiveTemplateIdByCustomerAndPriority.mockResolvedValue(undefined);
			mockTemplateRepo.create.mockResolvedValue(baseRow);
			mockTemplateRepo.setIntegrationGroupsAndRules.mockResolvedValue(undefined);

			const result = await createService().create(body, userId);

			expect(result).toMatchObject(baseRow);
			expect(result.last_run_at).toBeNull();
			expect(result.business_count).toBe(0);
			expect(mockTemplateRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					customer_id: customerID,
					label: body.label,
					priority: 0,
					is_active: true,
					is_default: false,
					created_by: userId,
					updated_by: userId
				})
			);
		});

		it("clears other defaults when is_default is true", async () => {
			mockTemplateRepo.clearOtherDefaultsForCustomer.mockResolvedValue(undefined);
			mockTemplateRepo.getActiveTemplateIdByCustomerAndPriority.mockResolvedValue(undefined);
			mockTemplateRepo.create.mockResolvedValue({ ...baseRow, is_default: true });
			mockTemplateRepo.setIntegrationGroupsAndRules.mockResolvedValue(undefined);

			await createService().create({ ...body, is_default: true }, userId);

			expect(mockTemplateRepo.clearOtherDefaultsForCustomer).toHaveBeenCalledWith(customerID);
		});

		it("throws CONFLICT when another active template has same priority", async () => {
			mockTemplateRepo.clearOtherDefaultsForCustomer.mockResolvedValue(undefined);
			mockTemplateRepo.getActiveTemplateIdByCustomerAndPriority.mockResolvedValue(otherTemplateID);

			await expect(createService().create({ ...body, priority: 1 }, userId)).rejects.toThrow(RiskMonitoringApiError);
			await expect(createService().create({ ...body, priority: 1 }, userId)).rejects.toMatchObject({
				status: StatusCodes.CONFLICT,
				errorCode: ERROR_CODES.INVALID
			});
			expect(mockTemplateRepo.create).not.toHaveBeenCalled();
		});

		it("throws when repository.create returns undefined", async () => {
			mockTemplateRepo.clearOtherDefaultsForCustomer.mockResolvedValue(undefined);
			mockTemplateRepo.getActiveTemplateIdByCustomerAndPriority.mockResolvedValue(undefined);
			mockTemplateRepo.create.mockResolvedValue(undefined as any);

			await expect(createService().create(body, userId)).rejects.toThrow(RiskMonitoringApiError);
			await expect(createService().create(body, userId)).rejects.toMatchObject({
				status: StatusCodes.INTERNAL_SERVER_ERROR
			});
		});
	});

	describe("update", () => {
		it("updates template and returns get result", async () => {
			const updatedRow = { ...baseRow, label: "Updated Label" };
			mockTemplateRepo.getByIdAndCustomer.mockResolvedValueOnce(baseRow).mockResolvedValueOnce(updatedRow);
			mockTemplateRepo.getIntegrationGroupsByTemplateId.mockResolvedValue([]);
			mockTemplateRepo.getRuleIdsByTemplateId.mockResolvedValue([]);
			mockTemplateRepo.getLastRunAtByTemplateId.mockResolvedValue(null);
			mockTemplateRepo.getBusinessCountByTemplateId.mockResolvedValue(0);
			mockTemplateRepo.clearOtherDefaultsForCustomer.mockResolvedValue(undefined);
			mockTemplateRepo.getActiveTemplateIdByCustomerAndPriority.mockResolvedValue(undefined);
			mockTemplateRepo.update.mockResolvedValue(updatedRow);

			const result = await createService().update(templateID, { label: "Updated Label" }, userId);

			expect(result.label).toBe("Updated Label");
			expect(mockTemplateRepo.update).toHaveBeenCalledWith(
				templateID,
				customerID,
				expect.objectContaining({ label: "Updated Label", updated_by: userId })
			);
		});

		it("throws NOT_FOUND when update returns undefined", async () => {
			mockTemplateRepo.getByIdAndCustomer.mockResolvedValue(baseRow);
			mockTemplateRepo.getIntegrationGroupsByTemplateId.mockResolvedValue([]);
			mockTemplateRepo.getRuleIdsByTemplateId.mockResolvedValue([]);
			mockTemplateRepo.getLastRunAtByTemplateId.mockResolvedValue(null);
			mockTemplateRepo.getBusinessCountByTemplateId.mockResolvedValue(0);
			mockTemplateRepo.clearOtherDefaultsForCustomer.mockResolvedValue(undefined);
			mockTemplateRepo.getActiveTemplateIdByCustomerAndPriority.mockResolvedValue(undefined);
			mockTemplateRepo.update.mockResolvedValue(undefined);

			await expect(createService().update(templateID, { label: "X" }, userId)).rejects.toMatchObject({
				status: StatusCodes.NOT_FOUND,
				errorCode: ERROR_CODES.NOT_FOUND
			});
		});

		it("throws CONFLICT when another active template has same priority", async () => {
			mockTemplateRepo.getByIdAndCustomer.mockResolvedValue(baseRow);
			mockTemplateRepo.getIntegrationGroupsByTemplateId.mockResolvedValue([]);
			mockTemplateRepo.getRuleIdsByTemplateId.mockResolvedValue([]);
			mockTemplateRepo.getLastRunAtByTemplateId.mockResolvedValue(null);
			mockTemplateRepo.getBusinessCountByTemplateId.mockResolvedValue(0);
			mockTemplateRepo.clearOtherDefaultsForCustomer.mockResolvedValue(undefined);
			mockTemplateRepo.getActiveTemplateIdByCustomerAndPriority.mockResolvedValue(otherTemplateID);

			await expect(createService().update(templateID, { priority: 5 }, userId)).rejects.toMatchObject({
				status: StatusCodes.CONFLICT,
				errorCode: ERROR_CODES.INVALID
			});
			expect(mockTemplateRepo.update).not.toHaveBeenCalled();
		});
	});

	describe("delete", () => {
		it("returns deleted true and id when template exists", async () => {
			mockTemplateRepo.delete.mockResolvedValue(true);

			const result = await createService().delete(templateID);

			expect(result).toEqual({ deleted: true, id: templateID });
			expect(mockTemplateRepo.delete).toHaveBeenCalledWith(templateID, customerID);
		});

		it("throws NOT_FOUND when template does not exist", async () => {
			mockTemplateRepo.delete.mockResolvedValue(false);

			await expect(createService().delete(templateID)).rejects.toThrow(RiskMonitoringApiError);
			await expect(createService().delete(templateID)).rejects.toMatchObject({
				status: StatusCodes.NOT_FOUND,
				errorCode: ERROR_CODES.NOT_FOUND
			});
		});
	});
});
