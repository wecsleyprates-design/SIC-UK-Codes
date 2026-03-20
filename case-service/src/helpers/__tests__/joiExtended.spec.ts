import { joiExtended as Joi } from "../joiExtended";
import { DISPOSABLE_DOMAINS } from "#constants";

/**
 * This is necessary to avoid a KafkaJS error from an implicit import of #helpers/kafka
 * (presumably via joiExtended.ts -> #utils/index -> migrate.js -> #helpers/kafka)
 */
jest.mock("kafkajs");

describe("joiExtended", () => {
	describe("noDisposableDomains", () => {
		test("should succeed validation for an email with a non-disposable domain: joinworth.com", () => {
			/** Arrange */
			const schema = Joi.emailextended().noDisposableDomains();
			const email = "test@joinworth.com";

			/** Act */
			const result = schema.validate(email);

			/** Assert */
			expect(result.error).toBeUndefined();
			expect(result.value).toBe(email);
		});

		/**
		 * There are hundreds of thousands of disposable domains; testing all of them is impractical
		 * and would take an excessively long time. So, we'll just test the a subset of them.
		 */
		test.each(DISPOSABLE_DOMAINS.slice(0, 50))(
			"should fail validation for an email with a disposable domain: %s",
			domain => {
				/** Arrange */
				const schema = Joi.emailextended().noDisposableDomains();
				const email = `test@${domain}`;

				/** Act */
				const result = schema.validate(email);

				/** Assert */
				expect(result.error).toBeDefined();
				expect(result.error).toHaveProperty("message", '"value" must be a valid domain');
			}
		);
	});

	describe("verifyPhoneNumber", () => {
		test("should succeed validation for a valid phone number: 822-782-9729", () => {
			/** Arrange */
			const schema = Joi.string().verifyPhoneNumber();
			const phoneNumber = "833-782-9729";

			/** Act */
			const result = schema.validate(phoneNumber);

			/** Assert */
			expect(result.error).toBeUndefined();
			expect(result.value).toBe(phoneNumber);
		});

		test("should fail validation for an invalid phone number: 782-9729", () => {
			/** Arrange */
			const schema = Joi.string().verifyPhoneNumber();
			const phoneNumber = "782-9729";

			/** Act */
			const result = schema.validate(phoneNumber);
			expect(result.error).toHaveProperty("message", '"value" must be a valid phone number');
		});

		test("should throw an error for an invalid value: invalid-phone-number", () => {
			/** Arrange */
			const schema = Joi.string().verifyPhoneNumber();
			const phoneNumber = "invalid-phone-number";

			/** Assert */
			expect(() => {
				/** Act */
				schema.validate(phoneNumber);
			}).toThrow("The string supplied did not seem to be a phone number");
		});
	});

	describe("validPhoneNumberForRegion", () => {
		test("should succeed validation for a valid phone number with a valid region: 833-782-9729", () => {
			/** Arrange */
			const schema = Joi.string().validPhoneNumberForRegion();
			const phoneNumber = "833-782-9729";

			/** Act */
			const result = schema.validate(phoneNumber);

			/** Assert */
			expect(result.error).toBeUndefined();
			expect(result.value).toBe(phoneNumber);
		});

		/**
		 * This test uses a French number format (+33) because we need a phone number that:
		 * 1. IS valid (passes isValidNumber)
		 * 2. Is NOT valid for supported regions (US, CA, GB, etc.)
		 * Numbers like 000-782-9729 fail isValidNumber entirely, so they don't test region validation.
		 */
		test("should fail validation for a valid phone number with an invalid region: +33612345678", () => {
			/** Arrange */
			const schema = Joi.string().validPhoneNumberForRegion();
			const phoneNumber = "+33612345678";

			/** Act */
			const result = schema.validate(phoneNumber);
			expect(result.error).toBeDefined();
			expect(result.error).toHaveProperty("message", '"value" Phone Number and region code doesnt match');
		});

		test("should throw an error for an invalid value", () => {
			/** Arrange */
			const schema = Joi.string().validPhoneNumberForRegion();
			const phoneNumber = "invalid-phone-number";

			/** Assert */
			expect(() => {
				/** Act */
				schema.validate(phoneNumber);
			}).toThrow("The string supplied did not seem to be a phone number");
		});
	});

	describe("verifyUsername", () => {
		test("should succeed validation for a valid username: valid_username.123", () => {
			/** Arrange */
			const schema = Joi.string().verifyUsername();
			const username = "valid_username.123";

			/** Act */
			const result = schema.validate(username);

			/** Assert */
			expect(result.error).toBeUndefined();
			expect(result.value).toBe(username);
		});

		test("should fail validation for an invalid username: .invalid_username", () => {
			/** Arrange */
			const schema = Joi.string().verifyUsername();
			const username = ".invalid_username";

			/** Act */
			const result = schema.validate(username);

			/** Assert */
			expect(result.error).toBeDefined();
			expect(result.error).toHaveProperty("message", "invalid username: username cannot start with a period(.)");
		});

		test.each(["invalid_username@", "invalid_username&", "invalid_username%"])(
			"should fail validation for an invalid username: %s",
			username => {
				/** Arrange */
				const schema = Joi.string().verifyUsername();

				/** Act */
				const result = schema.validate(username);

				/** Assert */
				expect(result.error).toBeDefined();
				expect(result.error).toHaveProperty(
					"message",
					"invalid username: no special characters except . and _ are allowed"
				);
			}
		);
	});

	describe("isValidSemanticVersion", () => {
		test("should succeed validation for a valid semantic version: 1.0.0", () => {
			/** Arrange */
			const schema = Joi.string().isValidSemanticVersion();
			const version = "1.0.0";

			/** Act */
			const result = schema.validate(version);

			/** Assert */
			expect(result.error).toBeUndefined();
			expect(result.value).toBe(version);
		});

		test("should fail validation for an invalid semantic version: 1", () => {
			/** Arrange */
			const schema = Joi.string().isValidSemanticVersion();
			const version = "1";

			/** Act */
			const result = schema.validate(version);

			/** Assert */
			expect(result.error).toBeDefined();
			expect(result.error).toHaveProperty(
				"message",
				"Invalid semantic version: Please use the following format for your semantic version strings [number].[number].[number]"
			);
		});

		test("should fail validation for an invalid semantic version: 1.0", () => {
			/** Arrange */
			const schema = Joi.string().isValidSemanticVersion();
			const version = "1.0";

			/** Act */
			const result = schema.validate(version);

			/** Assert */
			expect(result.error).toBeDefined();
			expect(result.error).toHaveProperty(
				"message",
				"Invalid semantic version: Please use the following format for your semantic version strings [number].[number].[number]"
			);
		});
	});
});
