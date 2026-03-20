import { sources } from "../sources";
import type { Fact } from "../types";
import type { ProcessingHistoryRecord } from "./types";
import z from "zod-v4";

/**
 * Processing History Facts
 * These facts map to the processing history fields that can be edited inline
 * Provides integration with the Banking > Processing History tab
 *
 * Override support:
 * - Overrides are stored via the standard fact override mechanism
 * - When an override exists, the override value replaces the source data
 */

// General Section Facts
const generalAnnualVolumeFact: Omit<Fact, "name"> = {
	description: "Annual processing volume (general)",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.general_data?.annual_volume
};

const generalMonthlyVolumeFact: Omit<Fact, "name"> = {
	description: "Monthly processing volume (general)",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.general_data?.monthly_volume
};

const generalAverageTicketSizeFact: Omit<Fact, "name"> = {
	description: "Average ticket size (general)",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.general_data?.average_ticket_size
};

const generalHighTicketSizeFact: Omit<Fact, "name"> = {
	description: "High ticket size (general)",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.general_data?.high_ticket_size
};

const generalDesiredLimitFact: Omit<Fact, "name"> = {
	description: "Desired processing limit (general)",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.general_data?.desired_limit
};

// Seasonal Section Facts
const seasonalHighVolumeMonthsFact: Omit<Fact, "name"> = {
	description: "High volume months for seasonal business",
	schema: z.array(z.string()).nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.seasonal_data?.high_volume_months
};

const seasonalExplanationFact: Omit<Fact, "name"> = {
	description: "Explanation for high volume months",
	schema: z.string().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.seasonal_data?.explanation_of_high_volume_months
};

// Visa/Mastercard/Discover Section Facts
const cardAnnualVolumeFact: Omit<Fact, "name"> = {
	description: "Annual volume for Visa/MC/Discover",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.card_data?.annual_volume
};

const cardMonthlyVolumeFact: Omit<Fact, "name"> = {
	description: "Monthly volume for Visa/MC/Discover",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.card_data?.monthly_volume
};

const cardAverageTicketSizeFact: Omit<Fact, "name"> = {
	description: "Average ticket size for Visa/MC/Discover",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.card_data?.average_ticket_size
};

const cardHighTicketSizeFact: Omit<Fact, "name"> = {
	description: "High ticket size for Visa/MC/Discover",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.card_data?.high_ticket_size
};

const cardDesiredLimitFact: Omit<Fact, "name"> = {
	description: "Desired limit for Visa/MC/Discover",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.card_data?.desired_limit
};

// American Express Section Facts
const amexAnnualVolumeFact: Omit<Fact, "name"> = {
	description: "Annual volume for American Express",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.american_express_data?.annual_volume
};

const amexMonthlyVolumeFact: Omit<Fact, "name"> = {
	description: "Monthly volume for American Express",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.american_express_data?.monthly_volume
};

const amexAverageTicketSizeFact: Omit<Fact, "name"> = {
	description: "Average ticket size for American Express",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.american_express_data?.average_ticket_size
};

const amexHighTicketSizeFact: Omit<Fact, "name"> = {
	description: "High ticket size for American Express",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.american_express_data?.high_ticket_size
};

const amexDesiredLimitFact: Omit<Fact, "name"> = {
	description: "Desired limit for American Express",
	schema: z.number().nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.american_express_data?.desired_limit
};

// Point of Sale Volume Section Facts
const posSwipedCardsFact: Omit<Fact, "name"> = {
	description: "Percentage of swiped card transactions",
	schema: z.number().min(0).max(100).nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.point_of_sale_data?.swiped_cards
};

const posTypedCardsFact: Omit<Fact, "name"> = {
	description: "Percentage of manually typed card transactions",
	schema: z.number().min(0).max(100).nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.point_of_sale_data?.typed_cards
};

const posECommerceFact: Omit<Fact, "name"> = {
	description: "Percentage of e-commerce transactions",
	schema: z.number().min(0).max(100).nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.point_of_sale_data?.e_commerce
};

const posMailTelephoneFact: Omit<Fact, "name"> = {
	description: "Percentage of mail/telephone transactions",
	schema: z.number().min(0).max(100).nullable(),
	source: sources.processingHistory,
	category: "banking",
	fn: async (_, data: ProcessingHistoryRecord) => data?.point_of_sale_data?.mail_telephone
};

// Export Processing History facts
export const processingHistoryFacts: readonly Fact[] = Object.freeze([
	// General Section
	{ ...generalAnnualVolumeFact, name: "general_annual_volume" } as Fact,
	{ ...generalMonthlyVolumeFact, name: "general_monthly_volume" } as Fact,
	{ ...generalAverageTicketSizeFact, name: "general_average_volume" } as Fact,
	{ ...generalHighTicketSizeFact, name: "general_high_ticket" } as Fact,
	{ ...generalDesiredLimitFact, name: "general_desired_limit" } as Fact,
	// Seasonal Section
	{ ...seasonalHighVolumeMonthsFact, name: "seasonal_high_volume_months" } as Fact,
	{ ...seasonalExplanationFact, name: "seasonal_explanation_of_high_volume_months" } as Fact,
	// Visa/Mastercard/Discover Section
	{ ...cardAnnualVolumeFact, name: "card_annual_volume" } as Fact,
	{ ...cardMonthlyVolumeFact, name: "card_monthly_volume" } as Fact,
	{ ...cardAverageTicketSizeFact, name: "card_average_volume" } as Fact,
	{ ...cardHighTicketSizeFact, name: "card_high_ticket" } as Fact,
	{ ...cardDesiredLimitFact, name: "card_desired_limit" } as Fact,
	// American Express Section
	{ ...amexAnnualVolumeFact, name: "amex_annual_volume" } as Fact,
	{ ...amexMonthlyVolumeFact, name: "amex_monthly_volume" } as Fact,
	{ ...amexAverageTicketSizeFact, name: "amex_average_volume" } as Fact,
	{ ...amexHighTicketSizeFact, name: "amex_high_ticket" } as Fact,
	{ ...amexDesiredLimitFact, name: "amex_desired_limit" } as Fact,
	// Point of Sale Volume Section
	{ ...posSwipedCardsFact, name: "pos_card_swiped" } as Fact,
	{ ...posTypedCardsFact, name: "pos_card_typed" } as Fact,
	{ ...posECommerceFact, name: "pos_ecommerce" } as Fact,
	{ ...posMailTelephoneFact, name: "pos_mail_telephone" } as Fact
]);
