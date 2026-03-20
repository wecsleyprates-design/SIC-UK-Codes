import type { UUID } from "crypto";
import { createController } from "../../controller";
import type { RiskMonitoringContainer } from "../../container";
import { TemplateRepository } from "../monitoringTemplateRepository";
import { MonitoringRunRepository } from "../../monitoringRun/monitoringRunRepository";
import { RiskCategoryRepository } from "../../riskCategory/riskCategoryRepository";
import { RiskBucketRepository } from "../../riskBucket/riskBucketRepository";
import { RiskAlertRepository } from "../../riskAlert/riskAlertRepository";

jest.mock("#helpers/index", () => ({
	db: {},
	logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() }
}));

const customerID = "11111111-1111-1111-1111-111111111111" as UUID;
const templateID = "22222222-2222-2222-2222-222222222222" as UUID;
const userId = "33333333-3333-3333-3333-333333333333" as UUID;

const mockTemplateRepo = {
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
};

const mockContainer: RiskMonitoringContainer = {
	db: {} as RiskMonitoringContainer["db"],
	templateRepository: mockTemplateRepo as unknown as TemplateRepository,
	runRepository: {} as MonitoringRunRepository,
	riskCategoryRepository: {} as RiskCategoryRepository,
	riskBucketRepository: {} as RiskBucketRepository,
	riskAlertRepository: {} as RiskAlertRepository
};

function mockReqRes(
	overrides: { params?: Record<string, string>; body?: Record<string, unknown>; locals?: Record<string, unknown> } = {}
) {
	const req = {
		params: overrides.params ?? {},
		body: overrides.body ?? {}
	} as any;
	const res = {
		locals: overrides.locals ?? {},
		jsend: { success: jest.fn() }
	} as any;
	const next = jest.fn();
	return { req, res, next };
}

