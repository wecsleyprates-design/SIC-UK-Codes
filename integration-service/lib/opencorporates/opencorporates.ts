/* Basic implementation of building to OpenCorporates' dataset stored in Redshift */

import { uploadRawIntegrationDataToS3 } from "#common/common";
import { DIRECTORIES, EVENTS, INTEGRATION_ID, QUEUES, type EventEnum } from "#constants";
import { logger, executeAndUnwrapRedshiftQuery } from "#helpers/index";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types/db";
import { type TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import { BusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import type {
	MatchResult,
	FirmographicResult,
	OfficerResult,
	OpenCorporateResponse,
	NameResult,
	AddressResult,
	OpenCorporateEntityMatchTask,
	BuildOpenCorporatesSearchQueryMetadata
} from "./types";
import { isCanadianAddress } from "#utils/canadianProvinces";
import { EntityMatching } from "#lib/entityMatching/entityMatching";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import type { OpenCorporatesFirmographicsEvent } from "@joinworth/types/dist/types/kafka/entity_matching.v1/FirmographicsEvent";
import { MAX_CONFIDENCE_INDEX } from "#lib/facts/sources";
import { isOpenCorporatesMetadata } from "#api/v1/modules/core/handlers/rerunIntegrations/adapters/typeguards";

export class OpenCorporates extends BusinessEntityVerificationService {
	public readonly MIN_INDEX = 45;
	public readonly CANADA_MIN_INDEX = 40;
	public static BULK_NAMED_JOB: EventEnum = EVENTS.OPEN_CORPORATES_MATCH;
	public static BULK_NAMED_QUEUE = QUEUES.OPEN_CORPORATES;
	protected static readonly PLATFORM_ID = INTEGRATION_ID.OPENCORPORATES;
	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
	}
	taskHandlerMap: TaskHandlerMap = {
		fetch_business_entity_verification: async taskId => {
			logger.debug("fetch OpenCorporates");
			const task = await OpenCorporates.getEnrichedTask<OpenCorporateEntityMatchTask | OpenCorporateResponse>(taskId);
			const isEntityMatchingEnabled = await EntityMatching.isEnabled(OpenCorporates.PLATFORM_ID);
			if (!EntityMatching.isEntityMatchingTask(task) || !isEntityMatchingEnabled) {
				return await this.fetchOpenCorporates(taskId);
			}
			return await this.processEntityMatching(task as IBusinessIntegrationTaskEnriched<OpenCorporateEntityMatchTask>);
		}
	};

	protected convertKafkaEventPayloadToLegacyMetadata(
		task: IBusinessIntegrationTaskEnriched<OpenCorporateEntityMatchTask>,
		payload: OpenCorporatesFirmographicsEvent
	): OpenCorporateEntityMatchTask {
		const [firmographics, ...sosFilings] = payload.firmographics?.companies ?? [];
		if (!firmographics.company_number || !firmographics.jurisdiction_code) {
			logger.error({ payload }, "No firmographic found for match");
			throw new VerificationApiError("No firmographic found for match");
		}

		const combinedNames: NameResult[] = payload.firmographics.alternative_names.map(name => ({
			...name,
			source: "alternate"
		}));
		combinedNames.push({
			jurisdiction_code: firmographics.jurisdiction_code,
			company_number: firmographics.company_number,
			name: firmographics.name,
			source: "companies"
		});

		const combinedAddresses: AddressResult[] = payload.firmographics.non_reg_addresses.map(address => ({
			...address,
			zip: address.postal_code,
			line1: address.street_address,
			city: address.locality,
			state: address.region,
			zip2: address.postal_code,
			zip3: address.postal_code,
			zip4: address.postal_code,
			source: "alternate",
			normalized_address:
				address.street_address + " " + address.locality + " " + address.region + " " + address.postal_code
		}));
		combinedAddresses.push({
			jurisdiction_code: firmographics.jurisdiction_code,
			company_number: firmographics.company_number,
			address: firmographics["registered_address.in_full"],
			normalized_address: firmographics["registered_address.in_full"],
			zip: firmographics["registered_address.postal_code"],
			line1: firmographics["registered_address.street_address"],
			city: firmographics["registered_address.locality"],
			state: firmographics["registered_address.region"],
			zip2: firmographics["registered_address.postal_code"],
			zip3: firmographics["registered_address.postal_code"],
			zip4: firmographics["registered_address.postal_code"],
			source: "companies"
		});
		return {
			match_id: payload.match_id,
			prediction: payload.prediction ?? MAX_CONFIDENCE_INDEX,
			match: task.metadata?.match ?? {
				company_number: firmographics.company_number,
				jurisdiction_code: firmographics.jurisdiction_code,
				normalized_name: firmographics.name,
				address: firmographics["registered_address.in_full"],
				normalized_address: firmographics["registered_address.in_full"],
				index: MAX_CONFIDENCE_INDEX
			},
			all_matches: task.metadata?.all_matches ?? null,
			...task.metadata,
			firmographic: firmographics,
			names: combinedNames,
			addresses: combinedAddresses ?? [],
			officers: payload.firmographics?.officers ?? [],
			sosFilings,
			identifiers: payload.firmographics?.additional_identifiers ?? [],
			match_mode: "ai"
		} as OpenCorporateEntityMatchTask;
	}

	public async processFirmographicsEvent(
		task: IBusinessIntegrationTaskEnriched<OpenCorporateEntityMatchTask>,
		payload: OpenCorporatesFirmographicsEvent
	): Promise<void> {
		const newMetadata: OpenCorporateEntityMatchTask = this.convertKafkaEventPayloadToLegacyMetadata(task, payload);
		const externalId = newMetadata.firmographic?.jurisdiction_code + ":" + newMetadata.firmographic?.company_number;
		logger.debug({ task_id: task.id, newMetadata, task }, "New metadata");

		await Promise.all([
			this.updateTask(task.id, { reference_id: externalId, metadata: newMetadata }),
			this.saveRequestResponse<OpenCorporateEntityMatchTask>(task, newMetadata, externalId),
			this.saveToS3(newMetadata, "match", DIRECTORIES.BUSINESS_ENTITY_VERIFICATION, "OPENCORPORATES")
		]);

		logger.info({ task_id: task.id, payload }, "Firmographics event processed");
	}

	public async processEntityMatching(
		task: IBusinessIntegrationTaskEnriched<OpenCorporateEntityMatchTask>
	): Promise<boolean> {
		try {
			logger.debug(
				`Processing OpenCorporates entity matching for businessId=${this.dbConnection?.business_id} taskId=${task.id}`
			);
			if (!task.metadata || !task.metadata.match_id) {
				logger.error(
					`Task not setup as an EntityMatching Task taskId=${task.id} businessId=${this.dbConnection?.business_id}`
				);
				throw new VerificationApiError("Not an entity matching task");
			}
			if (!task.metadata.match) {
				logger.debug(
					`No match found for businessId=${this.dbConnection?.business_id} taskId=${task.id} - Throwing VerificationApiError`
				);
				throw new VerificationApiError("No Match Found");
			}
			if (this.isBelowMinimumPredictionScore(task)) {
				logger.warn(
					`Prediction score of ${task.metadata.prediction} is below the minimum threshold of ${OpenCorporates.MINIMUM_PREDICTION_SCORE}, not using as basis for match`
				);
				throw new VerificationApiError("Below minimum threshold");
			}

			const {
				match: { company_number, jurisdiction_code }
			} = task.metadata;
			const [[firmographic, sosFilings], names, addresses, officers] = await Promise.all([
				this.getFirmographic(company_number, jurisdiction_code),
				this.getNames(company_number, jurisdiction_code),
				this.getAddresses(company_number, jurisdiction_code),
				this.getOfficers(company_number, jurisdiction_code)
			]);
			const newMetadata: OpenCorporateEntityMatchTask = {
				...task.metadata,
				firmographic,
				names,
				addresses,
				officers,
				sosFilings,
				match_mode: "ai"
			};
			const externalId = jurisdiction_code + ":" + company_number;
			await Promise.all([
				this.updateTask(task.id, { metadata: newMetadata }),
				this.saveRequestResponse<OpenCorporateEntityMatchTask>(task, newMetadata, externalId)
			]);
			try {
				await uploadRawIntegrationDataToS3(
					newMetadata,
					task.business_id,
					"match",
					DIRECTORIES.BUSINESS_ENTITY_VERIFICATION,
					"OPENCORPORATES"
				);
			} catch (ex) {
				logger.error({ error: ex, task_id: task.id }, "could not upload entry to S3");
			}

			return true;
		} catch (error: any) {
			if (error instanceof VerificationApiError) {
				logger.warn(
					{ task_id: task.id, business_id: this.dbConnection?.business_id },
					"Entity Matching could not return a result -- Running heuristic match"
				);
				await this.setMatchMode(task.id, "heuristic");
				return await this.fetchOpenCorporates(task.id);
			}
			logger.error({ error }, "Error processing OpenCorporates entity matching");
			throw error;
		}
	}

	public fetchOpenCorporates = async (taskId): Promise<boolean> => {
		const businessId = this.getDBConnection()?.business_id;
		if (!businessId) {
			return false;
		}
		const task = await OpenCorporates.getEnrichedTask(taskId);
		const query = await this.generateBusinessSearchQuery(businessId, task.metadata);
		const match = await this.executeMatchSearchQuery<MatchResult>(query);
		if (match?.length === 0 || !match?.[0]?.index) {
			const newMetadata = { ...task.metadata, match: null };
			await this.updateTask(taskId, { metadata: newMetadata });
			logger.debug(`No OpenCorporate match found for businessId=${businessId}`);
			return false;
		}
		let newMetadata = { ...task.metadata, match: match[0] };

		// Check if the address is Canadian. If so, use the Canada threshold, which is much lower than the US threshold for OpenCorporates
		const isCanada = isCanadianAddress(match[0].address);

		const thresholdIndex = isCanada ? this.CANADA_MIN_INDEX : this.MIN_INDEX;
		if (match[0].index < thresholdIndex) {
			logger.debug(
				{ business_id: businessId, match: match[0], similarity_index: match[0].index, thresholdIndex },
				"OpenCorporate match found but below threshold"
			);
			await this.updateTask(taskId, { metadata: newMetadata });
			return false;
		}

		logger.debug(
			{ business_id: businessId, match: match[0], similarity_index: match[0].index },
			"Submitting OpenCorporates match"
		);
		const { company_number, jurisdiction_code } = match[0];
		const [[firmographic, sosFilings], names, addresses, officers] = await Promise.all([
			this.getFirmographic(company_number, jurisdiction_code),
			this.getNames(company_number, jurisdiction_code),
			this.getAddresses(company_number, jurisdiction_code),
			this.getOfficers(company_number, jurisdiction_code)
		]);
		newMetadata = { ...newMetadata, firmographic, names, addresses, officers, sosFilings };
		const externalId = newMetadata.match?.jurisdiction_code + ":" + newMetadata.match?.company_number;
		await Promise.all([
			this.updateTask(taskId, { metadata: newMetadata }),
			this.saveRequestResponse<OpenCorporateResponse>(task, newMetadata, externalId)
		]);
		try {
			await uploadRawIntegrationDataToS3(
				newMetadata,
				businessId,
				"match",
				DIRECTORIES.BUSINESS_ENTITY_VERIFICATION,
				"OPENCORPORATES"
			);
		} catch (ex) {
			logger.error({ error: ex, task_id: taskId }, "could not upload entry to S3");
		}
		return true;
	};

	private async generateBusinessSearchQuery(
		businessId: string,
		metadata: BuildOpenCorporatesSearchQueryMetadata | undefined
	) {
		let searchQueryData: BuildOpenCorporatesSearchQueryMetadata | undefined;

		if (isOpenCorporatesMetadata(metadata)) {
			searchQueryData = metadata;
		} else {
			const { zip3, name2, names, addresses, country } = await this.getUniqueNamesAndAddresses(businessId);
			let isCanada = false;

			country.map(c => {
				if (["ca", "can", "canada"].some(sub => c.toLowerCase().includes(sub))) {
					isCanada = true;
				}
			});
			searchQueryData = { zip3, name2, names, addresses, country, hasCanadianAddress: isCanada };
		}

		let query = "";
		if (searchQueryData.hasCanadianAddress) {
			// fallback on new query for Canada Search
			logger.debug("Canada search executing...");
			query = await this.buildCanadaSearchQuery(searchQueryData);
			//todo: implement Canada search
		} else {
			logger.debug("US search executing...");
			query = await this.buildUSSearchQuery(searchQueryData);
		}

		return query;
	}

	private async buildUSSearchQuery({
		zip3,
		name2,
		names,
		addresses
	}: {
		zip3: string[];
		name2: string[];
		names: string[];
		addresses: string[];
	}) {
		const addressComponents = addresses.map(address => `SELECT JSON_PARSE(addr('${address}')) as suppliedAddress`);
		const nameComponents = names.map(
			name => `SELECT CAST('${this.sanitizeBusinessName(name)}' as text) as suppliedName`
		);
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
			n.company_number,
			n.jurisdiction_code,
			n.normalized_name,
			a.address,
			a.normalized_address,
			a.state,
			a.line1,
			a.city,
			a.zip,
			names.suppliedName::text,
			addresses.suppliedAddress::super
			from open_corporate.us_names_matview n
			FULL JOIN open_corporate.us_addresses_matview a on a.jurisdiction_code=n.jurisdiction_code and a.company_number=n.company_number
			CROSS JOIN supplied_names names
			CROSS JOIN supplied_addresses addresses
			WHERE 
				zip3 in (${zip3.map(z => `'${z}'`).join(",")})
				and name2 in (${name2.map(n => `'${n}'`).join(",")})
				and nullif(address,'') is not null 
		),
		calculated_index AS (
			SELECT 
				fd.*,
				calculate_similarity_index_udf(
					fd.normalized_name::text,
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
		-- Prefer jurisdiction that matches state used for match
			(CASE WHEN lower(calculated_index.jurisdiction_code) = 'us_'||lower(calculated_index.state) THEN 1 ELSE 0 END) DESC 
		LIMIT 10;`;
		logger.debug(query);
		return query;
	}

	// NOTE: this is throwaway code with the intention of being replaced with a proper unified query
	// THIS IS A TEMP SOLUTION UNTIL WE GET AI MATCHING WORKING
	// The only consistent pieces of data we could use to match heuristically were:
	// Business name, street number and the beginning of the street string.
	// We're purposely heavily weighing the name, then the street number.
	private async buildCanadaSearchQuery({
		name2,
		names,
		addresses
	}: {
		name2: string[];
		names: string[];
		addresses: string[];
	}) {
		//Enhanced query with all original columns but focusing on Canadian businesses
		const addressComponents = addresses.map(
			address => `SELECT JSON_PARSE(addr('${address.toUpperCase()}')) as suppliedAddress`
		);
		const nameComponents = names.map(
			name => `SELECT CAST('${this.sanitizeBusinessName(name.toUpperCase())}' as text) as suppliedName`
		);

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
					n.company_number,
					n.jurisdiction_code,
					n.normalized_name,
					n.name,                -- Original name
					n.source,
					a.address,
					a.normalized_address,
					a.state,
					a.line1,
					a.city,
					a.zip,
					names.suppliedName::text,
					addresses.suppliedAddress::super,
					-- run normalized address through our lambda addr() to extract number and street
					JSON_EXTRACT_PATH_TEXT(json_serialize(json_parse(a.address_parts)), 'number', TRUE) as normalized_street_number,
					UPPER(JSON_EXTRACT_PATH_TEXT(json_serialize(json_parse(a.address_parts)), 'street', TRUE)) as normalized_street,
				-- Extract address components as text to avoid type issues
					json_serialize(addresses.suppliedAddress) as json_str,
					JSON_EXTRACT_PATH_TEXT(json_str, 'number', TRUE) AS supplied_number,
					JSON_EXTRACT_PATH_TEXT(json_str, 'street', TRUE) AS supplied_street,
					JSON_EXTRACT_PATH_TEXT(json_str, 'line1', TRUE) AS supplied_line1,
					JSON_EXTRACT_PATH_TEXT(json_str, 'city', TRUE) AS supplied_city,
					JSON_EXTRACT_PATH_TEXT(json_str, 'state', TRUE) AS supplied_state,
					JSON_EXTRACT_PATH_TEXT(json_str, 'zip', TRUE) AS supplied_zip
			FROM open_corporate.us_names_matview n
			LEFT JOIN open_corporate.us_addresses_matview a
					ON a.jurisdiction_code = n.jurisdiction_code
					AND a.company_number = n.company_number
			CROSS JOIN supplied_names names
			CROSS JOIN supplied_addresses addresses
			WHERE
					-- Basic name filter
					name2 in (${name2.map(n => `'${n}'`).join(",")})

					-- Look for Canadian businesses. Their jurisdiction codes are prefixed with 'ca_' or just 'ca'
					AND (n.jurisdiction_code ILIKE 'ca_%' OR n.jurisdiction_code = 'ca')
			),
			similarity AS (
			-- Calculate both name and address similarity
			SELECT
					fd.*,
					-- Name similarity metrics
					LEVENSHTEIN_DISTANCE(fd.normalized_name::text, fd.suppliedName::text) AS name_levenshtein,
					(LENGTH(fd.normalized_name::text) - LEVENSHTEIN_DISTANCE(fd.normalized_name::text, fd.suppliedName::text)) * 100.0 /
					GREATEST(LENGTH(fd.normalized_name::text), LENGTH(fd.suppliedName::text)) AS name_percentage_match,

					CASE WHEN fd.normalized_street_number IS NOT NULL AND fd.supplied_number IS NOT NULL
							THEN LEVENSHTEIN_DISTANCE(fd.normalized_street_number::text, fd.supplied_number)
							ELSE 999 END AS street_number_levenshtein,
					CASE WHEN fd.normalized_street IS NOT NULL AND fd.supplied_street IS NOT NULL
							THEN LEVENSHTEIN_DISTANCE(substring(fd.normalized_street::text,0,8), substring(fd.supplied_street,0,8))
							ELSE 999 END AS street_levenshtein,

					CASE WHEN fd.line1 IS NOT NULL AND fd.supplied_line1 IS NOT NULL
							THEN LEVENSHTEIN_DISTANCE(fd.line1::text, fd.supplied_line1)
							ELSE 999 END AS line1_levenshtein,

					-- City similarity metrics
					CASE WHEN fd.city IS NOT NULL AND fd.supplied_city IS NOT NULL
							THEN LEVENSHTEIN_DISTANCE(fd.city::text, fd.supplied_city)
							ELSE 999 END AS city_levenshtein,

					-- State/Province similarity metrics
					CASE WHEN fd.state IS NOT NULL AND fd.supplied_state IS NOT NULL
							THEN LEVENSHTEIN_DISTANCE(fd.state::text, fd.supplied_state)
							ELSE 999 END AS state_levenshtein,

					-- ZIP similarity metrics
					CASE WHEN fd.zip IS NOT NULL AND fd.supplied_zip IS NOT NULL
							THEN LEVENSHTEIN_DISTANCE(fd.zip::text, fd.supplied_zip)
							ELSE 999 END AS zip_levenshtein,

					-- Combined address similarity (lower is better)
					CASE WHEN fd.normalized_address IS NOT NULL
							THEN LEVENSHTEIN_DISTANCE(
									COALESCE(fd.line1, '') || ' ' || COALESCE(fd.city, '') || ' ' || COALESCE(fd.state, '') || ' ' || COALESCE(fd.zip, ''),
									COALESCE(fd.supplied_line1, '') || ' ' || COALESCE(fd.supplied_city, '') || ' ' || COALESCE(fd.supplied_state, '') || ' ' || COALESCE(fd.supplied_zip, '')
							)
							ELSE 999 END AS full_address_match_score
			FROM
					filtered_data fd
			)
			SELECT
			similarity.*,
			-- NEW INDEX CALCULATION based on provided rules
			(30 - LEAST(similarity.name_levenshtein, 30)) + -- (30 - levdist name)
			(10 - LEAST(similarity.street_number_levenshtein, 10)) + -- (10 - levdist address)
			CASE WHEN similarity.street_levenshtein = 0 THEN 5 ELSE 0 END +
			-- Add 5 if state matches
			-- CASE WHEN similarity.state_levenshtein = 0 THEN 5 ELSE 0 END +
			-- Add 5 if city matches
			CASE WHEN similarity.city_levenshtein = 0 THEN 5 ELSE 0 END +
			-- Add 5 if postal code matches
			CASE WHEN similarity.zip_levenshtein = 0 THEN 5 ELSE 0 END AS index


			from similarity
			ORDER BY
			index DESC,  -- Best overall matches first
			name_percentage_match DESC -- If overall ties, use name match
			LIMIT 10;
		`;
		logger.debug(query);
		return query;
	}

	private async getOfficers(companyNumber: string, jurisdictionCode: string): Promise<OfficerResult[]> {
		// Strip leading 0s from companyNumber
		const alternateCompanyNumber = companyNumber.replace(/^0+/, "");

		const query = `select upper(name) as name,
			upper(title) as title,
			upper(position) as position,
    		-- Address fields (quoted column names)
			"address.street_address"   AS officer_address_street,
			"address.locality"         AS officer_address_locality,
			"address.region"           AS officer_address_region,
			"address.postal_code"      AS officer_address_postal_code,
			"address.country"          AS officer_address_country,
			"address.in_full"          AS officer_address_full,
			
			-- Name fields
			first_name                 AS officer_first_name,
			last_name                  AS officer_last_name,
			
			-- Metadata fields
			current_status             AS officer_status,
			start_date                 AS officer_start_date,
			person_uid                 AS officer_person_uid,
			person_number              AS officer_person_number,
			type                       AS officer_type,
			source_url                 AS officer_source_url,
			retrieved_at               AS officer_retrieved_at
		FROM open_corporate.officers 
        WHERE jurisdiction_code = '${jurisdictionCode}' and company_number in ('${companyNumber}', '${alternateCompanyNumber}')`;
		const officers = executeAndUnwrapRedshiftQuery<OfficerResult>(query);

		logger.debug(`opencorporates officer query:\n ${query}`);
		return (await officers).map(o => ({
			name: o.name,
			title: o.title || o.position,
			position: o.position,
			// Address fields
			officer_address_street: o.officer_address_street,
			officer_address_locality: o.officer_address_locality,
			officer_address_region: o.officer_address_region,
			officer_address_postal_code: o.officer_address_postal_code,
			officer_address_country: o.officer_address_country,
			officer_address_full: o.officer_address_full,
			// Name fields
			officer_first_name: o.officer_first_name,
			officer_last_name: o.officer_last_name,
			// Metadata fields
			officer_status: o.officer_status,
			officer_start_date: o.officer_start_date,
			officer_person_uid: o.officer_person_uid,
			officer_person_number: o.officer_person_number,
			officer_type: o.officer_type,
			officer_source_url: o.officer_source_url,
			officer_retrieved_at: o.officer_retrieved_at
		}));
	}
	private async getNames(companyNumber: string, jurisdictionCode: string): Promise<NameResult[]> {
		const alternateCompanyNumber = companyNumber.replace(/^0+/, "");

		const query = `select *
        from open_corporate.us_names_matview 
        WHERE jurisdiction_code = '${jurisdictionCode}' and company_number in ('${companyNumber}', '${alternateCompanyNumber}')`;

		logger.debug(`opencorporates name query:\n ${query}`);
		return await executeAndUnwrapRedshiftQuery<NameResult>(query);
	}
	private async getAddresses(companyNumber: string, jurisdictionCode: string): Promise<AddressResult[]> {
		const alternateCompanyNumber = companyNumber.replace(/^0+/, "");

		const query = `select *
        from open_corporate.us_addresses_matview 
        WHERE jurisdiction_code = '${jurisdictionCode}' and company_number in ('${companyNumber}', '${alternateCompanyNumber}')`;
		logger.debug(`opencorporates address query:\n ${query}`);
		return await executeAndUnwrapRedshiftQuery<AddressResult>(query);
	}
	/***
	 * Get firmographic data for a company
	 * @param companyNumber
	 * @param jurisdictionCode
	 * @returns {Promise<[FirmographicResult, FirmographicResult[]]>}
	 * First result in tuple is the primary firmographic entry, the secondary firmographics are stored as an array in the second half of the tuple
	 */
	private async getFirmographic(
		companyNumber: string,
		jurisdictionCode: string
	): Promise<[FirmographicResult, FirmographicResult[]]> {
		let naics: string | null = null;
		const query = `select *
        from open_corporate.companies
        WHERE (jurisdiction_code = '${jurisdictionCode}' and company_number = '${companyNumber}')
        OR
        (home_jurisdiction_code = '${jurisdictionCode}' and home_jurisdiction_company_number = '${companyNumber}')
        `;
		logger.debug(`opencorporates firmographic query:\n ${query}`);
		const firmographics = await executeAndUnwrapRedshiftQuery<FirmographicResult>(query);
		let primaryFirmographic: FirmographicResult | null = firmographics[0];
		let secondaryFirmographics: FirmographicResult[] = [];
		firmographics.forEach(company => {
			const industryMatches = company.industry_code_uids.match(/(\d+)(?=\|)/);
			if (industryMatches?.length && isFinite(parseInt(industryMatches[0]))) {
				naics = industryMatches[0];
				company.naics = parseInt(naics);
			}
			if (company.company_number === companyNumber && company.jurisdiction_code === jurisdictionCode) {
				primaryFirmographic = company;
			} else {
				secondaryFirmographics.push(company);
			}
		});
		return [primaryFirmographic, secondaryFirmographics];
	}
}
