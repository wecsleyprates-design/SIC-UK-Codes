import { uploadRawIntegrationDataToS3 } from "#common/index";
import { CONNECTION_STATUS, DIRECTORIES, INTEGRATION_ID } from "#constants";
import type { IBusinessIntegrationTaskEnriched, IDBConnection, TDateISO } from "#types";
import { Equifax } from "../equifax";
import type { EquifaxEntityMatchTask } from "../types";
import { type EquifaxFirmographicsEvent } from "@joinworth/types/dist/types/kafka/entity_matching.v1/FirmographicsEvent";

// Mock taskQueue to prevent the entire import chain that leads to OpenAI
jest.mock("#workers/taskHandler", () => ({
	taskQueue: {
		add: jest.fn(),
		process: jest.fn(),
		on: jest.fn()
	}
}));

// Mock kafkaToQueue function
jest.mock("#messaging/index", () => ({
	kafkaToQueue: jest.fn()
}));

// Mock specific helper functions
jest.mock("#helpers", () => ({
	...jest.requireActual("#helpers"),
	getOrCreateConnection: jest.fn(),
	platformFactory: jest.fn(),
	getCustomerBasicDetails: jest.fn(),
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn()
	}
}));

// Mock uploadRawIntegrationDataToS3
jest.mock("#common/index", () => ({
	uploadRawIntegrationDataToS3: jest.fn().mockResolvedValue(undefined)
}));

// @ts-ignore - Override private methods for testing
class EquifaxUnderTest extends Equifax {
	constructor(dbConnection: IDBConnection) {
		super(dbConnection);
	}
	public saveRequestResponse = jest.fn().mockResolvedValue(undefined);
	public updateTask = jest.fn().mockResolvedValue(undefined);
	public saveToS3 = jest.fn().mockResolvedValue(undefined);
}

