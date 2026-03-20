export namespace BusinessEntityReview {
	type UUID = string;
	type TDateISO = string;

	export interface Task {
		id: UUID;
		business_entity_verification_id: UUID;
		created_at: TDateISO;
		updated_at: TDateISO;
		category: string;
		key: string;
		status: string;
		message: string;
		label: string;
		sublabel: string;
		metadata: Array<{
			id: UUID;
			type: string;
		}>;
	}
}
