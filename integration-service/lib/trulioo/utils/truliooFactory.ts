import { TruliooBusiness } from "../business/truliooBusiness";
import { TruliooPerson } from "../person/truliooPerson";
import type { IDBConnection } from "#types/db";

/**
 * Factory for creating Trulioo verification instances
 * Provides dynamic instantiation based on verification type
 */
export class TruliooFactory {
	/**
	 * Create a Trulioo verification instance based on type
	 * @param type - Type of verification ('business' or 'person')
	 * @param businessID - Business ID for the verification
	 * @param dbConnection - Optional database connection for business verification
	 * @returns Trulioo verification instance
	 */
	static create(
		type: "business" | "person",
		businessID: string,
		dbConnection?: IDBConnection
	): TruliooBusiness | TruliooPerson {
		switch (type) {
			case "business":
				return new TruliooBusiness(businessID, dbConnection);

			case "person":
				return new TruliooPerson(businessID, dbConnection);

			default:
				throw new Error(`Unsupported Trulioo verification type: ${type}`);
		}
	}

	/**
	 * Create a business verification instance
	 * @param businessID - Business ID for the verification
	 * @param dbConnection - Optional database connection
	 * @returns TruliooBusiness instance
	 */
	static createBusiness(businessID: string, dbConnection?: IDBConnection): TruliooBusiness {
		return new TruliooBusiness(businessID, dbConnection);
	}

	/**
	 * Create a person verification instance
	 * @param businessID - Business ID for the verification
	 * @param dbConnection - Optional database connection
	 * @returns TruliooPerson instance
	 */
	static createPerson(businessID: string, dbConnection?: IDBConnection): TruliooPerson {
		return new TruliooPerson(businessID, dbConnection);
	}

	/**
	 * Check if a verification type is supported
	 * @param type - Verification type to check
	 * @returns True if supported, false otherwise
	 */
	static isSupportedType(type: string): type is "business" | "person" {
		return type === "business" || type === "person";
	}

	/**
	 * Get all supported verification types
	 * @returns Array of supported types
	 */
	static getSupportedTypes(): ("business" | "person")[] {
		return ["business", "person"];
	}
}
