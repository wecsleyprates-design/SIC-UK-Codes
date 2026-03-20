import { BuildOpenCorporatesSearchQueryMetadata } from "#lib/opencorporates/types";
import { isObjectWithKeys } from "#utils";

export const isOpenCorporatesMetadata = (metadata: unknown): metadata is BuildOpenCorporatesSearchQueryMetadata => {
	return isObjectWithKeys(metadata, "names", "addresses", "zip3", "name2", "country", "hasCanadianAddress");
};
