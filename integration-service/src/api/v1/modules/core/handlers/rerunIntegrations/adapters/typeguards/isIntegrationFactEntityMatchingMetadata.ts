import { isObjectWithKeys } from "#utils";
import { IntegrationFactEntityMatchingMetadata } from "../types";

export const isIntegrationFactEntityMatchingMetadata = (
	metadata: unknown
): metadata is IntegrationFactEntityMatchingMetadata => {
	return (
		isObjectWithKeys(metadata, "names", "originalAddresses") &&
		Array.isArray(metadata.names) &&
		Array.isArray(metadata.originalAddresses)
	);
};