describe("BEST-64: Equifax Entity Matching", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	const businessID = "0000-0000-0000-0000-0000";
	const dbConnection: IDBConnection = {
		id: "1111-0000-0000-0000-0000",
		business_id: businessID,
		platform_id: INTEGRATION_ID.EQUIFAX,
		connection_status: CONNECTION_STATUS.SUCCESS,
		created_at: new Date().toISOString() as TDateISO,
		updated_at: new Date().toISOString() as TDateISO,
		configuration: {}
	};
	const efx = new EquifaxUnderTest(dbConnection);

	it("should process entity matching", async () => {
		const taskId = "0000-0000-0000-0000-9999";
		const externalId = 123456;

		const task = { business_id: businessID, id: taskId, metadata: {} } as unknown as IBusinessIntegrationTaskEnriched<EquifaxEntityMatchTask>;
		const payload = generateEfx();
		const result = await efx.processFirmographicsEvent(task, payload);
		expect(result).toBe(undefined);
		expect(efx.saveRequestResponse).toHaveBeenCalledTimes(1);
		const expectedSavedPayload = {
			...payload.firmographics.equifax_bma_raw[0],
			...payload.firmographics.equifax_us_raw[0],
			additional_fields: {
				minority_business_enterprise: payload.firmographics.equifax_us_raw[0].efx_mbe ?? "N/A",
				woman_owned_enterprise: payload.firmographics.equifax_us_raw[0].efx_wbe ?? "N/A",
				veteran_owned_enterprise: payload.firmographics.equifax_us_raw[0].efx_vet ?? "N/A",
				number_of_employees: payload.firmographics.equifax_us_raw[0].efx_corpempcnt ?? "N/A"
			}
		};
		expect(efx.saveRequestResponse).toHaveBeenCalledWith(expect.objectContaining({ id: task.id, business_id: task.business_id }), expect.objectContaining(expectedSavedPayload));
		expect(efx.updateTask).toHaveBeenCalledWith(
			taskId,
			expect.objectContaining({
				reference_id: "123456", // Note: externalId gets converted to string
				metadata: expect.objectContaining({
					result: expect.objectContaining({
						business_id: task.business_id, // This comes from task, not payload
						report_date: expect.any(Date),
						report: expect.objectContaining({
							efx_id: 123456 // BMA raw data
						}),
						scoring_model: expect.objectContaining({
							corpemployees: 10,
							corpamount: 1000000
						}),
						matches: expect.objectContaining({
							score: 0,
							data: undefined // task.metadata?.match
						})
					})
				})
			})
		);
		expect(uploadRawIntegrationDataToS3).toHaveBeenCalledWith(expect.objectContaining(expectedSavedPayload), task.business_id, "judgementsLiens", DIRECTORIES.EQUIFAX, "EQUIFAX");
	});

	describe("Customer Name Injection in Credit Reports", () => {
		const { getCustomerBasicDetails } = require("#helpers");

		beforeEach(() => {
			getCustomerBasicDetails.mockClear();
		});

		it("should inject customer name into credit report request payload", async () => {
			const customerID = "customer-uuid-123";
			const customerName = "Acme Corporation Inc";
			
			// Mock the customer details API call
			getCustomerBasicDetails.mockResolvedValue({
				id: customerID,
				name: customerName,
				customer_type: "enterprise"
			});

			// Access the private method through any type casting for testing
			const efxTest = efx as any;
			const mockPayload = {
				customerConfiguration: {
					equifaxUSConsumerCreditReport: {
						endUserInformation: {
							endUsersName: "Worth AI"
						}
					}
				}
			};

			const result = await efxTest.injectCustomerNameIntoRequestPayload(mockPayload, customerID);

			expect(getCustomerBasicDetails).toHaveBeenCalledWith(customerID);
			expect(result.customerConfiguration.equifaxUSConsumerCreditReport.endUserInformation.endUsersName).toBe(
				"Acme Corporation Inc" // Not truncated since it's under 20 chars
			);
		});

		it("should truncate long customer names to 20 characters", async () => {
			const customerID = "customer-uuid-456";
			const longCustomerName = "This Is A Very Long Company Name That Exceeds Twenty Characters";
			
			getCustomerBasicDetails.mockResolvedValue({
				id: customerID,
				name: longCustomerName,
				customer_type: "enterprise"
			});

			const efxTest = efx as any;
			const mockPayload = {
				customerConfiguration: {
					equifaxUSConsumerCreditReport: {
						endUserInformation: {
							endUsersName: "Worth AI"
						}
					}
				}
			};

			const result = await efxTest.injectCustomerNameIntoRequestPayload(mockPayload, customerID);

			expect(result.customerConfiguration.equifaxUSConsumerCreditReport.endUserInformation.endUsersName).toBe(
				"This Is A Very Long " // Exactly 20 characters
			);
			expect(result.customerConfiguration.equifaxUSConsumerCreditReport.endUserInformation.endUsersName.length).toBe(20);
		});

		it("should not inject customer name if name is too short", async () => {
			const customerID = "customer-uuid-789";
			const shortName = "AB"; // Only 2 characters
			
			getCustomerBasicDetails.mockResolvedValue({
				id: customerID,
				name: shortName,
				customer_type: "enterprise"
			});

			const efxTest = efx as any;
			const mockPayload = {
				customerConfiguration: {
					equifaxUSConsumerCreditReport: {
						endUserInformation: {
							endUsersName: "Worth AI"
						}
					}
				}
			};

			const result = await efxTest.injectCustomerNameIntoRequestPayload(mockPayload, customerID);

			// Should keep the default "Worth AI" since name is too short
			expect(result.customerConfiguration.equifaxUSConsumerCreditReport.endUserInformation.endUsersName).toBe("Worth AI");
		});

		it("should handle InternalApiError gracefully and keep default name", async () => {
			const customerID = "customer-uuid-error";
			
			// Mock API error
			const apiError = new Error("API Error");
			apiError.name = "InternalApiError";
			getCustomerBasicDetails.mockRejectedValue(apiError);

			const efxTest = efx as any;
			const mockPayload = {
				customerConfiguration: {
					equifaxUSConsumerCreditReport: {
						endUserInformation: {
							endUsersName: "Worth AI"
						}
					}
				}
			};

			const result = await efxTest.injectCustomerNameIntoRequestPayload(mockPayload, customerID);

			// Should keep the default "Worth AI" and swallow the error
			expect(result.customerConfiguration.equifaxUSConsumerCreditReport.endUserInformation.endUsersName).toBe("Worth AI");
		});

		it("should throw non-InternalApiError errors", async () => {
			const customerID = "customer-uuid-critical-error";
			
			// Mock a critical error (not InternalApiError)
			const criticalError = new Error("Critical System Error");
			criticalError.name = "DatabaseError";
			getCustomerBasicDetails.mockRejectedValue(criticalError);

			const efxTest = efx as any;
			const mockPayload = {
				customerConfiguration: {
					equifaxUSConsumerCreditReport: {
						endUserInformation: {
							endUsersName: "Worth AI"
						}
					}
				}
			};

			// Should throw the error since it's not an InternalApiError
			await expect(
				efxTest.injectCustomerNameIntoRequestPayload(mockPayload, customerID)
			).rejects.toThrow("Critical System Error");
		});
	});
});

