import { catchAsync } from "#utils/index";
import { workflowDecisioning } from "./case-decisioning";

export const controller = {
	getWorkflowDecisioningConfiguration: catchAsync(async (req, res) => {
		const { customerID } = req.params;
		const response = await workflowDecisioning.getWorkflowDecisioningConfiguration(customerID);
		res.jsend.success(response, "Workflow decisioning configuration retrieved");
	}),

	updateWorkflowDecisioningConfiguration: catchAsync(async (req, res) => {
		const { customerID } = req.params;
		const { decisioning_type } = req.body;
		const response = await workflowDecisioning.updateWorkflowDecisioningConfiguration(customerID, decisioning_type);
		res.jsend.success(response, "Workflow decisioning configuration updated");
	})
};
