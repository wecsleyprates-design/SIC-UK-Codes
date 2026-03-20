import { uploadRawIntegrationDataToS3 } from "#common/index";
import { envConfig } from "#configs";
import { DIRECTORIES, FEATURE_FLAGS } from "#constants";
import type { IEquifaxAIScoreModel, IEquifaxCreditSummary, IEquifaxJudgementsLiensReport } from "#lib/equifax/types";
import { convertAddress, convertState, extractZipParts } from "#lib/plaid/convert";
import { 
	Athena as AWSAthena, 
	StartQueryExecutionCommand, 
	GetQueryExecutionCommand, 
	GetQueryResultsCommand,
	QueryExecutionState 
} from "@aws-sdk/client-athena";
import { S3, GetObjectCommand } from "@aws-sdk/client-s3";
import csv from "csv-parser";
import currency from "currency.js";
import { getBusinessDetails, TIN_BEHAVIOR, type BusinessDetails } from "./api";
import { logger } from "./logger";
import { executeRedshiftQuery } from "./redshift";
import { getFlagValue } from "./LaunchDarkly";

const availablePartitions = ["2023-10", "2023-11", "2023-12", "2024-01", "2024-02"];

type QueryResult = Array<Record<string, any>>;
type QueryMetadata = {
	DataScannedInMB: number;
	QueryCostInUSD: number;
	EngineExecutionTimeInMillis: number;
	count: number;
};

interface AthenaBusinessData {
	companyname: string;
	dba_names: string[];
	address: string;
	state: string;
	city: string;
	zipcode: string;
	zip4: string;
	zipcode_threedigits: string;
	business_mailing_addresses: {
		line_1: string;
		apartment: string | null;
		city: string;
		state: string;
		country: string;
		postal_code: string;
		mobile: string | null;
		is_primary: boolean;
		address?: string;
	}[];
}

// Custom Athena client to replace athena-express-plus
class CustomAthenaClient {
	private athena: AWSAthena;
	private s3: S3;
	private database: string;
	private outputLocation: string;

	constructor(athena: AWSAthena, s3: S3, database: string, outputLocation: string) {
		this.athena = athena;
		this.s3 = s3;
		this.database = database;
		this.outputLocation = outputLocation;
	}

	async query(options: { sql: string }): Promise<any> {
		const { sql } = options;
		
		// Start query execution
		const startCommand = new StartQueryExecutionCommand({
			QueryString: sql,
			QueryExecutionContext: { Database: this.database },
			ResultConfiguration: { OutputLocation: this.outputLocation }
		});
		
		const startResult = await this.athena.send(startCommand);
		const queryExecutionId = startResult.QueryExecutionId!;
		
		// Wait for query to complete
		await this.waitForQueryCompletion(queryExecutionId);
		
		// Get query results
		const resultsCommand = new GetQueryResultsCommand({
			QueryExecutionId: queryExecutionId
		});
		
		const results = await this.athena.send(resultsCommand);
		
		// Get query statistics
		const executionCommand = new GetQueryExecutionCommand({
			QueryExecutionId: queryExecutionId
		});
		
		const execution = await this.athena.send(executionCommand);
		const statistics = execution.QueryExecution?.Statistics;
		
		// Convert results to the expected format
		const rows = results.ResultSet?.Rows || [];
		const headers = rows[0]?.Data?.map(col => col.VarCharValue || '') || [];
		const dataRows = rows.slice(1);
		
		const Items = dataRows.map(row => {
			const item: Record<string, any> = {};
			row.Data?.forEach((cell, index) => {
				const header = headers[index];
				if (header) {
					item[header] = cell.VarCharValue || null;
				}
			});
			return item;
		});
		
		return {
			Items,
			DataScannedInMB: (statistics?.DataScannedInBytes || 0) / (1024 * 1024),
			QueryCostInUSD: ((statistics?.DataScannedInBytes || 0) / (1024 * 1024 * 1024)) * 5, // Rough estimate
			EngineExecutionTimeInMillis: statistics?.EngineExecutionTimeInMillis || 0,
			count: Items.length
		};
	}
	
