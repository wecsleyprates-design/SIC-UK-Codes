import type { ZoomInfoIntegrationFactMetadata } from "../zoomInfoAdapter/types";
import { isObjectWithKeys } from "#utils";

export const isZoomInfoMetadata = (metadata: unknown): metadata is ZoomInfoIntegrationFactMetadata => {
	return isObjectWithKeys(metadata, "names", "addresses", "zip3", "name2");
};
