import { logger, producer, sqlQuery } from "../../../helpers/index";
import { kafkaTopics, kafkaEvents, WEBHOOK_EVENTS, CUSTOM_ONBOARDING_SETUP } from "../../../constants/index";
import { onboarding } from "../../../api/v1/modules/onboarding/onboarding";

require("kafkajs");
jest.mock("kafkajs");

jest.mock("#helpers/index", () => {
	const originalModule = jest.requireActual("#helpers/index");
	return {
		...originalModule,
		sqlQuery: jest.fn(),
		sqlTransaction: jest.fn(),
		producer: {
			send: jest.fn()
		},
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		}
	};
});

jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
	},
	tokenConfig: {
		TOKEN_LIFE: "3h",
		REFRESH_TOKEN_LIFE: "30d",
		REFRESH_TOKEN_LIFE_SECONDS: 2592000,
		FORGOT_PASSWORD_TOKEN_LIFE_SECONDS: 10 * 60,
		VERIFY_EMAIL_TOKEN_LIFE_SECONDS: 10 * 60
	}
}));

jest.mock("../../../api/v1/modules/onboarding/onboarding", () => ({
	onboarding: {
		getCustomerOnboardingStages: jest.fn()
	}
}));

jest.mock("../../../api/v1/modules/businesses/businesses", () => ({
	businesses: {
		getCustomerBusinessById: jest.fn()
	}
}));