	private async waitForQueryCompletion(queryExecutionId: string): Promise<void> {
		let status: string | undefined = QueryExecutionState.RUNNING;
		
		while (status === QueryExecutionState.RUNNING || status === QueryExecutionState.QUEUED) {
			await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
			
			const command = new GetQueryExecutionCommand({
				QueryExecutionId: queryExecutionId
			});
			
			const result = await this.athena.send(command);
			status = result.QueryExecution?.Status?.State;
			
			if (status === QueryExecutionState.FAILED || status === QueryExecutionState.CANCELLED) {
				throw new Error(`Query failed with status: ${status}. Reason: ${result.QueryExecution?.Status?.StateChangeReason}`);
			}
		}
	}
}

export class Athena {
	private static readonly ENTITY_TABLE = "ae_equifax_mdsus_match_base";
	private static readonly NAICS_TABLE = "mdsus_parquet_2";
	private static readonly LIENS_TABLE = "mdsbma_parquet_4";
	private static readonly SCORING_TABLE = "ml_equifax_mdsus_grp_month";
	private static readonly CREDIT_SUMMARY_TABLE = "mdsbma_parquet_6";

	private aggregateCost = 0;
	private aggregateQueryTime = 0;
	private client: CustomAthenaClient;
	constructor(businessId?: string, db?: string, outputBucket?: string) {
		if (!envConfig.AWS_SES_REGION) {
			throw new Error("AWS region not found");
		}
		const commonConfig = {
			region: envConfig.AWS_SES_REGION,
			credentials: {
				accessKeyId: envConfig.AWS_DATA_ACCESS_KEY_ID || envConfig.AWS_ACCESS_KEY_ID || "",
				secretAccessKey: envConfig.AWS_DATA_ACCESS_KEY_SECRET || envConfig.AWS_ACCESS_KEY_SECRET || ""
			}
		};
		const s3 = new S3(commonConfig);
		const athena = new AWSAthena(commonConfig);
		const output = `s3://${outputBucket ?? envConfig.EQUIFAX_ATHENA_S3_OUTPUT}/athena-integrations/equifax-matcher/${businessId ?? ""}`;
		this.client = new CustomAthenaClient(athena, s3, db ?? envConfig.EQUIFAX_ATHENA_DB ?? "", output);
	}

	public getAggregateStats() {
		return {
			aggregateCost: this.aggregateCost,
			aggregateQueryTime: this.aggregateQueryTime
		};
	}
	public async queryReturnMetadata(sql, config?: any): Promise<[QueryResult, QueryMetadata]> {
		const result = await this.client.query({
			sql,
			...config
		});
		const { Items, ...metadata } = result;
		this.aggregateCost = currency(metadata.QueryCostInUSD, { precision: 10 }).add(this.aggregateCost).value;
		this.aggregateQueryTime = currency(metadata.EngineExecutionTimeInMillis, { precision: 10 }).add(this.aggregateQueryTime).value;
		logger.debug(`Query: ${sql} && Query Cost in USD: ${metadata.QueryCostInUSD}`);
		return [Items, metadata];
	}
	public async query(queryString): Promise<QueryResult> {
		const [items, _] = await this.queryReturnMetadata(queryString, false);
		return items;
	}

	/*
		Return tuple of [year, month] for best partition to select from 
	*/
	private getParitionForDate(date = new Date()): [string, string] {
		// Get closest partition (rounding up) to the date provided
		const partition =
			availablePartitions.find(p => {
				const [y, m] = p.split("-");
				const partitionDate = new Date(parseInt(y), parseInt(m) - 1);
				return partitionDate >= date;
			}) ?? availablePartitions[availablePartitions.length - 1];
		const [year, month] = partition.split("-");
		return [year, month];
	}

