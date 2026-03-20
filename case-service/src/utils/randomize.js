const randomize = require("randomatic");

if (!randomize.isCrypto) {
	throw new Error("randomatic not using a cryptographically secure method.");
}

export const generatePassword = () => {
	const password = randomize("Aa0", 10);
	return password;
};

export const generateOtp = () => {
	const otp = randomize("0", 6, { exclude: "0" });
	return otp;
};

export const generateRandomInvalidTIN = () => {
	const tinStart = ["000", "666", "9"];
	const tinInclude = [
		"111",
		"222",
		"333",
		"444",
		"555",
		"666",
		"777",
		"888",
		"999",
		"123",
		"234",
		"345",
		"456",
		"567",
		"678",
		"789"
	];

	const randomStart = tinStart[Math.floor(Math.random() * tinStart.length)];
	const randomInclude = tinInclude[Math.floor(Math.random() * tinInclude.length)];

	// Combine the random start and include
	const combinedString = randomStart + randomInclude;

	// Generate the remaining characters (up to 5)
	const remainingLength = 9 - combinedString.length;
	let remainingChars = "";
	for (let i = 0; i < remainingLength; i++) {
		remainingChars += Math.floor(Math.random() * 10);
	}

	// Combine the combined string with remaining characters
	return combinedString + remainingChars;
};
