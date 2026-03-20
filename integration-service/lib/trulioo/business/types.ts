/**
 * Trulioo Business Module Types
 * Defines interfaces for business module components to avoid circular dependencies
 */

import {
	TruliooKYBFormData,
	TruliooFlowResult,
	TruliooBusinessData,
	TruliooScreenedPersonData,
	TaskUpdateCallback,
	TaskUpdateData
} from "../common/types";

/**
 * Interface for business results storage operations
 */
export interface ITruliooBusinessResultsStorage {
	storeInitialVerificationRecord(
		taskId: string,
		businessPayload: TruliooKYBFormData,
		hfSession: string
	): Promise<void>;

	storeBusinessVerificationResults(
		taskId: string,
		businessPayload: TruliooKYBFormData,
		flowResult: TruliooFlowResult
	): Promise<void>;
}

/**
 * Interface for UBO extraction operations
 */
export interface ITruliooUBOExtractor {
	extractAndScreenUBOsDirectors(
		businessEntityVerificationId: string,
		businessData: TruliooBusinessData,
		flowResult: TruliooFlowResult,
		taskId?: string,
		advancedWatchlistsEnabled?: boolean
	): Promise<TruliooScreenedPersonData[]>;
}

/**
 * Interface for KYB processing operations
 */
export interface ITruliooBusinessKYBProcessor {
	processKYBFlow(taskId: string, businessData: TruliooBusinessData): Promise<void>;
}

/**
 * Interface for task handler operations
 */
export interface ITruliooBusinessTaskHandler {
	createTaskHandlerMap(
		updateTask: TaskUpdateCallback
	): Record<string, (taskId: string, data: TaskUpdateData) => Promise<void>>;
}
