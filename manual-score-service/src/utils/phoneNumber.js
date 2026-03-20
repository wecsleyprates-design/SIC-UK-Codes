import httpError from "http-errors";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";
// Require `PhoneNumberFormat`.
const PNF = require("google-libphonenumber").PhoneNumberFormat;
// Get an instance of `PhoneNumberUtil`.
const phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();

const regions = ["US", "AS", "GU", "MP", "PR", "VI"];

export const isValidNumber = number => {
	const result = phoneUtil.isValidNumber(number);
	return result;
};

export const isValidNumberForRegion = number => {
	return regions.some(region => phoneUtil.isValidNumberForRegion(number, region));
};

export const formatNumber = number => {
	const result = phoneUtil.format(number, PNF.E164);
	return result;
};

export const parsePhoneNumber = number => {
	let errorMessage = "";
	for (const region of regions) {
		try {
			const phoneNumber = phoneUtil.parse(number.toString(), region);
			return phoneNumber;
		} catch (error) {
			errorMessage = error.message;
			// Invalid phone number for the current region, continue to the next region
			continue;
		}
	}
	throw new Error(errorMessage);
};

// For making DB entry
export const verifyAndFormatNumber = number => {
	// Parse number with country code and keep raw input.
	const phoneNumber = parsePhoneNumber(number);
	if (!phoneUtil.isValidNumber(phoneNumber)) {
		throw httpError(StatusCodes.BAD_REQUEST, "Invalid phone number", ERROR_CODES.INVALID);
	}
	if (!regions.some(region => phoneUtil.isValidNumberForRegion(phoneNumber, region))) {
		throw httpError(StatusCodes.BAD_REQUEST, "Invalid phone number for given region", ERROR_CODES.INVALID);
	}
	return formatNumber(phoneNumber);
};

export const formatNumberWithoutPlus = number => {
	const phoneNumber = phoneUtil.parse(number);
	const countryCode = phoneNumber.getCountryCode();
	const nationalNumber = phoneNumber.getNationalNumber();
	const formattedNumber = `${countryCode}${nationalNumber}`;
	return formattedNumber;
};
