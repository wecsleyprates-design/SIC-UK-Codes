import {
	ADMIN_UUID,
	CASE_STATUS,
	INTEGRATION_CATEGORIES,
	kafkaEvents,
	kafkaTopics,
	WEBHOOK_EVENTS
} from "#constants/index";
import { db, getFlagValue, logger, producer, redis, sqlQuery, sqlTransaction } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { caseEventsHandler } from "../cases";
import { businesses } from "../../../../../api/v1/modules/businesses/businesses";
import { caseManagementService } from "../../../../../api/v1/modules/case-management/case-management";
import { sendKafkaEventForSection, sendWebhookEvent, triggerSectionCompletedKafkaEventWithRedis } from "#common/index";

// Mock all dependencies
jest.mock("#helpers/index", () => {
	const originalHelpers = jest.requireActual("#helpers/index");
	return {
		...originalHelpers,
		sqlQuery: jest.fn(),
		sqlTransaction: jest.fn(),
		producer: {
			send: jest.fn()
		},
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn()
		},
		db: jest.fn(() => ({
			leftJoin: jest.fn().mockReturnThis(),
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			first: jest.fn()
		})) as jest.Mock,
		redis: {
			get: jest.fn(),
			set: jest.fn(),
			del: jest.fn()
		},
		getFlagValue: jest.fn()
	};
});

jest.mock("#middlewares/index", () => ({
	validateMessage: jest.fn()
}));

jest.mock("../../../../../api/v1/modules/businesses/businesses", () => ({
	businesses: {
		getCustomerByCaseId: jest.fn()
	}
}));

jest.mock("../../../../../api/v1/modules/case-management/case-management", () => ({
	caseManagementService: {
		ensureCasesExist: jest.fn()
	}
}));

jest.mock("#common/index", () => ({
	sendKafkaEventForSection: jest.fn(),
	sendWebhookEvent: jest.fn(),
	triggerSectionCompletedKafkaEventWithRedis: jest.fn()
}));

jest.mock("#core/case", () => ({
	caseManager: {
		updateCaseAttribute: jest.fn()
	}
}));

jest.mock("#configs/index", () => ({
	envConfig: {
		ENTERPRISE_APPLICANT_ID: "123e4567-e89b-12d3-a456-426614174000",
		USERS: "worth.users.v1",
		BUSINESS: "business.v1",
		CASES: "cases.v1",
		NOTIFICATIONS: "notifications.v1"
	}
}));

