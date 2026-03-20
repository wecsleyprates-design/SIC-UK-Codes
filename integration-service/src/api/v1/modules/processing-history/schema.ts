import { z } from "zod";

export const ProcessingHistorySchema = z.object({
	case_id: z
		.string({
			required_error: "Case ID is required"
		})
		.uuid(),
	ocr_document_id: z.string().uuid().nullable().optional(),
	general_data: z
		.object({
			monthly_volume: z.number().optional(),
			annual_volume: z.number().optional(),
			high_ticket_size: z.number().optional(),
			average_ticket_size: z.number().optional(),
			monthly_occurrence_of_high_ticket: z.string().optional(),
			explanation_of_high_ticket: z.string().nullable().optional(),
			desired_limit: z.number().optional()
		})
		.optional(),
	seasonal_data: z
		.object({
			is_seasonal_business: z.boolean().optional(),
			high_volume_months: z.array(z.string()).nullable().optional(),
			explanation_of_high_volume_months: z.string().nullable().optional()
		})
		.optional(),
	visa_mastercard_discover: z
		.object({
			monthly_volume: z.number().optional(),
			annual_volume: z.number().optional(),
			average_ticket_size: z.number().optional(),
			high_ticket_size: z.number().optional(),
			desired_limit: z.number().optional()
		})
		.optional(),
	american_express: z
		.object({
			monthly_volume: z.number().optional(),
			annual_volume: z.number().optional(),
			average_ticket_size: z.number().optional(),
			high_ticket_size: z.number().optional(),
			desired_limit: z.number().optional()
		})
		.optional(),
	point_of_sale_volume: z
		.object({
			swiped_cards: z.number().min(0).max(100).optional(),
			typed_cards: z.number().min(0).max(100).optional(),
			e_commerce: z.number().min(0).max(100).optional(),
			mail_telephone: z.number().min(0).max(100).optional(),
		})
		.refine(
			data => {
				if (!data.swiped_cards && !data.typed_cards && !data.e_commerce && !data.mail_telephone) {
					return true;
				}
				const total = (data.swiped_cards || 0) + (data.typed_cards || 0) + (data.e_commerce || 0) + (data.mail_telephone || 0);
				return total === 100;
			},
			{
				message: "The sum of Card (Swiped), Manual Entry, eCommerce and Mail & Phone must be exactly 100 percentage.",
				path: ["point_of_sale_volume"]
			}
		)
		.optional(),
		file_name: z.string().nullable().optional()
});

export type ProcessingHistoryType = z.infer<typeof ProcessingHistorySchema>;

export const schema = {
	getProcessingHistory: z.object({
		params: z.object({
			businessId: z
				.string({
					required_error: "Business ID is required"
				})
				.uuid()
		}),
		query: z.object({
			case_id: z.string({ required_error: "Case ID is required" }).uuid().optional()
		})
	}),
	addProcessingHistory: z.object({
		params: z.object({
			businessId: z
				.string({
					required_error: "Business ID is required"
				})
				.uuid()
		}),
		body: ProcessingHistorySchema
	})
};