describe("applicantReminder", () => {
	let applicantReminder: () => Promise<void>;

	beforeAll(() => {
		const module = require("../application-reminder");
		applicantReminder = module.applicantReminder;
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should process applicant reminders and send Kafka events successfully", async () => {
		const mockCases = {
			rows: [
				{
					case_id: "case-123",
					applicant_id: "applicant-456",
					business_id: "business-789",
					customer_id: "customer-101",
					business_name: "Test Business",
					first_invitation_id: "invite-111",
					first_invite_created_at: "2025-11-01T00:00:00.000Z",
					days_since_first_invite: 7,
					urgency: "high",
					threshold: 7,
					message: "Please complete your application",
					allowed_case_status: [1, 2]
				}
			]
		};

		const mockCustomerConfig = [
			{
				stage: "login",
				config: {
					fields: [
						{
							name: "Login with Email & Password",
							status: true
						}
					]
				}
			}
		];

		(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCases);
		(onboarding.getCustomerOnboardingStages as jest.Mock).mockResolvedValueOnce(mockCustomerConfig);
		(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });

		await applicantReminder();

		expect(logger.info).toHaveBeenCalledWith(
			"=============== Executing Cron Job to Send Applicant Reminders ==============="
		);

		expect(onboarding.getCustomerOnboardingStages).toHaveBeenCalledWith(
			{ customerID: "customer-101" },
			{ setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP },
			false
		);

		expect(producer.send).toHaveBeenCalledWith({
			topic: kafkaTopics.USERS_NEW,
			messages: [
				{
					key: "business-789",
					value: expect.objectContaining({
						event: kafkaEvents.APPLICANT_REMINDER
					})
				}
			]
		});

		const kafkaMessage = (producer.send as jest.Mock).mock.calls[0][0].messages[0].value;
		expect(kafkaMessage).toMatchObject({
			event_code: WEBHOOK_EVENTS.APPLICANT_REMINDER,
			business_id: "business-789",
			business_name: "Test Business",
			customer_id: "customer-101",
			invitation_id: "invite-111",
			case_id: "case-123",
			applicant_id: "applicant-456",
			urgency: "high",
			days_since_invite_click: 7,
			urgency_threshold_days: 7,
			custom_message: "Please complete your application",
			is_no_login: false
		});

		expect(sqlQuery).toHaveBeenCalledWith({
			sql: expect.stringContaining("INSERT INTO data_applicants_threshold_reminder_tracker"),
			values: [
				"applicant-456",
				"case-123",
				"business-789",
				"customer-101",
				7,
				"high",
				7
			]
		});

		expect(logger.info).toHaveBeenCalledWith(
			"Applicant reminder sent for case case-123 with urgency high"
		);
	});

	it("should handle is_no_login as false when loginWithEmailPasswordField is not found", async () => {
		const mockCases = {
			rows: [
				{
					case_id: "case-123",
					applicant_id: "applicant-456",
					business_id: "business-789",
					customer_id: "customer-101",
					business_name: "Test Business",
					first_invitation_id: "invite-111",
					first_invite_created_at: "2025-11-01T00:00:00.000Z",
					days_since_first_invite: 7,
					urgency: "high",
					threshold: 7,
					message: "Please complete your application",
					allowed_case_status: [1, 2]
				}
			]
		};

		const mockCustomerConfig = [
			{
				stage: "login",
				config: {
					fields: []
				}
			}
		];

		(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCases);
		(onboarding.getCustomerOnboardingStages as jest.Mock).mockResolvedValueOnce(mockCustomerConfig);
		(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });

		await applicantReminder();

		const kafkaMessage = (producer.send as jest.Mock).mock.calls[0][0].messages[0].value;
		expect(kafkaMessage.is_no_login).toBe(false);
	});

	it("should handle is_no_login as true when loginWithEmailPasswordField status is false", async () => {
		const mockCases = {
			rows: [
				{
					case_id: "case-123",
					applicant_id: "applicant-456",
					business_id: "business-789",
					customer_id: "customer-101",
					business_name: "Test Business",
					first_invitation_id: "invite-111",
					first_invite_created_at: "2025-11-01T00:00:00.000Z",
					days_since_first_invite: 7,
					urgency: "high",
					threshold: 7,
					message: "Please complete your application",
					allowed_case_status: [1, 2]
				}
			]
		};

		const mockCustomerConfig = [
			{
				stage: "login",
				config: {
					fields: [
						{
							name: "Login with Email & Password",
							status: false
						}
					]
				}
			}
		];

		(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCases);
		(onboarding.getCustomerOnboardingStages as jest.Mock).mockResolvedValueOnce(mockCustomerConfig);
		(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });

		await applicantReminder();

		const kafkaMessage = (producer.send as jest.Mock).mock.calls[0][0].messages[0].value;
		expect(kafkaMessage.is_no_login).toBe(true);
	});

	it("should handle multiple cases correctly", async () => {
		const mockCases = {
			rows: [
				{
					case_id: "case-123",
					applicant_id: "applicant-456",
					business_id: "business-789",
					customer_id: "customer-101",
					business_name: "Test Business 1",
					first_invitation_id: "invite-111",
					first_invite_created_at: "2025-11-01T00:00:00.000Z",
					days_since_first_invite: 7,
					urgency: "high",
					threshold: 7,
					message: "Please complete your application",
					allowed_case_status: [1, 2]
				},
				{
					case_id: "case-456",
					applicant_id: "applicant-789",
					business_id: "business-101",
					customer_id: "customer-202",
					business_name: "Test Business 2",
					first_invitation_id: "invite-222",
					first_invite_created_at: "2025-10-20T00:00:00.000Z",
					days_since_first_invite: 14,
					urgency: "medium",
					threshold: 14,
					message: "Reminder to complete application",
					allowed_case_status: [1]
				}
			]
		};

		const mockCustomerConfig = [
			{
				stage: "login",
				config: {
					fields: [
						{
							name: "Login with Email & Password",
							status: true
						}
					]
				}
			}
		];

		(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCases);
		(onboarding.getCustomerOnboardingStages as jest.Mock).mockResolvedValue(mockCustomerConfig);
		(sqlQuery as jest.Mock).mockResolvedValue({ rows: [] });

		await applicantReminder();

		expect(onboarding.getCustomerOnboardingStages).toHaveBeenCalledTimes(2);
		expect(producer.send).toHaveBeenCalledTimes(2);
		expect(sqlQuery).toHaveBeenCalledTimes(3); // 1 initial query + 2 insert queries

		expect(logger.info).toHaveBeenCalledWith(
			"Applicant reminder sent for case case-123 with urgency high"
		);
		expect(logger.info).toHaveBeenCalledWith(
			"Applicant reminder sent for case case-456 with urgency medium"
		);
	});

	it("should log an error and continue processing when one case fails", async () => {
		const mockCases = {
			rows: [
				{
					case_id: "case-123",
					applicant_id: "applicant-456",
					business_id: "business-789",
					customer_id: "customer-101",
					business_name: "Test Business 1",
					first_invitation_id: "invite-111",
					first_invite_created_at: "2025-11-01T00:00:00.000Z",
					days_since_first_invite: 7,
					urgency: "high",
					threshold: 7,
					message: "Please complete your application",
					allowed_case_status: [1, 2]
				},
				{
					case_id: "case-456",
					applicant_id: "applicant-789",
					business_id: "business-101",
					customer_id: "customer-202",
					business_name: "Test Business 2",
					first_invitation_id: "invite-222",
					first_invite_created_at: "2025-10-20T00:00:00.000Z",
					days_since_first_invite: 14,
					urgency: "medium",
					threshold: 14,
					message: "Reminder to complete application",
					allowed_case_status: [1]
				}
			]
		};

		const mockCustomerConfig = [
			{
				stage: "login",
				config: {
					fields: [
						{
							name: "Login with Email & Password",
							status: true
						}
					]
				}
			}
		];

		const mockError = new Error("Kafka send failed");

		(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCases);
		(onboarding.getCustomerOnboardingStages as jest.Mock)
			.mockRejectedValueOnce(mockError)
			.mockResolvedValueOnce(mockCustomerConfig);
		(sqlQuery as jest.Mock).mockResolvedValue({ rows: [] });

		await applicantReminder();

		expect(logger.error).toHaveBeenCalledWith(
			mockError,
			"Error processing applicant reminder for case ID case-123"
		);

		expect(producer.send).toHaveBeenCalledTimes(1);
		expect(logger.info).toHaveBeenCalledWith(
			"Applicant reminder sent for case case-456 with urgency medium"
		);
	});

	it("should handle empty cases result gracefully", async () => {
		const mockCases = {
			rows: []
		};

		(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCases);

		await applicantReminder();

		expect(logger.info).toHaveBeenCalledWith(
			"=============== Executing Cron Job to Send Applicant Reminders ==============="
		);
		expect(onboarding.getCustomerOnboardingStages).not.toHaveBeenCalled();
		expect(producer.send).not.toHaveBeenCalled();
	});

	it("should handle null or undefined customerConfig gracefully and set is_no_login to false", async () => {
		const mockCases = {
			rows: [
				{
					case_id: "case-123",
					applicant_id: "applicant-456",
					business_id: "business-789",
					customer_id: "customer-101",
					business_name: "Test Business",
					first_invitation_id: "invite-111",
					first_invite_created_at: "2025-11-01T00:00:00.000Z",
					days_since_first_invite: 7,
					urgency: "high",
					threshold: 7,
					message: "Please complete your application",
					allowed_case_status: [1, 2]
				}
			]
		};

		(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCases);
		(onboarding.getCustomerOnboardingStages as jest.Mock).mockResolvedValueOnce(null);
		(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });

		await applicantReminder();

		const kafkaMessage = (producer.send as jest.Mock).mock.calls[0][0].messages[0].value;
		expect(kafkaMessage.is_no_login).toBe(false);
	});

	it("should use correct Kafka topic and event key", async () => {
		const mockCases = {
			rows: [
				{
					case_id: "case-123",
					applicant_id: "applicant-456",
					business_id: "business-789",
					customer_id: "customer-101",
					business_name: "Test Business",
					first_invitation_id: "invite-111",
					first_invite_created_at: "2025-11-01T00:00:00.000Z",
					days_since_first_invite: 7,
					urgency: "high",
					threshold: 7,
					message: "Please complete your application",
					allowed_case_status: [1, 2]
				}
			]
		};

		(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCases);
		(onboarding.getCustomerOnboardingStages as jest.Mock).mockResolvedValueOnce([]);
		(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });

		await applicantReminder();

		expect(producer.send).toHaveBeenCalledWith({
			topic: kafkaTopics.USERS_NEW,
			messages: [
				{
					key: "business-789",
					value: expect.objectContaining({
						event: kafkaEvents.APPLICANT_REMINDER
					})
				}
			]
		});
	});

	it("should include timestamp in Kafka payload", async () => {
		const mockCases = {
			rows: [
				{
					case_id: "case-123",
					applicant_id: "applicant-456",
					business_id: "business-789",
					customer_id: "customer-101",
					business_name: "Test Business",
					first_invitation_id: "invite-111",
					first_invite_created_at: "2025-11-01T00:00:00.000Z",
					days_since_first_invite: 7,
					urgency: "high",
					threshold: 7,
					message: "Please complete your application",
					allowed_case_status: [1, 2]
				}
			]
		};

		(sqlQuery as jest.Mock).mockResolvedValueOnce(mockCases);
		(onboarding.getCustomerOnboardingStages as jest.Mock).mockResolvedValueOnce([]);
		(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });

		await applicantReminder();

		const kafkaMessage = (producer.send as jest.Mock).mock.calls[0][0].messages[0].value;
		expect(kafkaMessage.timestamp).toBeDefined();
		expect(new Date(kafkaMessage.timestamp).toString()).not.toBe("Invalid Date");
	});
});
