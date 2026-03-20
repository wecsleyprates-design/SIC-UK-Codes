import {
	fetchDepositAccountInfo,
	getBusinessApplicants,
	getBusinessProcessingHistory,
	logger,
	redis,
	getBusinessKybDetails
} from "#helpers";
import { UUID } from "crypto";
import { businesses } from "../businesses/businesses";
import { EsignApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, TIN_BEHAVIOR } from "#constants";
import { Mapping } from "./mapping";
import { MAPPING_FIELDS, type MappingFields } from "./constants";

const FIELDS_MAPPING_EXPIRATION = 60 * 60 * 24 * 7; // 7 days in seconds

class FieldsMapping {
	async checkAndInsertMappingFields(businessID: UUID) {
		const redisData = await this.getMappingFieldsData(businessID);
		if (redisData) {
			logger.debug(`Mapping fields already exist in redis for businessID: ${businessID}`);
			return;
		}

		await this.insertMappingFields(businessID);
	}

	async insertMappingFields(businessID: UUID) {
		const redisKey: string = `{business}:${businessID}:{mapping_fields}`;

		// Create object with all fields set to null
		const mappingFieldsJson = MAPPING_FIELDS.reduce(
			(acc, key) => {
				acc[key] = null;
				return acc;
			},
			{} as Record<MappingFields, null>
		);

		// set data to redis
		await redis.setex(redisKey, JSON.stringify(mappingFieldsJson), FIELDS_MAPPING_EXPIRATION);
	}

	async getMappingFieldsData(businessID: UUID): Promise<Record<MappingFields, string | null> | null> {
		const redisKey: string = `{business}:${businessID}:{mapping_fields}`;

		// get data from redis
		return await redis.get(redisKey);
	}

	async updateMappingData(businessID: UUID, mappingData: Partial<Record<MappingFields, string | null>>) {
		const redisKey: string = `{business}:${businessID}:{mapping_fields}`;

		const redisData = await this.getMappingFieldsData(businessID);
		if (!redisData) {
			throw new EsignApiError(
				`Mapping fields data not found in redis for businessID: ${businessID}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		const updatedMappingFieldsJson = { ...redisData, ...mappingData };

		await redis.setex(redisKey, JSON.stringify(updatedMappingFieldsJson), FIELDS_MAPPING_EXPIRATION);
	}

	private async insertBusinessData(businessID: UUID) {
		const businessData = await businesses.getBusinessByID(
			{ businessID },
			{ fetch_owner_details: true, tinBehavior: TIN_BEHAVIOR.PLAIN }
		);

		const businessMapping = Mapping.getBusinessMapping(businessData);

		await this.updateMappingData(businessID, businessMapping);
	}

	private async insertApplicantData(businessID: UUID) {
		try {
			const applicantData = await getBusinessApplicants(businessID);
			const applicantMapping = Mapping.getApplicantMapping(applicantData);
			await this.updateMappingData(businessID, applicantMapping);
		} catch (_err) {
			logger.warn(`Auth service unavailable — skipping applicant data for businessID: ${businessID}`);
		}
	}

	private async insertCustomFieldsData(businessID: UUID) {
		const customFieldsData = await businesses.getCustomFieldsByBusinessId(businessID);

		const customFieldsMapping = Mapping.getCustomFieldsMapping(customFieldsData);

		await this.updateMappingData(businessID, customFieldsMapping);
	}

	private async insertKybFactsData(businessID: UUID) {
		try {
			const factsData = await getBusinessKybDetails(businessID);
			const kybFactsMapping = Mapping.getKybFactsMapping(factsData);
			await this.updateMappingData(businessID, kybFactsMapping);
		} catch (err) {
			logger.warn(`Error fetching KYB facts data for businessID: ${businessID}: ${err}`);
		}
	}

	private async insertDepositAccountData(businessID: UUID) {
		try {
			const depositAccountResult = await fetchDepositAccountInfo(businessID);
			const depositAccountMapping = Mapping.getDepositAccountMapping(depositAccountResult);
			await this.updateMappingData(businessID, depositAccountMapping);
		} catch (err) {
			logger.warn(`Error fetching deposit account data for businessID: ${businessID}: ${err}`);
		}
	}

	private async insertProcessingHistoryData(businessID: UUID) {
		const dataProcessingHistoryData = await getBusinessProcessingHistory(businessID);

		const dataProcessingHistoryMapping = Mapping.getBusinessDataProcessingHistoryMapping(dataProcessingHistoryData);

		await this.updateMappingData(businessID, dataProcessingHistoryMapping);
	}

	async insertAllMappingFieldsData(businessID: UUID) {
		// 1. insert all default mapping fields data to redis
		await this.checkAndInsertMappingFields(businessID);

		// 2. insert all business + owners data to redis
		await this.insertBusinessData(businessID);

		// 3. insert custom fields data to redis
		await this.insertCustomFieldsData(businessID);

		// 4. insert kyb facts data to redis
		await this.insertKybFactsData(businessID);

		// 5. insert deposit account data to redis
		await this.insertDepositAccountData(businessID);

		// 5. insert applicant data to redis
		await this.insertApplicantData(businessID);

		// 6. insert processing history data to redis
		await this.insertProcessingHistoryData(businessID);
	}
}

export const fieldsMapping = new FieldsMapping();
