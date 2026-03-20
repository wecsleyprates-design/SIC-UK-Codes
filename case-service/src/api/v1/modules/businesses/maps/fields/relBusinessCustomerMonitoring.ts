import type { MapperField } from "#types";
import { assertTruthy } from "../utils";

export const relBusinessCustomerMonitoringFields: MapperField[] = [
	{
		column: "external_id",
		required: false,
		sanitize: async (_, str) => {
			if (!str) return null;
			return (str as string)
				.toString()
				.replace(/[^A-Za-z0-9\-_:.#]/g, "")
				.substring(0, 50);
		},
		validate: async (_, field) => {
			if (field.value === null || field.value === undefined) {
				return;
			}
			assertTruthy(typeof field.value === "string" && field.value.length <= 50 && field.value.length > 0, field);
		},
		description: "A customer's external identifier for this business - limited to 50 characters",
		table: "rel_business_customer_monitoring",
		alternate: ["customer_unique_identifier"]
	},
	{
		column: "metadata",
		description: "The customer's (optional) additional metadata for the business",
		table: "rel_business_customer_monitoring",
		isDefault: true,
		dataType: "json",
		concat: true
	},
	{ column: "business_id", table: "rel_business_customer_monitoring", private: true },
	{ column: "customer_id", table: "rel_business_customer_monitoring", private: true },
	{ column: "created_at", table: "rel_business_customer_monitoring", private: true },
	{ column: "created_by", table: "rel_business_customer_monitoring", private: true },
	{ column: "is_monitoring_enabled", table: "rel_business_customer_monitoring", private: true }
];