describe("TemplateController", () => {
	const controller = createController(mockContainer);

	beforeEach(() => {
		jest.clearAllMocks();
		// Restore default mock implementations so handlers don't throw
		mockTemplateRepo.listByCustomer.mockResolvedValue([]);
		mockTemplateRepo.getByIdAndCustomer.mockResolvedValue(undefined);
		mockTemplateRepo.getIntegrationGroupsByTemplateId.mockResolvedValue([]);
		mockTemplateRepo.getRuleIdsByTemplateId.mockResolvedValue([]);
		mockTemplateRepo.getLastRunAtByTemplateId.mockResolvedValue(null);
		mockTemplateRepo.getBusinessCountByTemplateId.mockResolvedValue(0);
	});

	it("listTemplates calls service and responds with success", async () => {
		const { req, res, next } = mockReqRes({
			params: { customerID }
		});
		mockTemplateRepo.listByCustomer.mockResolvedValue([]);

		controller.listTemplates(req, res, next);
		await new Promise((resolve) => setImmediate(resolve));

		expect(mockTemplateRepo.listByCustomer).toHaveBeenCalledWith(customerID);
		expect(res.jsend.success).toHaveBeenCalledWith(
			expect.objectContaining({ records: [], total_items: 0 }),
			"Monitoring templates listed successfully"
		);
	});

	it("createTemplate requires userId and calls service", async () => {
		const { req, res, next } = mockReqRes({
			params: { customerID },
			body: { label: "New" },
			locals: { user: { user_id: userId } }
		});
		mockTemplateRepo.clearOtherDefaultsForCustomer.mockResolvedValue(undefined);
		mockTemplateRepo.getActiveTemplateIdByCustomerAndPriority.mockResolvedValue(undefined);
		mockTemplateRepo.create.mockResolvedValue({
			id: templateID,
			customer_id: customerID,
			label: "New",
			priority: 0,
			is_active: true,
			is_default: false,
			created_at: "",
			updated_at: "",
			created_by: userId,
			updated_by: userId
		} as any);
		mockTemplateRepo.setIntegrationGroupsAndRules.mockResolvedValue(undefined);

		controller.createTemplate(req, res, next);
		await new Promise((resolve) => setImmediate(resolve));

		expect(mockTemplateRepo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				customer_id: customerID,
				label: "New",
				created_by: userId,
				updated_by: userId
			})
		);
		expect(res.jsend.success).toHaveBeenCalledWith(
			expect.objectContaining({ id: templateID, label: "New" }),
			"Monitoring template created successfully"
		);
	});

	it("createTemplate throws when user not authenticated", async () => {
		const { req, res, next } = mockReqRes({
			params: { customerID },
			body: { label: "New" },
			locals: {}
		});

		controller.createTemplate(req, res, next);
		await new Promise((resolve) => setImmediate(resolve));
		expect(next).toHaveBeenCalledWith(expect.any(Error));
		expect(mockTemplateRepo.create).not.toHaveBeenCalled();
	});

	it("getTemplate calls service with params", async () => {
		const { req, res, next } = mockReqRes({
			params: { customerID, templateID }
		});
		mockTemplateRepo.getByIdAndCustomer.mockResolvedValue({ id: templateID } as any);
		mockTemplateRepo.getIntegrationGroupsByTemplateId.mockResolvedValue([]);
		mockTemplateRepo.getRuleIdsByTemplateId.mockResolvedValue([]);
		mockTemplateRepo.getLastRunAtByTemplateId.mockResolvedValue(null);
		mockTemplateRepo.getBusinessCountByTemplateId.mockResolvedValue(0);

		controller.getTemplate(req, res, next);
		await new Promise((resolve) => setImmediate(resolve));

		expect(mockTemplateRepo.getByIdAndCustomer).toHaveBeenCalledWith(templateID, customerID);
		expect(res.jsend.success).toHaveBeenCalledWith(
			expect.objectContaining({ id: templateID }),
			"Monitoring template retrieved successfully"
		);
	});

	it("updateTemplate requires userId and calls service", async () => {
		const { req, res, next } = mockReqRes({
			params: { customerID, templateID },
			body: { label: "Updated" },
			locals: { user: { user_id: userId } }
		});
		const existingRow = {
			id: templateID,
			label: "Old",
			priority: 0,
			is_active: true,
			is_default: false
		} as any;
		const updatedRow = { ...existingRow, label: "Updated" };
		mockTemplateRepo.getByIdAndCustomer.mockResolvedValueOnce(existingRow).mockResolvedValueOnce(updatedRow);
		mockTemplateRepo.getIntegrationGroupsByTemplateId.mockResolvedValue([]);
		mockTemplateRepo.getRuleIdsByTemplateId.mockResolvedValue([]);
		mockTemplateRepo.getLastRunAtByTemplateId.mockResolvedValue(null);
		mockTemplateRepo.getBusinessCountByTemplateId.mockResolvedValue(0);
		mockTemplateRepo.clearOtherDefaultsForCustomer.mockResolvedValue(undefined);
		mockTemplateRepo.getActiveTemplateIdByCustomerAndPriority.mockResolvedValue(undefined);
		mockTemplateRepo.update.mockResolvedValue(updatedRow);

		controller.updateTemplate(req, res, next);
		await new Promise((resolve) => setImmediate(resolve));

		expect(mockTemplateRepo.update).toHaveBeenCalledWith(
			templateID,
			customerID,
			expect.objectContaining({ label: "Updated", updated_by: userId })
		);
		expect(res.jsend.success).toHaveBeenCalledWith(
			expect.objectContaining({ id: templateID, label: "Updated" }),
			"Monitoring template updated successfully"
		);
	});

	it("deleteTemplate calls service and responds", async () => {
		const { req, res, next } = mockReqRes({
			params: { customerID, templateID }
		});
		mockTemplateRepo.getByIdAndCustomer.mockResolvedValue({
			id: templateID,
			is_default: false
		} as any);
		mockTemplateRepo.getIntegrationGroupsByTemplateId.mockResolvedValue([]);
		mockTemplateRepo.getRuleIdsByTemplateId.mockResolvedValue([]);
		mockTemplateRepo.getLastRunAtByTemplateId.mockResolvedValue(null);
		mockTemplateRepo.getBusinessCountByTemplateId.mockResolvedValue(0);
		mockTemplateRepo.delete.mockResolvedValue(true);

		controller.deleteTemplate(req, res, next);
		await new Promise((resolve) => setImmediate(resolve));

		expect(mockTemplateRepo.delete).toHaveBeenCalledWith(templateID, customerID);
		expect(res.jsend.success).toHaveBeenCalledWith(
			{ deleted: true, id: templateID },
			"Monitoring template deleted successfully"
		);
	});
});
