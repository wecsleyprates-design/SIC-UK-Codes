import { TruliooBase } from "../common/truliooBase";
import { logger } from "#helpers/logger";
import { getBusinessDetails } from "#helpers";
import { ITruliooPersonVerificationProcessor } from "./types";
import { TASK_STATUS } from "#constants";
import { TaskUpdateData } from "../common/types";

/**
 * Trulioo Person Task Handler
 * Manages person verification task execution following the same pattern as business verification
 */
export class TruliooPersonTaskHandler {
	private truliooBase: TruliooBase;
	private verificationProcessor: ITruliooPersonVerificationProcessor;

	constructor(truliooBase: TruliooBase, verificationProcessor: ITruliooPersonVerificationProcessor) {
		this.truliooBase = truliooBase;
		this.verificationProcessor = verificationProcessor;
	}

	/**
	 * Create task handler map for person verification
	 * @param updateTaskCallback Callback to update task status
	 * @returns Task handler map
	 */
	createTaskHandlerMap(updateTaskCallback: (taskId: string, data: TaskUpdateData) => Promise<void>) {
		return {
			fetch_person_verification: async (taskId: string) => {
				try {
					logger.info(`Processing person verification task: ${taskId}`);

					// Get business details for context
					const businessDetails = await getBusinessDetails(this.truliooBase.getBusinessId());
					if (!businessDetails || !businessDetails.data) {
						logger.warn(`Business not found for person verification task: ${taskId}`);
						await updateTaskCallback(taskId, {
							task_status: TASK_STATUS.FAILED,
							error: "Business not found"
						});
						return;
					}

					// For person verification, we need to get the person data from the task
					// This would typically come from the task metadata or be passed in
					// For now, we'll create a placeholder that can be extended
					const personData = {
						fullName: "Unknown Person",
						firstName: "Unknown",
						lastName: "Person",
						dateOfBirth: "",
						addressLine1: "",
						city: "",
						postalCode: "",
						country: "GB",
						email: "",
						phone: "",
						title: "",
						nationality: "",
						passportNumber: "",
						nationalId: "",
						ownershipPercentage: 0,
						controlType: "UBO" as const
					};

					const businessData = {
						companyName:
							typeof businessDetails.data === "object" && businessDetails.data && "name" in businessDetails.data
								? String(businessDetails.data.name)
								: "Unknown Company",
						companyCountryIncorporation:
							typeof businessDetails.data === "object" && businessDetails.data && "country" in businessDetails.data
								? String(businessDetails.data.country)
								: "GB",
						companyStateAddress: "",
						companyCity: "",
						companyZip: ""
					};

					// Process person verification
					const result = await this.verificationProcessor.processPersonVerification(personData, businessData);

					// Update task with results
					await updateTaskCallback(taskId, {
						task_status: "completed",
						data: result
					});

					logger.info(`Person verification task completed: ${taskId}`);
				} catch (error: unknown) {
					logger.error(error, `Error processing person verification task ${taskId}:`);
					await updateTaskCallback(taskId, {
						task_status: TASK_STATUS.FAILED,
						error: error instanceof Error ? error.message : "Unknown error"
					});
				}
			}
		};
	}
}
