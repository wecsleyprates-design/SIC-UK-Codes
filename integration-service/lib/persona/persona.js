import { envConfig } from "#configs/index";
import { Persona as Api } from "@flexbase/persona-node-client";

export class Persona {
	constructor(apiKey) {
		this.client = new Api(apiKey, {
			personaVersion: envConfig.PERSONA_VERSION,
			keyInflection: "snake"
		});
	}

	async createInquiry(referenceId) {
		const response = await this.client.inquiry.create({
			inquiryTemplateId: envConfig.PERSONA_INQUIRY_TEMPLATE_ID,
			countryCode: "US",
			referenceId
		});
		return response;
	}

	async getInquiry(inquiryId) {
		const response = await this.client.inquiry.byId(inquiryId);
		return response;
	}

	async resumeInquiry(inquiryId) {
		const response = await this.client.inquiry.resume(inquiryId);
		return response;
	}

	async deleteInquiry(inquiryId) {
		const response = await this.client.inquiry.delete(inquiryId);
		return response;
	}

	async retrieveVerificationDetails(verificationID) {
		const response = await this.client.verification.byId(verificationID);
		return response;
	}
}
