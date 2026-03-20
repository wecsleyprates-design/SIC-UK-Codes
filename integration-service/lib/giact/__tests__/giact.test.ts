/**
 * Tests for GIACT class
 * Tests the core GIACT functionality including entity preparation
 */

import { GIACT } from "../giact";

describe("GIACT Class", () => {
	let giact: GIACT;

	beforeEach(() => {
		giact = new GIACT();
	});
	describe("private methods", () => {
		describe("prepareEntities", () => {
			it("should only return businessEntity and not personEntity", () => {
				const mockBusinessDetail = {
					data: {
						name: "Test Business Inc",
						tin: "123456789",
						address_line_1: "123 Business St",
						address_city: "Business City",
						address_state: "BC",
						address_postal_code: "12345",
						address_country: "US"
					}
				};

				const mockControlOwner = {
					first_name: "John",
					last_name: "Doe",
					ssn: "987654321",
					address_line_1: "456 Owner St"
				};

				const entities = giact['prepareEntities'](mockBusinessDetail, mockControlOwner, true); // omitPhoneAndAddressFlag = true

				// Should only return businessEntity
				expect(entities).toHaveProperty("businessEntity");
				expect(entities).not.toHaveProperty("personEntity");

				// Business entity should contain business info, not owner info
				const businessEntity = entities.businessEntity;
				expect(businessEntity.BusinessName).toBe("Test Business Inc");
				expect(businessEntity.FEIN).toBe("123456789");
				expect(businessEntity.BusinessName).not.toBe("John Doe");
			});
		});
	});
});
