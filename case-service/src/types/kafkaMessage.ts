export namespace KafkaMessage {
	export interface CreateApplicant {
		user_id: string;
		customer_id?: string;
		applicant_id: string;
		case_id: string;
		business_name: string;
		business_id: string;
		case: "send_invite" | "link_applicant_to_customer" | "create_applicant";
		[keyof: string]: any;
	}

	export interface IntegrationDataUploaded {
		id: string;
		trigger: string;
		business_id: string;
		user_id: string;
		data: any;
		created_at: Date;
		task_id?: string;
		case_id?: string;
		customer_id?: string;
	}

	export interface MapperIntegrationDataUploaded extends IntegrationDataUploaded {
		data: { [keyof: string]: any };
		case_id: string;
		customer_id: string;
	}
}
