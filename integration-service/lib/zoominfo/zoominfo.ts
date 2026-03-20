/* Basic implementation of building to ZoomInfo's dataset stored in Redshift */

import { uploadRawIntegrationDataToS3 } from "#common/common";
import { DIRECTORIES, EVENTS, INTEGRATION_ID, QUEUES, type EventEnum } from "#constants";
import { logger, executeAndUnwrapRedshiftQuery } from "#helpers/index";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types/db";
import { BusinessEntityVerificationService as BusinessEntityVerification } from "#api/v1/modules/verification/businessEntityVerification";
import { type TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import type { MatchResult, ZoomInfoResponse, FirmographicResult, ZoomInfoEntityMatchTask } from "./types";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { EntityMatching } from "#lib/entityMatching/entityMatching";
import type { ZoomInfoFirmographicsEvent } from "@joinworth/types/dist/types/kafka/entity_matching.v1/FirmographicsEvent";
import { MAX_CONFIDENCE_INDEX } from "#lib/facts/sources";
import { UUID } from "crypto";
import { isZoomInfoMetadata } from "#api/v1/modules/core/handlers/rerunIntegrations/adapters/typeguards";

export class ZoomInfo extends BusinessEntityVerification {
	public static BULK_NAMED_JOB: EventEnum = EVENTS.ZOOMINFO_MATCH;
	public static BULK_NAMED_QUEUE = QUEUES.ZOOMINFO;
	public readonly MIN_INDEX = 45;
	protected static readonly PLATFORM_ID = INTEGRATION_ID.ZOOMINFO;
	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
	}
	taskHandlerMap: TaskHandlerMap = {
		fetch_business_entity_verification: async taskId => {
			logger.debug("fetch ZoomInfo");
			const task = await ZoomInfo.getEnrichedTask<ZoomInfoEntityMatchTask | ZoomInfoResponse>(taskId);
			const isEntityMatchingEnabled = await EntityMatching.isEnabled(ZoomInfo.PLATFORM_ID);
			if (!EntityMatching.isEntityMatchingTask(task) || !isEntityMatchingEnabled) {
				return await this.fetchZoomInfo(taskId);
			}
			return await this.processEntityMatching(task as IBusinessIntegrationTaskEnriched<ZoomInfoEntityMatchTask>);
		}
	};

	public async processFirmographicsEvent(task: IBusinessIntegrationTaskEnriched<ZoomInfoEntityMatchTask>, payload: ZoomInfoFirmographicsEvent): Promise<void> {
		const firmographic = payload.firmographics?.comp_standard_global[0] ?? {};
		if (!firmographic) {
			logger.error({ task_id: task.id, payload }, "No firmographic found for match");
			throw new VerificationApiError("No firmographic found for match");
		}
		const { zi_c_company_id, zi_c_location_id, zi_es_location_id } = firmographic;
		if (!zi_c_company_id || !zi_c_location_id || !zi_es_location_id) {
			// if we don't have these three things then we somehow got a message with a firmographic that is not valid
			logger.error({ task_id: task.id, payload }, "No firmographic found for match");
			throw new VerificationApiError("No firmographic found for match");
		}
		const externalId = zi_c_company_id + ":" + zi_c_location_id + ":" + zi_es_location_id;

		const newMetadata: ZoomInfoEntityMatchTask = {
			match_id: payload.match_id as UUID,
			prediction: payload.prediction,
			match: task.metadata?.match ?? {
				collected_at: new Date(),
				company_id: zi_c_company_id.toString(),
				location_id: zi_c_location_id.toString(),
				es_location_id: zi_es_location_id,
				index: MAX_CONFIDENCE_INDEX,
				name: firmographic.zi_c_name,
				address: firmographic.zi_c_street,
				city: firmographic.zi_c_city,
				state: firmographic.zi_c_state,
				zip: firmographic.zi_c_zip,
				source: "zoominfo",
				zip3: firmographic.zi_c_zip.slice(0, 3),
				state_code: firmographic.zi_c_state,
				normalised_address: firmographic.zi_c_street + " " + firmographic.zi_c_city + " " + firmographic.zi_c_state + " " + firmographic.zi_c_zip,
				street_number: parseInt(firmographic.zi_c_street.split(" ")?.[0]),
				street_name: firmographic.zi_c_street.split(" ")?.[1],
				normalised_address_2: firmographic.zi_c_street_2 ?? "",
				company_number: firmographic.zi_c_company_id.toString() ?? "",
				short_name: firmographic.zi_c_name ?? "",
				jurisdiction_code: "",
				extra_verification: {
					npi_match: null,
					name_match: null,
					canada_open_business_number_match: null,
					canada_open_corporate_id_match: null
				}
			},
			all_matches: task.metadata?.all_matches ?? null,
			...task.metadata,
			firmographic,
			match_mode: "ai"
		};
		await Promise.all([
			this.updateTask(task.id, { reference_id: externalId, metadata: newMetadata }),
			this.saveRequestResponse<ZoomInfoEntityMatchTask>(task, newMetadata, externalId),
			this.saveToS3(newMetadata, "match", DIRECTORIES.BUSINESS_ENTITY_VERIFICATION, "ZOOMINFO")
		]);

		logger.info({ task_id: task.id, payload }, "Firmographics event processed");
	}

	public async processEntityMatching(task: IBusinessIntegrationTaskEnriched<ZoomInfoEntityMatchTask>): Promise<boolean> {
		try {
			logger.debug(`Processing ZoomInfo entity matching for businessId=${this.dbConnection?.business_id} taskId=${task.id}`);
			if (!task.metadata || !task.metadata.match_id) {
				logger.error(`Task not setup as an EntityMatching Task taskId=${task.id} businessId=${this.dbConnection?.business_id}`);
				throw new VerificationApiError("Not an entity matching task");
			}
			if (!task.metadata.match) {
				logger.debug(`No match found for businessId=${this.dbConnection?.business_id} taskId=${task.id} - Throwing VerificationApiError`);
				throw new VerificationApiError("No Match Found");
			}
			if (this.isBelowMinimumPredictionScore(task)) {
				logger.warn(`Prediction score of ${task.metadata.prediction} is below the minimum threshold of ${ZoomInfo.MINIMUM_PREDICTION_SCORE}, not using as basis for match`);
				throw new VerificationApiError("Below minimum threshold");
			}
			const {
				match: { location_id: zi_c_location_id, company_id: zi_c_company_id, es_location_id: zi_es_location_id }
			} = task.metadata;
			const firmographic = await this.getFirmographic(zi_c_location_id, zi_c_company_id, zi_es_location_id);
			if (!firmographic) {
				logger.error({ business_id: this.dbConnection?.business_id, task_id: task.id, match: task.metadata.match }, "No firmographic found for match");
				throw new VerificationApiError("No firmographic found for match");
			}
			const externalId = zi_c_company_id + ":" + zi_c_location_id + ":" + zi_es_location_id;
			const newMetadata: ZoomInfoEntityMatchTask = { ...task.metadata, firmographic, match_mode: "ai" };
			await Promise.all([this.updateTask(task.id, { reference_id: externalId, metadata: newMetadata }), this.saveRequestResponse<ZoomInfoEntityMatchTask>(task, newMetadata, externalId)]);
			try {
				await uploadRawIntegrationDataToS3(newMetadata, task.business_id, "match", DIRECTORIES.BUSINESS_ENTITY_VERIFICATION, "ZOOMINFO");
			} catch (ex) {
				logger.error({ error: ex, task_id: task.id }, "task could not upload entry to S3");
			}
			return true;
		} catch (ex) {
			if (ex instanceof VerificationApiError) {
				logger.warn(`Entity Matching could not return a result for taskId=${task.id} businessId=${this.dbConnection?.business_id} -- Running heuristic match`);
				await this.setMatchMode(task.id, "heuristic");
				return await this.fetchZoomInfo(task.id);
			}
			throw ex;
		}
	}

	public fetchZoomInfo = async (taskId): Promise<boolean> => {
		const businessId = this.getDBConnection()?.business_id;
		if (!businessId) {
			return false;
		}
		const task = await ZoomInfo.getEnrichedTask(taskId);
		const query = await this.buildSearchQuery(businessId, task.metadata);
		const match = await this.executeMatchSearchQuery<MatchResult>(query);
		if (match?.length === 0 || !match?.[0]?.index) {
			const newMetadata = { ...task.metadata, match: null };
			await this.updateTask(taskId, { metadata: newMetadata });
			logger.debug(`No ZoomInfo match found for businessId=${businessId}`);
			return true;
		}
		let newMetadata = { ...task.metadata, match: match[0] };
		if (match[0].index < this.MIN_INDEX) {
			logger.debug(
				{ business_id: businessId, similarity_index: match[0].index, min_index: this.MIN_INDEX, match: match[0] },
				"ZoomInfo match found for business but similarity index is below threshold"
			);
			await this.updateTask(taskId, { metadata: newMetadata });
			return true;
		}
		const { zi_c_location_id, zi_c_company_id, zi_es_location_id } = match[0];
		const firmographic = await this.getFirmographic(zi_c_location_id, zi_c_company_id, zi_es_location_id);
		newMetadata = { ...newMetadata, firmographic, match_mode: "heuristic" };
		const externalId = newMetadata.match?.zi_c_company_id + ":" + newMetadata.match?.zi_c_location_id + ":" + newMetadata.match?.zi_es_location_id;
		await Promise.all([this.updateTask(taskId, { metadata: newMetadata }), this.saveRequestResponse<ZoomInfoResponse>(task, newMetadata, externalId)]);
		try {
			await uploadRawIntegrationDataToS3(newMetadata, businessId, "match", DIRECTORIES.BUSINESS_ENTITY_VERIFICATION, "ZOOMINFO");
		} catch (ex) {
			logger.error({ error: ex, task_id: taskId }, "task could not upload entry to S3");
		}
		return true;
	};

	private async buildSearchQuery(businessId: string, metadata?: unknown) {
		const { zip3, addresses, names, name2 } = isZoomInfoMetadata(metadata)
			? metadata
			: await this.getUniqueNamesAndAddresses(businessId);
		const addressComponents = addresses.map(address => `SELECT JSON_PARSE(addr('${address}')) as suppliedAddress`);
		const nameComponents = names.map(name => `SELECT CAST('${this.sanitizeBusinessName(name)}' AS VARCHAR) as suppliedName`);
		if (addressComponents.length === 0 || nameComponents.length === 0) {
			throw new Error("No addresses or names found for business");
		}
		const query = `
			WITH supplied_names AS (
				${nameComponents.join(" UNION ")}
			),
			supplied_addresses AS (
				${addressComponents.join(" UNION ")}
			),
			filtered_data AS (
				SELECT
					z.zi_c_location_id,
					z.zi_c_company_id,
					z.zi_es_location_id,
					z.line1,
					z.city,
					z.state,
					z.zip,
					z.name,
					names.suppliedName::text,
					addresses.suppliedAddress::super
				FROM
					zoominfo.normalized_usca_matview z
				CROSS JOIN supplied_names names
				CROSS JOIN supplied_addresses addresses
				WHERE
					zip3 in (${zip3.map(z => `'${z}'`).join(",")})
					and name2 in (${name2.map(n => `'${n}'`).join(",")})
					AND z.line1 IS NOT NULL
					AND z.name IS NOT NULL
			),
			calculated_index AS (
				SELECT
					fd.*,
					calculate_similarity_index_udf(
						fd.name::text,
						fd.suppliedName::Text,
						fd.line1::text,
						fd.suppliedAddress.line1::text,
						fd.city::text,
						fd.suppliedAddress.city::text,
						fd.state::text,
						fd.suppliedAddress.state::text,
						fd.zip::text,
						fd.suppliedAddress.zip::text
					) AS index
				FROM
					filtered_data fd
			)
			SELECT
				*
			FROM
				calculated_index
			WHERE
				index > 20
			ORDER BY
				index DESC,
				(CASE WHEN lower(name) = lower(suppliedName) THEN 1 ELSE 0 END) DESC
			LIMIT 10;`;
		logger.info(query);
		return query;
	}
	/***
	 * Get firmographic data for a company
	 * @returns {Promise<FirmographicResult>}
	 */
	private async getFirmographic(zi_c_location_id: string, zi_c_company_id: string, zi_es_location_id): Promise<FirmographicResult | null> {
		const query = `
			SELECT *
			FROM zoominfo.comp_standard_global
			WHERE (
				zi_c_location_id = '${zi_c_location_id}' 
				AND zi_c_company_id = '${zi_c_company_id}' 
				AND zi_es_location_id = '${zi_es_location_id}'
			)
			`;
		const result = await executeAndUnwrapRedshiftQuery<FirmographicResult>(query);
		if (result.length === 0) {
			return null;
		}
		return result[0];
	}
}
