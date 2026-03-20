/**
 * Processing History data structure from the database
 * Represents a record from integration_data.data_processing_history
 */
export interface ProcessingHistoryRecord {
	id: string;
	case_id: string;
	general_data: {
		annual_volume?: number;
		monthly_volume?: number;
		average_ticket_size?: number;
		high_ticket_size?: number;
		desired_limit?: number;
	};
	seasonal_data: {
		high_volume_months?: string[];
		explanation_of_high_volume_months?: string;
	};
	card_data: {
		annual_volume?: number;
		monthly_volume?: number;
		average_ticket_size?: number;
		high_ticket_size?: number;
		desired_limit?: number;
	};
	american_express_data: {
		annual_volume?: number;
		monthly_volume?: number;
		average_ticket_size?: number;
		high_ticket_size?: number;
		desired_limit?: number;
	};
	point_of_sale_data: {
		swiped_cards?: number;
		typed_cards?: number;
		e_commerce?: number;
		mail_telephone?: number;
	};
}
