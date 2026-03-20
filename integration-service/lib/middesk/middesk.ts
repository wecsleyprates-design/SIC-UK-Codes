import { envConfig } from "#configs/index";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { logger } from "#helpers/index";
import { isNonEmptyArray, isNotNull } from "@austinburns/type-guards";
import { VerificationApiError } from "../../src/api/v1/modules/verification/error";
import { ERROR_CODES } from "#constants/error-codes.constant";

import { BusinessEntityVerificationParams, CreateBusinessEntityPayload, BusinessEntityVerificationResponse, UpdateBusinessEntityPayload, BusinessEntityWebsiteResponse } from "./schema";
import { UUID } from "crypto";
import { MiddeskCreateBusinessPayload, MiddeskUpdateBusinessPayload } from "../../src/api/v1/modules/verification/types";

class Middesk {
	async call<T>({ method, url, data = null }: { method: AxiosRequestConfig["method"]; url: string; data?: AxiosRequestConfig["data"] }): Promise<T> {
		try {
			const config: AxiosRequestConfig = {
				method,
				url,
				headers: {
					"Content-Type": "application/json",
					Authorization: "Basic " + btoa(`${envConfig.MIDDESK_API_KEY!}:`)
				}
			};
			if (isNotNull(data)) {
				config.data = data;
			}
			const response = await axios.request<T>(config);
			return response.data;
		} catch (error: unknown) {
			if (axios.isAxiosError(error)) {
				logger.error({ error: error }, "Error in Middesk API call");
				const typedError = error as AxiosError<{
					errors: Array<Record<"message", string>>;
				}>;
				const reportedError = typedError.response?.data ?? null;
				if (isNonEmptyArray(reportedError?.errors)) {
					throw new VerificationApiError(reportedError?.errors[0].message, typedError.response?.status ?? error.status, ERROR_CODES.INVALID);
				}
			}
			throw error;
		}
	}

	async orderBusinessEntityVerification(params: BusinessEntityVerificationParams, payload: MiddeskCreateBusinessPayload) {
		return await this.call<BusinessEntityVerificationResponse>({
			method: "post",
			url: `${envConfig.MIDDESK_BASE_URL}/businesses`,
			data: {
				// used for cross referencing the internal business uuid within our system
				// especially helpful for knowing which business records to update within our DB upon recieving webhook events
				// also useful for ensuring a verification order for the business isn't created more than once with the vendor
				unique_external_id: params.businessID,
				...payload
			}
		});
	}

	async updateBusinessEntityDetails({ external_id }: { external_id: string }, payload: MiddeskUpdateBusinessPayload) {
		return await this.call<BusinessEntityVerificationResponse>({
			method: "patch",
			url: `${envConfig.MIDDESK_BASE_URL}/businesses/${external_id}`,
			data: payload
		});
	}

	async getBusinessEntityVerificationStatus(params: BusinessEntityVerificationParams) {
		return await this.call<BusinessEntityVerificationResponse>({
			method: "get",
			url: `${envConfig.MIDDESK_BASE_URL}/businesses/${params.businessID}`
		});
	}

	async getBusinessEntityWebsiteDetails(businessID: UUID) {
		return await this.call<BusinessEntityWebsiteResponse>({
			method: "get",
			url: `${envConfig.MIDDESK_BASE_URL}/businesses/${businessID}/website`
		});
	}

	async createOrder(businessID: UUID, payload: { package: string; subproducts: string[] }) {
		return await this.call({
			method: "post",
			url: `${envConfig.MIDDESK_BASE_URL}/businesses/${businessID}/orders`,
			data: payload
		});
	}
}

export const middesk = new Middesk();
