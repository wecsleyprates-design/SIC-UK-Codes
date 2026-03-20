export const roundNum = (num, length) => {
	// eslint-disable-next-line prefer-exponentiation-operator
	const number = Math.round(num * Math.pow(10, length)) / Math.pow(10, length);
	return number;
};