const generateEfx = (args = {}): EquifaxFirmographicsEvent => {
	return {
		collected_at: "2025-09-02T15:00:37.919422Z",
		business_id: "b644680a-e43d-464b-8ae3-4d3c06021236",
		source: "equifax",
		firmographics: {
			equifax_bma_raw: [
				{
					efx_id: 123456,
					efxbma_1m_ind_1c_past_due_count: 0,
					efxbma_1m_ind_1pc_past_due_count: 0,
					efxbma_1m_ind_2c_past_due_count: 0,
					efxbma_1m_ind_2pc_past_due_count: 0,
					efxbma_1m_ind_3c_past_due_count: 0,
					efxbma_1m_ind_3pc_past_due_count: 0,
					efxbma_1m_ind_4pc_past_due_count: 0,
					efxbma_1m_ind_tr_count: 0,
					efxbma_1m_ind_tr_total_bal: 0,
					efxbma_1m_ind_worst_payment_status: 0,
					efxbma_1m_nfin_1c_past_due_count: 0,
					efxbma_1m_nfin_1pc_past_due_count: 0,
					efxbma_1m_nfin_2c_past_due_count: 0,
					efxbma_1m_nfin_2pc_past_due_count: 0,
					efxbma_1m_nfin_3c_past_due_count: 0,
					efxbma_1m_nfin_3pc_past_due_count: 0,
					efxbma_1m_nfin_4pc_past_due_count: 0,
					efxbma_1m_nfin_chargeoff_tr_count: 0,
					efxbma_1m_nfin_closed_acc_count: 0,
					efxbma_1m_nfin_curr_credit_lim: 0,
					efxbma_1m_nfin_open_acc_count: 0,
					efxbma_1m_nfin_orig_credit_lim: 0,
					efxbma_1m_nfin_past_due_amount: 0,
					efxbma_1m_nfin_payment_index: 0,
					efxbma_1m_nfin_per_satisfactory_acc: 0,
					efxbma_1m_nfin_satisfactory_tr_count: 0,
					efxbma_1m_nfin_total_chargeoff_amt: 0,
					efxbma_1m_nfin_total_util: 0,
					efxbma_1m_nfin_tr_count: 0,
					efxbma_1m_nfin_tr_total_bal: 0,
					efxbma_1m_nfin_worst_payment_status: 0,
					efxbma_1m_serv_tr_count: 0,
					efxbma_1m_serv_tr_total_bal: 0,
					efxbma_1m_tel_1c_past_due_count: 0,
					efxbma_1m_tel_1pc_past_due_count: 0,
					efxbma_1m_tel_2c_past_due_count: 0,
					efxbma_1m_tel_2pc_past_due_count: 0,
					efxbma_1m_tel_3c_past_due_count: 0,
					efxbma_1m_tel_3pc_past_due_count: 0,
					efxbma_1m_tel_4pc_past_due_count: 0,
					efxbma_1m_tel_tr_count: 0,
					efxbma_1m_tel_tr_total_bal: 0,
					efxbma_1m_tel_worst_payment_status: 0,
					efxbma_1m_util_1c_past_due_count: 0,
					efxbma_1m_util_1pc_past_due_count: 0,
					efxbma_1m_util_2c_past_due_count: 0,
					efxbma_1m_util_2pc_past_due_count: 0,
					efxbma_1m_util_3c_past_due_count: 0,
					efxbma_1m_util_3pc_past_due_count: 0,
					efxbma_1m_util_4pc_past_due_count: 0,
					efxbma_1m_util_tr_count: 0,
					efxbma_1m_util_tr_total_bal: 0,
					efxbma_1m_util_worst_payment_status: 0,
					efxbma_3m_ind_1c_past_due_count: 0,
					efxbma_3m_ind_1pc_past_due_count: 0,
					efxbma_3m_ind_2c_past_due_count: 0,
					efxbma_3m_ind_2pc_past_due_count: 0,
					efxbma_3m_ind_3c_past_due_count: 0,
					efxbma_3m_ind_3pc_past_due_count: 0,
					efxbma_3m_ind_4pc_past_due_count: 0,
					efxbma_3m_ind_tr_count: 0,
					efxbma_3m_ind_tr_high_bal: 0,
					efxbma_3m_ind_tr_wb_count: 0,
					efxbma_3m_ind_worst_payment_status: 0,
					efxbma_3m_nfin_1c_past_due_amount: 0,
					efxbma_3m_nfin_1c_past_due_count: 0,
					efxbma_3m_nfin_1pc_past_due_count: 0,
					efxbma_3m_nfin_2c_past_due_amount: 0,
					efxbma_3m_nfin_2c_past_due_count: 0,
					efxbma_3m_nfin_2pc_past_due_count: 0,
					efxbma_3m_nfin_3c_past_due_amount: 0,
					efxbma_3m_nfin_3c_past_due_count: 0,
					efxbma_3m_nfin_3pc_past_due_count: 0,
					efxbma_3m_nfin_4pc_past_due_amount: 0,
					efxbma_3m_nfin_4pc_past_due_count: 0,
					efxbma_3m_nfin_chargeoff_tr_count: 0,
					efxbma_3m_nfin_orig_credit_lim: 0,
					efxbma_3m_nfin_past_due_amount: 0,
					efxbma_3m_nfin_per_satisfactory_acc: 0,
					efxbma_3m_nfin_satisfactory_tr_count: 0,
					efxbma_3m_nfin_total_chargeoff_amt: 0,
					efxbma_3m_nfin_total_util: 0,
					efxbma_3m_nfin_tr_count: 0,
					efxbma_3m_nfin_worst_payment_status: 0,
					efxbma_3m_nfin_high_credit_lim: 0,
					efxbma_3m_nfin_new_acc_count: 0,
					efxbma_3m_nfin_per_4pc_pd_to_totbal: 0,
					efxbma_3m_nfin_per_coff_to_tot_acc: 0,
					efxbma_3m_nfin_per_pd_to_totbal: 0,
					efxbma_3m_nfin_ratio_num_nondel_to_acc: 0,
					efxbma_3m_nfin_tr_high_bal: 0,
					efxbma_3m_nfin_tr_wb_count: 0,
					efxbma_3m_serv_past_due_amount: 0,
					efxbma_3m_serv_tr_count: 0,
					efxbma_3m_serv_tr_high_bal: 0,
					efxbma_3m_serv_tr_wb_count: 0,
					efxbma_3m_tel_1c_past_due_count: 0,
					efxbma_3m_tel_1pc_past_due_count: 0,
					efxbma_3m_tel_2c_past_due_count: 0,
					efxbma_3m_tel_2pc_past_due_count: 0,
					efxbma_3m_tel_3c_past_due_count: 0,
					efxbma_3m_tel_3pc_past_due_count: 0,
					efxbma_3m_tel_4pc_past_due_count: 0,
					efxbma_3m_tel_tr_count: 0,
					efxbma_3m_tel_tr_high_bal: 0,
					efxbma_3m_tel_tr_wb_count: 0,
					efxbma_3m_tel_worst_payment_status: 0,
					efxbma_3m_util_1c_past_due_count: 0,
					efxbma_3m_util_1pc_past_due_count: 0,
					efxbma_3m_util_2c_past_due_count: 0,
					efxbma_3m_util_2pc_past_due_count: 0,
					efxbma_3m_util_3c_past_due_count: 0,
					efxbma_3m_util_3pc_past_due_count: 0,
					efxbma_3m_util_4pc_past_due_count: 0,
					efxbma_3m_util_tr_count: 0,
					efxbma_3m_util_tr_high_bal: 0,
					efxbma_3m_util_tr_wb_count: 0,
					efxbma_3m_util_worst_payment_status: 0,
					efxbma_12m_ind_1c_past_due_count: 0,
					efxbma_12m_ind_1pc_past_due_count: 0,
					efxbma_12m_ind_2c_past_due_count: 0,
					efxbma_12m_ind_2pc_past_due_count: 0,
					efxbma_12m_ind_3c_past_due_count: 0,
					efxbma_12m_ind_3pc_past_due_count: 0,
					efxbma_12m_ind_4pc_past_due_count: 0,
					efxbma_12m_ind_tr_count: 0,
					efxbma_12m_ind_tr_high_bal: 0,
					efxbma_12m_ind_worst_payment_status: 0,
					efxbma_12m_nfin_1c_past_due_amount: 0,
					efxbma_12m_nfin_1c_past_due_count: 0,
					efxbma_12m_nfin_1pc_past_due_count: 0,
					efxbma_12m_nfin_2c_past_due_amount: 0,
					efxbma_12m_nfin_2c_past_due_count: 0,
					efxbma_12m_nfin_2pc_past_due_count: 0,
					efxbma_12m_nfin_3c_past_due_amount: 0,
					efxbma_12m_nfin_3c_past_due_count: 0,
					efxbma_12m_nfin_3pc_past_due_count: 0,
					efxbma_12m_nfin_4pc_past_due_amount: 0,
					efxbma_12m_nfin_4pc_past_due_count: 0,
					efxbma_12m_nfin_chargeoff_tr_count: 0,
					efxbma_12m_nfin_high_credit_lim: 0,
					efxbma_12m_nfin_orig_credit_lim: 0,
					efxbma_12m_nfin_past_due_amount: 0,
					efxbma_12m_nfin_per_satisfactory_acc: 0,
					efxbma_12m_nfin_satisfactory_tr_count: 0,
					efxbma_12m_nfin_total_chargeoff_amt: 0,
					efxbma_12m_nfin_total_util: 0,
					efxbma_12m_nfin_tr_count: 0,
					efxbma_12m_nfin_tr_high_bal: 0,
					efxbma_12m_nfin_worst_payment_status: 0,
					efxbma_12m_serv_tr_count: 0,
					efxbma_12m_serv_tr_high_bal: 0,
					efxbma_12m_serv_worst_payment_status: 0,
					efxbma_12m_tel_1c_past_due_count: 0,
					efxbma_12m_tel_1pc_past_due_count: 0,
					efxbma_12m_tel_2c_past_due_count: 0,
					efxbma_12m_tel_2pc_past_due_count: 0,
					efxbma_12m_tel_3c_past_due_count: 0,
					efxbma_12m_tel_3pc_past_due_count: 0,
					efxbma_12m_tel_4pc_past_due_count: 0,
					efxbma_12m_tel_tr_count: 0,
					efxbma_12m_tel_tr_high_bal: 0,
					efxbma_12m_tel_worst_payment_status: 0,
					efxbma_12m_util_1c_past_due_count: 0,
					efxbma_12m_util_1pc_past_due_count: 0,
					efxbma_12m_util_2c_past_due_count: 0,
					efxbma_12m_util_2pc_past_due_count: 0,
					efxbma_12m_util_3c_past_due_count: 0,
					efxbma_12m_util_3pc_past_due_count: 0,
					efxbma_12m_util_4pc_past_due_count: 0,
					efxbma_12m_util_tr_count: 0,
					efxbma_12m_util_tr_high_bal: 0,
					efxbma_12m_util_worst_payment_status: 0,
					business_id: "b644680a-e43d-464b-8ae3-4d3c06021236",
					as_of_date: "2025-01-10",
					parition_0: null,
					mon: "01",
					yr: "2025"
				}
			],
			equifax_us_raw: [
				{
					efx_id: 123456,
					efx_name: "TEST COMPANY LLC",
					efx_bnm2_1: "",
					efx_bnm2_2: "",
					efx_bnm2_3: "",
					efx_addr: "123 MAIN ST",
					efx_city: "MIAMI",
					efx_state: "FL",
					efx_zip: "33101",
					efx_zip4: "1234",
					efx_lat: 25.7617,
					efx_lon: -80.1918,
					efx_geoprec: 9,
					efx_region: "S",
					efx_ctryisocd: "US",
					efx_ctrynum: 1,
					efx_ctryname: "UNITED STATES",
					efx_countynm: "MIAMI-DADE",
					efx_county: 86,
					efx_cmsa: 5000,
					efx_cmsadesc: "MIAMI-FORT LAUDERDALE",
					efx_soho: "N",
					efx_biz: "Y",
					efx_res: "N",
					efx_cmra: "N",
					efx_congress: "27",
					efx_secadr: "",
					efx_seccty: "",
					efx_secstat: "",
					efx_statec2: null,
					efx_seczip: null,
					efx_seczip4: null,
					efx_seclat: null,
					efx_seclon: null,
					efx_secgeoprec: null,
					efx_secregion: "",
					efx_secctryisocd: "",
					efx_secctrynum: 0,
					efx_secctryname: "",
					efx_ctrytelcd: 1,
					efx_phone: "3051234567",
					efx_faxphone: null,
					efx_contct: "JOHN DOE",
					efx_titlecd: "01",
					efx_titledesc: "OWNER",
					efx_lastnam: "DOE",
					efx_fstnam: "JOHN",
					efx_email: "",
					efx_ceoname: "",
					efx_ceotitledesc: "",
					efx_cioname: "",
					efx_ciotitledesc: "",
					efx_cfoname: "",
					efx_cfotitledesc: "",
					efx_gender: "",
					efx_ethnicity: "",
					efx_mbe: "",
					efx_wbe: "",
					efx_vet: "",
					efx_bussize: "S",
					efx_gov: "N",
					efx_fgov: "N",
					efx_nonprofit: "N",
					efx_edu: "N",
					efx_busstat: "A",
					efx_busstatcd: 1,
					efx_web: "",
					efx_yrest: 2020,
					efx_corpempcnt: 10,
					efx_locempcnt: 10,
					efx_corpempcd: "B",
					efx_locempcd: "B",
					efx_corpamount: 1000000,
					efx_corpamountcd: "B",
					efx_corpamounttp: "A",
					efx_corpamountprec: "E",
					efx_locamount: 1000000,
					efx_locamountcd: "B",
					efx_locamounttp: "A",
					efx_locamountprec: "E",
					efx_public: null,
					efx_stkexc: "",
					efx_tcksym: "",
					efx_primsic: 7372,
					efx_secsic1: null,
					efx_secsic2: null,
					efx_secsic3: null,
					efx_secsic4: null,
					efx_primsicdesc: "COMPUTER PROGRAMMING SERVICES",
					efx_secsicdesc1: "",
					efx_secsicdesc2: "",
					efx_secsicdesc3: "",
					efx_secsicdesc4: "",
					efx_primnaicscode: 541511,
					efx_secnaics1: null,
					efx_secnaics2: null,
					efx_secnaics3: null,
					efx_secnaics4: null,
					efx_primnaicsdesc: "CUSTOM COMPUTER PROGRAMMING SERVICES",
					efx_secnaicsdesc1: "",
					efx_secnaicsdesc2: "",
					efx_secnaicsdesc3: "",
					efx_secnaicsdesc4: "",
					efx_legsubnumall: 0,
					efx_legsubnameall: "",
					efx_legsubaddressall: "",
					efx_legsubcityall: "",
					efx_legsubstateall: "",
					efx_legsubzipcodeall: "",
					efx_legsubzip4all: 0,
					efx_legsubcountyall: "",
					efx_legsubctryisocdall: "",
					efx_legsubctrynumall: 0,
					efx_legsubctrynameall: "",
					business_id: "b644680a-e43d-464b-8ae3-4d3c06021236",
					as_of_date: "2025-01-10",
					parition_0: null,
					mon: "01",
					yr: "2025"
				}
			]
		},
		...args
	} as any;
};
