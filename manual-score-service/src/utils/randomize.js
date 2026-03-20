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
