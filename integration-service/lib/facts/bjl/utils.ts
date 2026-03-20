import { VerdataUtil } from "#lib/verdata/verdataUtil";
import type { BLJ, Record as VerdataRecord } from "#lib/verdata/types";
import type { BJLStatus } from "./types";
import dayjs from "dayjs";
import { sanitizeNumericString } from "#utils/sanitizeNumericString";
import { get as _get } from "lodash";

/**
 * Normalize Verdata status strings to consistent BJLStatus values
 */
export const normalizeVerdataStatus = (status: string | undefined | null = ""): BJLStatus => {
	if (typeof status !== "string") {
		return "unknown";
	}
	let lowerCaseStatus = status.toLowerCase();
	switch (lowerCaseStatus) {
		case "open":
		case "active":
			return "active";
		case "withdrawn":
			return "withdrawn";
		case "closed":
			return "closed";
		case "pending":
			return "pending";
	}
	return "unknown";
};

/**
 * Determine if the verdata record is using the deprecated ThirdPartyData shape
 */
export const hasDeprecatedVerdataThirdPartyShape = (verdata: VerdataRecord): verdata is VerdataRecord & { ThirdPartyData: any[] } => {
	// Handle if ThirdPartyData is just not present
	if (!verdata.ThirdPartyData) {
		return false;
	}
	if (Array.isArray(verdata.ThirdPartyData) && verdata.ThirdPartyData.length === 0) {
		return false;
	}
	if (!Array.isArray(verdata.ThirdPartyData) && Object.hasOwn(verdata.ThirdPartyData, "BUS_BANKRUPTCY_SUMMARY_001")) {
		return false;
	}
	if (!verdata.blj) {
		return true;
	}
	if (Array.isArray(verdata.blj)) {
		if (verdata.blj.length === 0) {
			return true;
		}
		if (verdata.blj?.[0]?.summary && "id" in verdata.blj[0].summary) {
			return false;
		}
	} else {
		if (verdata.blj?.summary && "id" in verdata.blj.summary) {
			return false;
		}
	}
	return false;
};

/**
 * Prepare Verdata BLJ data for processing - handles conversion and array normalization
 */
export const prepareVerdataBLJ = (verdata: VerdataRecord): BLJ[] | null => {
	if (hasDeprecatedVerdataThirdPartyShape(verdata)) {
		verdata.blj = VerdataUtil.convertThirdPartyToBLJ(verdata.ThirdPartyData);
	}
	if (!verdata.blj) {
		return null;
	}
	// Convert blj to array if it's not already
	return Array.isArray(verdata.blj) ? verdata.blj : [verdata.blj];
};

/**
 * Generic function to check if summary has possible records of a specific type
 */
export const hasPossibleRecords = <T = any>(blj: BLJ | BLJ[] | T, checkKeys: string[]): blj is T => {
	if (!blj) {
		return false;
	}
	const records = Array.isArray(blj) ? blj : [blj];

	// we're now working with an array of BLJ
	if (records.length === 0) {
		return false;
	}
	for (const record of records) {
		for (const key of checkKeys) {
			if (_get(record, key) != null) {
				return true;
			}
		}
	}
	return false;
};

/**
 * Generic function to find the most recent record by filing_date
 */
export const findMostRecentRecord = <T = any>(records: T[], key: keyof T): T | undefined => {
	return records.reduce((latest, rec) => (dayjs(rec?.[key] as any).isAfter(dayjs(latest?.[key] as any)) ? rec : latest));
};

/**
 * Generic function to check Equifax status and return early if needed
 */
export const checkEquifaxStatus = <T = any>(rawStatus: number | string, returnValue: T): T | undefined | null => {
	const status = sanitizeNumericString(rawStatus);
	switch (status) {
		case 99:
			return undefined;
		case 0:
			return returnValue;
	}
	return null; // Continue processing
};

/**
 * Generic function to calculate total amount for active records
 */
export const calculateTotalActiveAmount = <T extends Record<string, any>>(records: T[], amountKey: keyof T): number | null => {
	return records
		.filter(record => normalizeVerdataStatus(record.status) === "active")
		.reduce(
			(acc, curr) => {
				const amount = curr[amountKey];
				if (amount == null || Number.isNaN(amount)) {
					return acc;
				}
				return (acc ?? 0) + amount;
			},
			null as number | null
		);
};