describe("CaseEventsHandler", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("shouldSkipStatusUpdate", () => {
		it("should return true when current status is in skip statuses", () => {
			const currentStatus = CASE_STATUS.AUTO_APPROVED;
			const skipStatuses = [CASE_STATUS.AUTO_APPROVED, CASE_STATUS.AUTO_REJECTED];

			const result = caseEventsHandler.shouldSkipStatusUpdate(currentStatus, skipStatuses);

			expect(result).toBe(true);
		});

		it("should return false when current status is not in skip statuses", () => {
			const currentStatus = CASE_STATUS.ONBOARDING;
			const skipStatuses = [CASE_STATUS.AUTO_APPROVED, CASE_STATUS.AUTO_REJECTED];

			const result = caseEventsHandler.shouldSkipStatusUpdate(currentStatus, skipStatuses);

			expect(result).toBe(false);
		});
	});

	describe("updateCaseStatus", () => {
		const mockBody = {
			status: CASE_STATUS.ONBOARDING,
			user_id: "123e4567-e89b-12d3-a456-426614174000",
			case_id: "123e4567-e89b-12d3-a456-426614174001"
		};

		it("should update case status when not in skip statuses", async () => {
			const mockCurrentStatus = { rows: [{ status: CASE_STATUS.ONBOARDING }] };
			(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCurrentStatus);
			(sqlTransaction as jest.Mock).mockResolvedValueOnce(undefined);

			await caseEventsHandler.updateCaseStatus(mockBody);

			expect(sqlQuery).toHaveBeenCalledWith({
				sql: `SELECT data_cases.*, db.id as business_id, db.name as business_name
				FROM data_cases
				LEFT JOIN data_businesses db ON db.id = data_cases.business_id 
				WHERE data_cases.id = $1 AND db.is_deleted = false`,
				values: [mockBody.case_id]
			});
			expect(sqlTransaction).toHaveBeenCalledWith(
				[
					"UPDATE data_cases SET status = $1, updated_by = $2 WHERE id = $3",
					"INSERT INTO data_case_status_history\n\t\t\t(case_id, status, created_by)\n\t\t\tVALUES($1, $2, $3)"
				],
				[
					[mockBody.status, mockBody.user_id, mockBody.case_id],
					[mockBody.case_id, mockBody.status, mockBody.user_id]
				]
			);
		});

		it("should skip update when case is in skip statuses", async () => {
			const mockCurrentStatus = { rows: [{ status: CASE_STATUS.AUTO_APPROVED }] };
			(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCurrentStatus);

			await caseEventsHandler.updateCaseStatus(mockBody);

			expect(sqlQuery).toHaveBeenCalledWith({
				sql: `SELECT data_cases.*, db.id as business_id, db.name as business_name
				FROM data_cases
				LEFT JOIN data_businesses db ON db.id = data_cases.business_id 
				WHERE data_cases.id = $1 AND db.is_deleted = false`,
				values: [mockBody.case_id]
			});
			expect(sqlTransaction).not.toHaveBeenCalled();
			expect(logger.info).toHaveBeenCalledWith(
				`Case with id: ${mockBody.case_id} is already in ${CASE_STATUS.AUTO_APPROVED} status`
			);
		});

		it("should handle database errors", async () => {
			const mockError = new Error("Database error");
			(sqlQuery as jest.Mock).mockRejectedValueOnce(mockError);

			await expect(caseEventsHandler.updateCaseStatus(mockBody)).rejects.toThrow(mockError);
			expect(logger.error).toHaveBeenCalledWith(
				{ error: mockError },
				`Error updating case status for case_id: ${mockBody.case_id}`
			);
		});
	});

	describe("createCase", () => {
		const mockBody = {
			business_id: "123e4567-e89b-12d3-a456-426614174000",
			applicant_id: "123e4567-e89b-12d3-a456-426614174001",
			customer_id: "123e4567-e89b-12d3-a456-426614174002"
		};

		it("should call caseManagementService.ensureCasesExist", async () => {
			const mockResult = { success: true };
			(caseManagementService.ensureCasesExist as jest.Mock).mockResolvedValueOnce(mockResult);

			const result = await caseEventsHandler.createCase(mockBody as any);

			expect(caseManagementService.ensureCasesExist).toHaveBeenCalledWith(mockBody.business_id, {
				applicantID: mockBody.applicant_id,
				customerID: mockBody.customer_id
			});
			expect(result).toBe(mockResult);
		});
	});

	describe("createRiskAlertCase", () => {
		const mockBody = {
			business_id: "123e4567-e89b-12d3-a456-426614174000",
			customer_id: "123e4567-e89b-12d3-a456-426614174001",
			risk_alert_id: "123e4567-e89b-12d3-a456-426614174002",
			score_trigger_id: "123e4567-e89b-12d3-a456-426614174003",
			risk_alert_subtype: "integration_failure"
		};

		it("should create new risk alert case when no existing case", async () => {
			const mockCaseStatus = { rows: [{ id: 1 }] };
			const mockGetRelRiskCase = { rows: [] };
			const mockApplicant = { rows: [{ id: "123e4567-e89b-12d3-a456-426614174004" }] };
			const mockCaseTypes = { rows: [{ id: 2 }] };

			(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCaseStatus).mockResolvedValueOnce(mockGetRelRiskCase);

			(sqlTransaction as jest.Mock)
				.mockResolvedValueOnce([mockApplicant, mockCaseTypes])
				.mockResolvedValueOnce([undefined, undefined, undefined]);

			(producer.send as jest.Mock).mockResolvedValueOnce(undefined);

			await caseEventsHandler.createRiskAlertCase(mockBody);

			expect(sqlQuery).toHaveBeenCalledTimes(2);
			expect(sqlTransaction).toHaveBeenCalledTimes(2);
			expect(producer.send).toHaveBeenCalledWith({
				topic: kafkaTopics.CASES,
				messages: [
					{
						key: mockBody.business_id,
						value: expect.objectContaining({
							event: kafkaEvents.CREATE_CASE_FOR_A_RISK_ALERT_REQUEST,
							business_id: mockBody.business_id
						})
					}
				]
			});
		});

		it("should insert rel_risk_case when existing case found", async () => {
			const mockCaseStatus = { rows: [{ id: 1 }] };
			const mockGetRelRiskCase = { rows: [{ case_id: "123e4567-e89b-12d3-a456-426614174005" }] };

			(sqlQuery as jest.Mock)
				.mockResolvedValueOnce(mockCaseStatus)
				.mockResolvedValueOnce(mockGetRelRiskCase)
				.mockResolvedValueOnce(undefined);

			await caseEventsHandler.createRiskAlertCase(mockBody);

			expect(sqlQuery).toHaveBeenCalledTimes(3);
			expect(sqlQuery).toHaveBeenNthCalledWith(3, {
				sql: "INSERT INTO rel_risk_cases (case_id, risk_alert_id, score_trigger_id) VALUES($1, $2, $3)",
				values: ["123e4567-e89b-12d3-a456-426614174005", mockBody.risk_alert_id, mockBody.score_trigger_id]
			});
		});

		it("should handle errors gracefully", async () => {
			const mockError = new Error("Risk alert creation error");
			(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockRejectedValueOnce(mockError);

			await expect(caseEventsHandler.createRiskAlertCase(mockBody)).rejects.toThrow(mockError);
			expect(logger.error).toHaveBeenCalledWith(
				`RISK ALERT: Error creating risk alert case for business_id: ${mockBody.business_id} and risk_alert_id: ${mockBody.risk_alert_id}, error: ${mockError}`
			);
		});
	});

	describe("integrationTaskFailed", () => {
		const mockPayload = {
			case_id: "123e4567-e89b-12d3-a456-426614174000",
			integration_category: "banking"
		};

		it("should handle integration task failure", async () => {
			const mockCaseWithBusiness = {
				status: CASE_STATUS.ONBOARDING,
				business_id: "123e4567-e89b-12d3-a456-426614174001",
				business_name: "Test Business"
			};

			(db as unknown as jest.Mock).mockReturnValue({
				leftJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValueOnce(mockCaseWithBusiness)
			});

			(producer.send as jest.Mock).mockResolvedValueOnce(undefined);
			(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ status: CASE_STATUS.ONBOARDING }] });
			(sqlTransaction as jest.Mock).mockResolvedValueOnce(undefined);
			(businesses.getCustomerByCaseId as jest.Mock).mockResolvedValueOnce("123e4567-e89b-12d3-a456-426614174002");
			(sendWebhookEvent as jest.Mock).mockResolvedValueOnce(undefined);

			await caseEventsHandler.integrationTaskFailed(mockPayload);

			expect(producer.send).toHaveBeenCalledWith({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: mockCaseWithBusiness.business_id,
						value: {
							event: kafkaEvents.INTEGRATION_FAILED_AUDIT,
							case_id: mockPayload.case_id,
							integration_category: mockPayload.integration_category,
							business_id: mockCaseWithBusiness.business_id
						}
					}
				]
			});
			expect(sendWebhookEvent).toHaveBeenCalledWith(
				"123e4567-e89b-12d3-a456-426614174002",
				WEBHOOK_EVENTS.INTEGRATION_FAILED,
				expect.objectContaining({
					...mockPayload,
					status: "FAILED",
					business_id: mockCaseWithBusiness.business_id,
					business_name: mockCaseWithBusiness.business_name
				})
			);
		});
	});

	describe("sectionCompleted", () => {
		const mockPayload = {
			business_id: "123e4567-e89b-12d3-a456-426614174000",
			section_name: "Accounting",
			user_id: "123e4567-e89b-12d3-a456-426614174001",
			customer_id: "123e4567-e89b-12d3-a456-426614174002"
		};

		it("should call sendKafkaEventForSection for direct trigger sections", async () => {
			(sendKafkaEventForSection as jest.Mock).mockResolvedValueOnce(undefined);

			await caseEventsHandler.sectionCompleted(mockPayload as any);

			expect(sendKafkaEventForSection).toHaveBeenCalledWith(
				mockPayload.business_id,
				mockPayload.section_name,
				mockPayload.user_id,
				mockPayload.customer_id
			);
			expect(triggerSectionCompletedKafkaEventWithRedis).not.toHaveBeenCalled();
		});

		it("should call triggerSectionCompletedKafkaEventWithRedis for other sections", async () => {
			const otherSectionPayload = {
				...mockPayload,
				section_name: "Other Section"
			};

			(triggerSectionCompletedKafkaEventWithRedis as jest.Mock).mockResolvedValueOnce(undefined);

			await caseEventsHandler.sectionCompleted(otherSectionPayload as any);

			expect(triggerSectionCompletedKafkaEventWithRedis).toHaveBeenCalledWith(
				otherSectionPayload.business_id,
				otherSectionPayload.section_name,
				otherSectionPayload.user_id,
				otherSectionPayload.customer_id,
				redis
			);
			expect(sendKafkaEventForSection).not.toHaveBeenCalled();
		});
	});

	describe("bankAccountVerificationFailed", () => {
		const mockPayload = {
			case_id: "123e4567-e89b-12d3-a456-426614174000",
			reason: "Invalid account number"
		};
		const mockCaseWithBusiness = {
			status: CASE_STATUS.ONBOARDING,
			business_id: "123e4567-e89b-12d3-a456-426614174001",
			business_name: "Test Business"
		};

		it("should handle bank account verification failure", async () => {
			(db as unknown as jest.Mock).mockReturnValue({
				leftJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValueOnce(mockCaseWithBusiness)
			});

			(producer.send as jest.Mock).mockResolvedValueOnce(undefined);
			(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ status: CASE_STATUS.ONBOARDING }] });
			(sqlTransaction as jest.Mock).mockResolvedValueOnce(undefined);
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			await caseEventsHandler.bankAccountVerificationFailed(mockPayload as any);

			expect(producer.send).toHaveBeenCalledWith({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: mockCaseWithBusiness.business_id,
						value: {
							event: kafkaEvents.INTEGRATION_FAILED_AUDIT,
							case_id: mockPayload.case_id,
							integration_category: INTEGRATION_CATEGORIES.BANKING,
							business_id: mockCaseWithBusiness.business_id
						}
					}
				]
			});
			expect(logger.info).toHaveBeenCalledWith(
				`Bank account verification event received for case: ${mockPayload.case_id}. Cause: ${mockPayload.reason}. Case status updated to UNDER_MANUAL_REVIEW`
			);
		});

		it("should not update case status when flag is enabled", async () => {
			(db as unknown as jest.Mock).mockReturnValue({
				leftJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValueOnce(mockCaseWithBusiness)
			});

			(producer.send as jest.Mock).mockResolvedValueOnce(undefined);
			(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ status: CASE_STATUS.ONBOARDING }] });
			(sqlTransaction as jest.Mock).mockResolvedValueOnce(undefined);
			(getFlagValue as jest.Mock).mockResolvedValueOnce(true);
			await caseEventsHandler.bankAccountVerificationFailed(mockPayload as any);

			expect(producer.send).toHaveBeenCalledWith({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: mockCaseWithBusiness.business_id,
						value: {
							event: kafkaEvents.INTEGRATION_FAILED_AUDIT,
							case_id: mockPayload.case_id,
							integration_category: INTEGRATION_CATEGORIES.BANKING,
							business_id: mockCaseWithBusiness.business_id
						}
					}
				]
			});
			expect(logger.info).toHaveBeenCalledWith(
				`Bank account verification event received for case: ${mockPayload.case_id}. Cause: ${mockPayload.reason}.`
			);
		});
	});

	describe("handleEvent", () => {
		it("should handle APPLICANT_ONBOARDED event", async () => {
			const eventMessage = {
				key: Buffer.from(kafkaEvents.APPLICANT_ONBOARDED),
				value: Buffer.from(
					JSON.stringify({
						user_id: "123e4567-e89b-12d3-a456-426614174000",
						case_id: "123e4567-e89b-12d3-a456-426614174001",
						status: 1
					})
				)
			};

			(validateMessage as jest.Mock).mockReturnValueOnce(undefined);
			(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ status: CASE_STATUS.ONBOARDING }] });
			(sqlTransaction as jest.Mock).mockResolvedValueOnce(undefined);

			await caseEventsHandler.handleEvent(eventMessage);

			expect(validateMessage).toHaveBeenCalled();
		});

		it("should handle CREATE_CASE_REQUEST event", async () => {
			const eventMessage = {
				key: Buffer.from(kafkaEvents.CREATE_CASE_REQUEST),
				value: Buffer.from(
					JSON.stringify({
						business_id: "123e4567-e89b-12d3-a456-426614174000",
						applicant_id: "123e4567-e89b-12d3-a456-426614174001",
						customer_id: "123e4567-e89b-12d3-a456-426614174002"
					})
				)
			};

			(validateMessage as jest.Mock).mockReturnValueOnce(undefined);
			(caseManagementService.ensureCasesExist as jest.Mock).mockResolvedValueOnce({ success: true });

			await caseEventsHandler.handleEvent(eventMessage);

			expect(validateMessage).toHaveBeenCalled();
			expect(caseManagementService.ensureCasesExist).toHaveBeenCalled();
		});

		it("should handle INTEGRATION_TASK_FAILED event", async () => {
			const eventMessage = {
				key: Buffer.from(kafkaEvents.INTEGRATION_TASK_FAILED),
				value: Buffer.from(
					JSON.stringify({ case_id: "123e4567-e89b-12d3-a456-426614174000", integration_category: "banking" })
				)
			};

			(validateMessage as jest.Mock).mockReturnValueOnce(undefined);
			(db as unknown as jest.Mock).mockReturnValue({
				leftJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValueOnce({
					business_id: "123e4567-e89b-12d3-a456-426614174001",
					business_name: "Test Business"
				})
			});
			(producer.send as jest.Mock).mockResolvedValueOnce(undefined);
			(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ status: CASE_STATUS.ONBOARDING }] });
			(sqlTransaction as jest.Mock).mockResolvedValueOnce(undefined);
			(businesses.getCustomerByCaseId as jest.Mock).mockResolvedValueOnce(null);

			await caseEventsHandler.handleEvent(eventMessage);

			expect(validateMessage).toHaveBeenCalled();
		});

		it("should handle CREATE_RISK_ALERT_CASE event", async () => {
			const eventMessage = {
				key: Buffer.from(kafkaEvents.CREATE_RISK_ALERT_CASE),
				value: Buffer.from(
					JSON.stringify({
						business_id: "123e4567-e89b-12d3-a456-426614174000",
						customer_id: "123e4567-e89b-12d3-a456-426614174001",
						risk_alert_id: "123e4567-e89b-12d3-a456-426614174002",
						score_trigger_id: "123e4567-e89b-12d3-a456-426614174003",
						risk_alert_subtype: "integration_failure"
					})
				)
			};

			(validateMessage as jest.Mock).mockReturnValueOnce(undefined);
			(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [] });
			(sqlTransaction as jest.Mock)
				.mockResolvedValueOnce([{ rows: [{ id: "123e4567-e89b-12d3-a456-426614174004" }] }, { rows: [{ id: 2 }] }])
				.mockResolvedValueOnce([undefined, undefined, undefined]);
			(producer.send as jest.Mock).mockResolvedValueOnce(undefined);

			await caseEventsHandler.handleEvent(eventMessage);

			expect(validateMessage).toHaveBeenCalled();
		});

		it("should handle SECTION_COMPLETED event", async () => {
			const eventMessage = {
				key: Buffer.from(kafkaEvents.SECTION_COMPLETED),
				value: Buffer.from(
					JSON.stringify({
						business_id: "123e4567-e89b-12d3-a456-426614174000",
						section_name: "Accounting",
						user_id: "123e4567-e89b-12d3-a456-426614174001",
						customer_id: "123e4567-e89b-12d3-a456-426614174002"
					})
				)
			};

			(validateMessage as jest.Mock).mockReturnValueOnce(undefined);
			(sendKafkaEventForSection as jest.Mock).mockResolvedValueOnce(undefined);

			await caseEventsHandler.handleEvent(eventMessage);

			expect(validateMessage).toHaveBeenCalled();
			expect(sendKafkaEventForSection).toHaveBeenCalled();
		});

		it("should handle BANK_ACCOUNT_VERIFICATION_FAILED event", async () => {
			const eventMessage = {
				key: Buffer.from(kafkaEvents.BANK_ACCOUNT_VERIFICATION_FAILED),
				value: Buffer.from(
					JSON.stringify({ case_id: "123e4567-e89b-12d3-a456-426614174000", reason: "Invalid account" })
				)
			};

			(validateMessage as jest.Mock).mockReturnValueOnce(undefined);
			(db as unknown as jest.Mock).mockReturnValue({
				leftJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValueOnce({
					business_id: "123e4567-e89b-12d3-a456-426614174001",
					business_name: "Test Business"
				})
			});
			(producer.send as jest.Mock).mockResolvedValueOnce(undefined);
			(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ status: CASE_STATUS.ONBOARDING }] });
			(sqlTransaction as jest.Mock).mockResolvedValueOnce(undefined);

			await caseEventsHandler.handleEvent(eventMessage);

			expect(validateMessage).toHaveBeenCalled();
		});

		it("should handle WORKFLOW_CHANGE_ATTRIBUTE event", async () => {
			const eventMessage = {
				key: Buffer.from(kafkaEvents.WORKFLOW_CHANGE_ATTRIBUTE),
				value: Buffer.from(
					JSON.stringify({
						case_id: "123e4567-e89b-12d3-a456-426614174000",
						attribute_type: "status",
						attribute_value: 1
					})
				)
			};

			(validateMessage as jest.Mock).mockReturnValueOnce(undefined);
			const { caseManager } = require("#core/case");
			(caseManager.updateCaseAttribute as jest.Mock).mockResolvedValueOnce(undefined);

			await caseEventsHandler.handleEvent(eventMessage);

			expect(validateMessage).toHaveBeenCalled();
			expect(caseManager.updateCaseAttribute).toHaveBeenCalledWith({
				case_id: "123e4567-e89b-12d3-a456-426614174000",
				attribute_type: "status",
				attribute_value: 1,
				user_id: ADMIN_UUID
			});
		});

		it("should handle unknown event gracefully", async () => {
			const eventMessage = {
				key: Buffer.from("UNKNOWN_EVENT"),
				value: Buffer.from(JSON.stringify({ test: "data" }))
			};

			await expect(caseEventsHandler.handleEvent(eventMessage)).resolves.not.toThrow();
		});

		it("should handle errors and re-throw them", async () => {
			const eventMessage = {
				key: Buffer.from(kafkaEvents.CREATE_CASE_REQUEST),
				value: Buffer.from(
					JSON.stringify({
						business_id: "123e4567-e89b-12d3-a456-426614174000",
						applicant_id: "123e4567-e89b-12d3-a456-426614174001",
						customer_id: "123e4567-e89b-12d3-a456-426614174002"
					})
				)
			};

			const mockError = new Error("Test error");
			(validateMessage as jest.Mock).mockImplementationOnce(() => {
				throw mockError;
			});

			await expect(caseEventsHandler.handleEvent(eventMessage)).rejects.toThrow(mockError);
		});
	});
});