	async queryForBusiness(businessId: string, date?: Date) {
		// Check to make sure that the similarity is at least this value
		const partitionForDate = this.getParitionForDate(date);

		const MIN_SIMILARITY = 45;
		const businessDetails = await getBusinessDetails(businessId, "", TIN_BEHAVIOR.PLAIN);

		if (!businessDetails?.data) {
			throw new Error("Business not found");
		}

		let redShiftresult, initialQuery: string;
		const business = businessDetails.data as BusinessDetails;
		if (business.tin) {
			const tin = business.tin;
			const redShiftQuery = `SELECT * FROM dev.warehouse.efx_id_tin_lookup WHERE tin = '${tin}' LIMIT 1`;

			try {
				redShiftresult = await executeRedshiftQuery(redShiftQuery);
				logger.info(`Red Shift Result: ${JSON.stringify(redShiftresult)}`);
			} catch (error) {
				logger.error(`Error executing Redshift query: ${error}`);
				throw error; // Handle or rethrow as needed
			}
		}

		const { zipcode, zip4 } = extractZipParts(business.address_postal_code);

		// Sanitize the base address
		try {
			const addressSanity = `${business.address_line_1.trim() ?? ""} ${business.address_line_2?.trim() ?? ""}`.trim();
			business.address_line_1 = convertAddress(addressSanity);
		} catch (error) {
			// Swallow the error as it's not a big deal
		}
		try {
			business.address_state = convertState(business.address_state);
		} catch (error) {
			// Swallow the error as it's not a big deal
		}

		const businessData: AthenaBusinessData = {
			companyname: (business.name ?? "").toUpperCase().replace(/[^a-zA-Z0-9 ]/g, ""),
			// fetch all business names => filter for dba once => make sanity (upper-case + replace w/ regex)
			dba_names: business.business_names.filter(name => name.is_primary === false).map(({ name }) => name.toUpperCase().replace(/[^a-zA-Z0-9 ]/g, "")),
			address: business.address_line_1 ?? "",
			state: business.address_state?.toUpperCase() ?? "",
			city: business.address_city?.toUpperCase() ?? "",
			zipcode,
			zip4,
			zipcode_threedigits: zipcode?.substring(0, 3) ?? "",
			business_mailing_addresses: business.business_addresses.filter(address => address.is_primary === false)
		};

		businessData.business_mailing_addresses = businessData.business_mailing_addresses.map(address => {
			// Convert SOUTHEAST to SE as Athena has address abbreviations and our db sometimes has Complete address names
			try {
				const addressSanity = `${address.line_1 ?? ""} ${address.apartment ?? ""}`.trim();
				address.address = convertAddress(addressSanity);
			} catch (ex) {
				// If we can't convert the address, we'll just use the original value
			}

			// Convert MICHIGAN to MI as Athena has state codes and our db sometimes has Complete state names
			try {
				address.state = convertState(address.state);
			} catch (ex) {
				// If we can't convert the state, we'll just use the original value
			}

			return address;
		});

		let dbaClause = ``;
		let dbaMatch = ``;
		if (businessData.dba_names?.length > 0) {
			for (const dba of businessData.dba_names) {
				const firstLetter = dba.substring(0, 1);
				dbaClause += ` '${firstLetter}' = SUBSTRING(ET.efx_name, 1 , 1) OR '${firstLetter}' = SUBSTRING(ET.efx_legal_name, 1, 1) OR `;
				dbaMatch += ` CASE WHEN ET.efx_name NOT IN ('', ' ') THEN levenshtein_distance(ET.efx_name, '${dba}') ELSE 9999 END, CASE WHEN ET.efx_legal_name NOT IN ('', ' ') THEN levenshtein_distance(ET.efx_legal_name, '${dba}') ELSE 9999 END, `;
			}
		}

		const tig5Flag = await getFlagValue(FEATURE_FLAGS.TIG_5_PASSING_DBA_AND_MAILING_ADDRESSES);

		initialQuery = `
			SELECT ET.*,
			    NAICS.efx_primnaicscode,
				NAICS.efx_primnaicsdesc,
				NAICS.efx_secnaicsdesc1,
				LEAST(
						${dbaMatch}
						CASE WHEN ET.efx_name NOT IN ('', ' ') THEN levenshtein_distance(TRIM(ET.efx_name), '${businessData.companyname}') ELSE 9999 END,
						CASE WHEN ET.efx_legal_name NOT IN ('', ' ') THEN levenshtein_distance(TRIM(ET.efx_legal_name), '${businessData.companyname}') ELSE 9999 END
				) AS levdistance_name,
				CASE WHEN ET.eng_address != '' THEN levenshtein_distance('${businessData.address}', TRIM(ET.eng_address)) ELSE 9999 END AS levdistance_address,
				ROW_NUMBER() OVER (PARTITION BY ET.efx_id ORDER BY 
						LEAST(
							${dbaMatch}
							CASE WHEN ET.efx_name NOT IN ('', ' ') THEN levenshtein_distance(TRIM(ET.efx_name), '${businessData.companyname}') ELSE 9999 END,
							CASE WHEN ET.efx_legal_name NOT IN ('', ' ') THEN levenshtein_distance(TRIM(ET.efx_legal_name), '${businessData.companyname}') ELSE 9999 END
						) ASC
				) AS levdistance_name_rank,
				ROW_NUMBER() OVER (PARTITION BY ET.efx_id ORDER BY 
						CASE WHEN ET.eng_address != '' THEN levenshtein_distance(TRIM(ET.eng_address), '${businessData.address}') ELSE 9999 END ASC
				) AS levdistance_address_rank,
				(20 - LEAST(
						${dbaMatch}
						CASE WHEN ET.efx_name NOT IN ('', ' ') THEN levenshtein_distance(TRIM(ET.efx_name), '${businessData.companyname}') ELSE 9999 END,
						CASE WHEN ET.efx_legal_name NOT IN ('', ' ') THEN levenshtein_distance(TRIM(ET.efx_legal_name), '${businessData.companyname}') ELSE 9999 END
				)) + 
				(20 - CASE WHEN ET.eng_address != '' THEN levenshtein_distance('${businessData.address}', TRIM(ET.eng_address)) ELSE 9999 END) + `;

		logger.info(`businessId=${businessId} businessData: ${JSON.stringify(businessData)}`);
		if (tig5Flag && businessData.business_mailing_addresses.length > 0) {
			let similarityIndexParts: string[] = [];
			for (const addr of businessData.business_mailing_addresses) {
				const { address, city, state, postal_code } = addr;
				similarityIndexParts.push(`
					(
						(20 - LEAST(
							${dbaMatch}
							CASE WHEN ET.efx_name NOT IN ('', ' ') THEN levenshtein_distance(TRIM(ET.efx_name), '${businessData.companyname}') ELSE 9999 END,
							CASE WHEN ET.efx_legal_name NOT IN ('', ' ') THEN levenshtein_distance(TRIM(ET.efx_legal_name), '${businessData.companyname}') ELSE 9999 END
						)) +
						(20 - CASE WHEN ET.eng_address != '' THEN levenshtein_distance('${address}', TRIM(ET.eng_address)) ELSE 9999 END) +
						CASE WHEN lower(ET.efx_state) = lower('${state}') THEN 5 ELSE 0 END +
						CASE WHEN lower(ET.efx_city) = lower('${city}') THEN 5 ELSE 0 END +
						CASE WHEN ET.efx_zipcode = '${postal_code}' THEN 5 ELSE 0 END
					)
				`);
			}
			initialQuery += ` GREATEST(${similarityIndexParts.join(", ")}) AS similarity_index, 
				ROW_NUMBER() OVER (PARTITION BY ET.efx_id ORDER BY
					GREATEST(${similarityIndexParts.join(", ")}) DESC, eng_companyname
				) AS similarity_index_rank `;
		} else {
			initialQuery += `
				CASE WHEN lower(ET.efx_state) = lower('${businessData.state}') THEN 5 ELSE 0 END + 
				CASE WHEN lower(ET.efx_city) = lower('${businessData.city}') THEN 5 ELSE 0 END +
				CASE WHEN ET.efx_zipcode = '${businessData.zipcode}' THEN 5 ELSE 0 END AS similarity_index,
				ROW_NUMBER() OVER (PARTITION BY ET.efx_id ORDER BY
						(20 - LEAST(
							${dbaMatch}
							CASE WHEN ET.efx_name NOT IN ('', ' ') THEN levenshtein_distance(TRIM(ET.efx_name), '${businessData.companyname}') ELSE 9999 END,
							CASE WHEN ET.efx_legal_name NOT IN ('', ' ') THEN levenshtein_distance(TRIM(ET.efx_legal_name), '${businessData.companyname}') ELSE 9999 END
						)) + 
						(20 - CASE WHEN ET.eng_address != '' THEN levenshtein_distance('${businessData.address}', TRIM(ET.eng_address)) ELSE 9999 END) + 
						CASE WHEN lower(ET.efx_state) = lower('${businessData.state}') THEN 5 ELSE 0 END + 
						CASE WHEN lower(ET.efx_city) = lower('${businessData.city}') THEN 5 ELSE 0 END + 
						CASE WHEN ET.efx_zipcode = '${businessData.zipcode}' THEN 5 ELSE 0 END
						DESC, eng_companyname) AS similarity_index_rank `;
		}

		initialQuery += `
			FROM ${Athena.ENTITY_TABLE} as ET
			LEFT JOIN ${Athena.NAICS_TABLE} as NAICS on (NAICS.efx_id=ET.efx_id AND NAICS.yr='${partitionForDate[0]}' and NAICS.mon='${partitionForDate[1]}' )`;

		const orderByClause = ` ORDER BY similarity_index DESC LIMIT 1`;

		let queryString = initialQuery;
		if (redShiftresult?.TotalNumRows > 0) {
			const efxIds = redShiftresult?.Records?.[0]?.[4]?.stringValue;
			const efxIdsForQuery = efxIds
				?.split(",")
				.map(id => `'${id.trim()}'`)
				.join(", ");
			queryString += ` WHERE ET.efx_id IN (${efxIdsForQuery})`;
		} else {
			queryString += ` WHERE 
			(
			${dbaClause}
			'${businessData.companyname.substring(0, 1)}' = SUBSTRING(ET.efx_name, 1,1)
			OR 
			'${businessData.companyname.substring(0, 1)}' = SUBSTRING(ET.efx_legal_name, 1,1)			
			)
			AND
			ET.eng_zipcode_threedigits = '${businessData.zipcode_threedigits}'`;
		}
		queryString += orderByClause;

		logger.info(`businessId=${businessId} athena query: ${queryString}`);
		const [result, queryMeta] = await this.queryReturnMetadata(queryString);
		let match: Record<string, string> | null = null;
		// Check if there is a result and if the similarity_index is >= MIN_SIMULARITY
		if (result.length > 0 && result[0].similarity_index >= MIN_SIMILARITY) {
			logger.info(`businessId=${businessId}: Query Results for athena business match: ${result.length}`);
			logger.info(`businessId=${businessId}: Record found with similarity_index: ${result[0].similarity_index}`);
			match = result[0];
			try {
				match = await this.bigIntReplacer(match);
				await uploadRawIntegrationDataToS3(match, businessId, "equifax_match", DIRECTORIES.EQUIFAX, "CREDIT_BUREAU");
			} catch (error: any) {
				logger.error({ error, business_id: businessId }, 'Error uploading raw integration data to S3');
			}
		} else {
			// Warn if the similarity_index is less than MIN_SIMILARITY or no result is found
			logger.warn(
				`businessId=${businessId}: No athena matching record found with a similarity_index >= ${MIN_SIMILARITY} best match is: ${result?.[0]?.similarity_index ?? "not found"} :: ${
					result?.[0]?.efx_name ?? ""
				} :: ${result?.[0]?.efx_address ?? ""} :: ${result?.[0]?.efx_city ?? ""}`
			);
		}
		const bestMatch = {
			score: result?.[0]?.similarity_index ?? 0,
			points: result?.[0]?.similarity_index ?? 0,
			data: match
		};

		return { bestMatch, result };
	}

