export type DecisioningType = "worth_score" | "custom_workflow";

export interface WorkflowDecisioningConfiguration {
	active_decisioning_type: DecisioningType;
}

export interface UpdateWorkflowDecisioningConfigurationRequest {
	decisioning_type: DecisioningType;
}
