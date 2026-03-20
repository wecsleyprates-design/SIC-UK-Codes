export interface CreateSessionBody {
	templateId: string;
	signer: {
		id: string;
		email: string;
		fullName: string;
		title?: string;
	};
	documentFields: {
		legalName?: string;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		zip?: string;
		taxId?: string;
	};
}

export interface SignBody {
	templateId: string;
	signer: {
		id: string;
		email: string;
		fullName: string;
		title?: string;
	};
	documentFields: {
		legalName?: string;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		zip?: string;
		taxId?: string;
	};
	documentId: string;
}
