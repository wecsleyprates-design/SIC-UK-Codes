import type { UUID } from "crypto";
import { createController } from "../../controller";
import type { RiskMonitoringContainer } from "../../container";
import { TemplateRepository } from "../../monitoringTemplate/monitoringTemplateRepository";
import { MonitoringRunRepository } from "../../monitoringRun/monitoringRunRepository";
import { RiskCategoryRepository } from "../../riskCategory/riskCategoryRepository";
import { RiskBucketRepository } from "../../riskBucket/riskBucketRepository";
import { RiskAlertRepository } from "../../riskAlert/riskAlertRepository";

jest.mock("#helpers/index", () => ({
	db: {},
	logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() }
}));

const customerID = "11111111-1111-1111-1111-111111111111" as UUID;
const businessID = "22222222-2222-2222-2222-222222222222" as UUID;
const templateID = "33333333-3333-3333-3333-333333333333" as UUID;

const mockTemplateRepo = {
	listByCustomer: jest.fn(),
	getByIdAndCustomer: jest.fn(),
	upsertBusinessTemplate: jest.fn(),
	getBusinessTemplate: jest.fn(),
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

function mockReqRes(overrides: { params?: Record<string, string>; body?: Record<string, unknown> } = {}) {
	const req = {
		params: overrides.params ?? {},
		body: overrides.body ?? {}
	} as any;
	const res = {
		jsend: { success: jest.fn() }
	} as any;
	const next = jest.fn();
	return { req, res, next };
}

describe("BusinessTemplateController", () => {
	const controller = createController(mockContainer);

	beforeEach(() => {
		jest.clearAllMocks();
		mockTemplateRepo.getByIdAndCustomer.mockResolvedValue(undefined);
		mockTemplateRepo.upsertBusinessTemplate.mockResolvedValue(undefined);
		mockTemplateRepo.getBusinessTemplate.mockResolvedValue(undefined);
		mockTemplateRepo.getIntegrationGroupsByTemplateId.mockResolvedValue([]);
		mockTemplateRepo.getRuleIdsByTemplateId.mockResolvedValue([]);
		mockTemplateRepo.getLastRunAtByTemplateId.mockResolvedValue(null);
		mockTemplateRepo.getBusinessCountByTemplateId.mockResolvedValue(0);
	});

	it("setBusinessTemplate constructs service with customerID and businessID, calls set(body), responds with success", async () => {
		const { req, res, next } = mockReqRes({
			params: { customerID, businessID },
			body: { template_id: templateID }
		});
		mockTemplateRepo.getByIdAndCustomer.mockResolvedValue({ id: templateID } as any);
		mockTemplateRepo.upsertBusinessTemplate.mockResolvedValue(undefined);

		controller.setBusinessTemplate(req, res, next);
		await new Promise(resolve => setImmediate(resolve));

		expect(mockTemplateRepo.getByIdAndCustomer).toHaveBeenCalledWith(templateID, customerID);
		expect(mockTemplateRepo.upsertBusinessTemplate).toHaveBeenCalledWith(businessID, customerID, templateID);
		expect(res.jsend.success).toHaveBeenCalledWith(
			{ business_id: businessID, customer_id: customerID, template_id: templateID },
			"Business monitoring template set successfully"
		);
	});

	it("getBusinessTemplate constructs service with customerID and businessID, calls get(), responds", async () => {
		const { req, res, next } = mockReqRes({
			params: { customerID, businessID }
		});
		mockTemplateRepo.getBusinessTemplate.mockResolvedValue({ template_id: templateID });

		controller.getBusinessTemplate(req, res, next);
		await new Promise(resolve => setImmediate(resolve));

		expect(mockTemplateRepo.getBusinessTemplate).toHaveBeenCalledWith(businessID, customerID);
		expect(res.jsend.success).toHaveBeenCalledWith(
			{ template_id: templateID },
			"Business monitoring template retrieved successfully"
		);
	});
});
