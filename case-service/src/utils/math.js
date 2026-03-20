export const roundNum = (num, length) => {
	// TODO: fix this eslint error

	const number = Math.round(num * Math.pow(10, length)) / Math.pow(10, length);
	return number;
};

export const calculatePercentageChange = (currentCount, previousCount) => {
	if (currentCount === 0 && previousCount === 0) {
		return 0;
	}

	if (previousCount === 0) {
		return 100;
	}

	if (currentCount === 0) {
		return -100;
	}
	return ((currentCount - previousCount) / previousCount) * 100;
};
