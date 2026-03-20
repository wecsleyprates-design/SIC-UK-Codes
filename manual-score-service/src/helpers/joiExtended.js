/**
 * joiExtended implements custom Joi validations. The exported value is the Joi module extended
 * with the custom validations.
 */

const BaseJoi = require("joi");
const semver = require("semver");
import { isValidNumber, isValidNumberForRegion, parsePhoneNumber, verifyCaptcha } from "#utils/index";
import { DISPOSABLE_DOMAINS } from "#constants/index";
import mobileValidation from "joi-phone-number";

const checkDisposableDomains = value => {
	const domain = value.substring(value.lastIndexOf("@") + 1).toLowerCase();
	const disposableDomainsList = new Set(DISPOSABLE_DOMAINS);
	const emailDisposable = disposableDomainsList.has(domain);
	if (emailDisposable) {
		return true;
	}
	return false;
};

const checkDisposableEmail = joi => ({
	type: "emailextended",
	base: joi.string().email(),
	messages: {
		"emailextended.domain": "{{#label}} must be a valid domain"
	},
	rules: {
		noDisposableDomains: {
			method() {
				return this.$_addRule("noDisposableDomains");
			},
			validate(value, helpers) {
				if (checkDisposableDomains(value)) {
					return helpers.error("emailextended.domain");
				}
				return value;
			}
		}
	}
});

const verifyPhoneNumber = joi => ({
	// can be any name, no impact on joi method defnitions
	base: joi.string(),
	type: "string",
	messages: {
		// {{#label}} denotes field name of request body
		"string.PhNumber": "{{#label}} must be a valid phone number", // key:"string.PhNumber" is used below in helpers.errors mapping
		"string.PhNumberRegion": "{{#label}} Phone Number and region code doesnt match"
	},
	rules: {
		verifyPhoneNumber: {
			method() {
				return this.$_addRule("verifyPhoneNumber"); // actual joi extension method-name
			},
			validate(value, helpers) {
				// validation logic here,
				const phoneNumber = parsePhoneNumber(value);
				if (!isValidNumber(phoneNumber)) {
					return helpers.error("string.PhNumber"); // choose error message defined above
				}
				return value;
			}
		},
		validPhoneNumberForRegion: {
			method() {
				return this.$_addRule("validPhoneNumberForRegion");
			},
			validate(value, helpers) {
				const phoneNumber = parsePhoneNumber(value);
				if (!isValidNumberForRegion(phoneNumber)) {
					return helpers.error("string.PhNumberRegion");
				}
				return value;
			}
		}
	}
});

const isValidCaptcha = joi => ({
	type: "string",
	base: joi.string(),
	messages: {
		"captcha.token": "captcha verification failed"
	},
	rules: {
		verifyCaptcha: {
			method() {
				return this.$_addRule("verifyCaptcha");
			},
			validate(value, helpers) {
				const val = verifyCaptcha(value);
				if (val) {
					return helpers.error("captcha.token");
				}
				return value;
			}
		}
	}
});

const verifyUsername = joi => ({
	base: joi.string(),
	type: "string",
	messages: {
		"string.pattern.startWithPeriod": "invalid username: username cannot start with a period(.)",
		"string.pattern.invalidCharacters": "invalid username: no special characters except . and _ are allowed"
	},
	rules: {
		verifyUsername: {
			method() {
				return this.$_addRule("verifyUsername");
			},
			validate(value, helpers) {
				// Throw error if username starts with a special character
				if (!/^[A-Za-z0-9_]/u.test(value)) {
					return helpers.error("string.pattern.startWithPeriod");
				}

				// Throw error if username contains any  charactrs other than A-z, 0-9, underscore(_) or period(.)
				if (!/^(?!\d+$)[A-Za-z0-9_.]+$/u.test(value)) {
					return helpers.error("string.pattern.invalidCharacters");
				}

				return value;
			}
		}
	}
});

const isValidSemanticVersion = joi => ({
	base: joi.string(),
	type: "string",
	messages: {
		"string.pattern.invalidSemanticVersion": "Invalid semantic version: Please use the following format for your semantic version strings [number].[number].[number]"
	},
	rules: {
		isValidSemanticVersion: {
			method() {
				return this.$_addRule("isValidSemanticVersion");
			},
			validate(value, helpers) {
				// Throw error if mobile version is not valid
				if (!semver.valid(`${value}`)) {
					return helpers.error("string.pattern.invalidSemanticVersion");
				}

				return value;
			}
		}
	}
});

// Implement more extensions by adding functions to this array.
export const joiExtended = BaseJoi.extend(checkDisposableEmail, verifyPhoneNumber, isValidCaptcha, mobileValidation, verifyUsername, isValidSemanticVersion);
