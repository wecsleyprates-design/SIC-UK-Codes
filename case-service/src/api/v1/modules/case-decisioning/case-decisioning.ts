import { UUID } from "crypto";
import { sqlQuery, logger } from "#helpers/index";
import { WorkflowDecisioningApiError } from "./error";
import { ERROR_CODES } from "#constants";
import { StatusCodes } from "http-status-codes";
import type { WorkflowDecisioningConfiguration, DecisioningType } from "./types";

class WorkflowDecisioning {
	/**
	 * Get workflow decisioning configuration for a customer
	 * @param customerId - Customer UUID
	 * @returns WorkflowDecisioningConfiguration (defaults to 'worth_score' if not found)
	 */
	async getWorkflowDecisioningConfiguration(
		customerId: UUID
	): Promise<WorkflowDecisioningConfiguration> {
		try {
			const query = `
				SELECT active_decisioning_type
				FROM public.data_cases_decisioning_config
				WHERE customer_id = $1
			`;

			const values = [customerId];
			const response = await sqlQuery({ sql: query, values });

			// If no configuration exists, return default value
			if (response.rowCount === 0) {
				return {
					active_decisioning_type: "worth_score"
				};
			}

			return response.rows[0];
		} catch (error) {
			logger.error(error, `Error getting workflow decisioning configuration for customer ${customerId}`);
			throw new WorkflowDecisioningApiError(
				"Failed to get workflow decisioning configuration",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Update workflow decisioning configuration for a customer
	 * @param customerId - Customer UUID
	 * @param decisioningType - Type of decisioning to set as active
	 * @returns Updated WorkflowDecisioningConfiguration
	 */
	async updateWorkflowDecisioningConfiguration(
		customerId: UUID,
		decisioningType: DecisioningType
	): Promise<WorkflowDecisioningConfiguration> {
		try {
			const query = `
				INSERT INTO public.data_cases_decisioning_config (
					customer_id,
					active_decisioning_type,
					created_at,
					updated_at
				)
				VALUES ($1, $2, NOW(), NOW())
				ON CONFLICT (customer_id)
				DO UPDATE SET
					active_decisioning_type = EXCLUDED.active_decisioning_type,
					updated_at = NOW()
				RETURNING 
					active_decisioning_type
			`;

			const values = [customerId, decisioningType];
			const response = await sqlQuery({ sql: query, values });

			if (response.rowCount === 0) {
				throw new WorkflowDecisioningApiError(
					"Failed to update workflow decisioning configuration",
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.UNKNOWN_ERROR
				);
			}

			return response.rows[0];
		} catch (error) {
			if (error instanceof WorkflowDecisioningApiError) {
				throw error;
			}
			logger.error(error, `Error updating workflow decisioning configuration for customer ${customerId}`);
			throw new WorkflowDecisioningApiError(
				"Failed to update workflow decisioning configuration",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}

export const workflowDecisioning = new WorkflowDecisioning();
