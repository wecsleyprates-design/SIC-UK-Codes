import currency from "currency.js";

export const roundNum = (num, length) => {
	const number = Math.round(num * Math.pow(10, length)) / Math.pow(10, length);
	return number;
};

/**
 * @description converts the value between 0 & 1 to percentage
 * @param {number} value decimal value
 * @param {number} decimal number of decimal points
 * @returns percentage value out of 100 with 1 decimal point as default
 */
export const convertToPercentage = (value, decimal = 1) => {
	if (parseFloat(value) === "NaN") {
		return 0;
	}

	return parseFloat(value * 100).toFixed(decimal);
};

/**
 * @description the currency function converts string into appropriate int/decimal value
 * @param {any} value
 * @returns the numeric (int/float) value
 */
export const parseFloatNum = value => {
	return currency(value).value;
};

/**
 * @description converts the value into decimal number
 * @param {number} value decimal value
 * @param {number} decimal number of decimal points
 * @returns percentage value out of 100 with 1 decimal point as default
 */
export const convertToDecimal = (value, decimal = 1) => {
	if (parseFloat(value) === "NaN") {
		return 0;
	}

	return parseFloat(value).toFixed(decimal);
};