	getRelevantReportForBusiness = async (efxId: string, date?: Date): Promise<IEquifaxJudgementsLiensReport> => {
		const partitionForDate = this.getParitionForDate(date);
		const queryString = `SELECT * FROM ${Athena.LIENS_TABLE} WHERE partition_0='${partitionForDate[0]}' and partition_1='${partitionForDate[1]}' and efx_id=${efxId}`;
		const [result, _queryMeta] = await this.queryReturnMetadata(queryString);
		return result[0] as IEquifaxJudgementsLiensReport;
	};

	getCreditSummaryForBusiness = async (efxId: string, date?: Date): Promise<IEquifaxCreditSummary> => {
		const partitionForDate = this.getParitionForDate(date);
		const queryString = `SELECT * FROM ${Athena.CREDIT_SUMMARY_TABLE} WHERE yr='${partitionForDate[0]}' and mon='${partitionForDate[1]}' and efx_id=${efxId}`;
		const [result, _queryMeta] = await this.queryReturnMetadata(queryString);
		return result[0] as IEquifaxCreditSummary;
	};

	getScoringDataForBusiness = async (efxId: string, date?: Date): Promise<IEquifaxAIScoreModel> => {
		const [year, month] = this.getParitionForDate(date);
		const extractMonth = `${year}/${month.padStart(2, "0")}/01`;
		const queryString = `SELECT base.*, naics_1.naics_sector AS primnaics_sector
			, naics_1.naics_subsector AS primnaics_subsector
			, naics_1.naics_industry_group AS primnaics_industry_group
			, naics_1.naics_industry AS primnaics_industry
			, naics_2.naics_sector AS secnaics1_sector
			, naics_2.naics_subsector AS secnaics1_subsector
			, naics_2.naics_industry_group AS secnaics1_industry_group
			, naics_2.naics_industry AS secnaics1_industry
			, naics_3.naics_sector AS secnaics2_sector
			, naics_3.naics_subsector AS secnaics2_subsector
			, naics_3.naics_industry_group AS secnaics2_industry_group
			, naics_3.naics_industry AS secnaics2_industry
			, naics_4.naics_sector AS secnaics3_sector
			, naics_4.naics_subsector AS secnaics3_subsector
			, naics_4.naics_industry_group AS secnaics3_industry_group
			, naics_4.naics_industry AS secnaics3_industry
			, naics_5.naics_sector AS secnaics4_sector
			, naics_5.naics_subsector AS secnaics4_subsector
			, naics_5.naics_industry_group AS secnaics4_industry_group
			, naics_5.naics_industry AS secnaics4_industry
			, parent.legname_occ
			, parent.afflname_occ 
			FROM ${Athena.SCORING_TABLE} as base 
			LEFT JOIN adhoc.ml_naics AS naics_1
				ON base.primnaicscode = naics_1.naics_code
			LEFT JOIN adhoc.ml_naics AS naics_2
				ON base.secnaics1 = naics_2.naics_code 
			LEFT JOIN adhoc.ml_naics AS naics_3
				ON base.secnaics2 = naics_3.naics_code 
			LEFT JOIN adhoc.ml_naics AS naics_4
				ON base.secnaics3 = naics_4.naics_code 
			LEFT JOIN adhoc.ml_naics AS naics_5
				ON base.secnaics4 = naics_5.naics_code
			LEFT JOIN equifax_us.ml_equifax_parent_data AS parent
				ON base.legultnumall = parent.legultnumall WHERE extract_month='${extractMonth}' and contains (location_ids,${efxId})`;

		logger.info(queryString);
		const [result, _queryMeta] = await this.queryReturnMetadata(queryString);
		return result[0] as IEquifaxAIScoreModel;
	};

	saveReportToS3 = async (businessId: string, output: any) => {
		await uploadRawIntegrationDataToS3(output, businessId, "judgementsLiens", DIRECTORIES.EQUIFAX, "EQUIFAX");
	};

	// Function to iterate over the object and convert BigInt values to strings
	bigIntReplacer = (data: any) => {
		for (const key in data) {
			if (typeof data[key] === "bigint") {
				data[key] = data[key].toString(); // Convert BigInt to string
			}
		}
		return data;
	};

	/* Serialize Athena's BigInt responses into string values */
	public static serializeBigInt(data: any): string {
		return JSON.stringify(data, (_, value) => (typeof value === "bigint" ? value.toString() : value));
	}
}
