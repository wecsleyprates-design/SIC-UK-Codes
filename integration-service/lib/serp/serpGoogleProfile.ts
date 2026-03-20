import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { logger } from "#helpers/logger";
import type { UUID } from "crypto";

import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import {
	createAbortErrorMessage,
	mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult,
	searchSerpWithGoogleEngine,
	searchSerpWithGoogleMapsEngine
} from "./util";
import {
	isSerpGoogleProfileTaskMetadata,
	isSerpSearchResponseWithKnowledgeGraph,
	isSerpSearchResponseWithPlaceResults
} from "./typeguards";
import { internalGetBusinessNamesAndAddresses } from "#helpers";
import { SerpGoogleProfileMissingDataError } from "./errors";
import { SerpGoogleProfileTaskResponse } from "./types/SerpGoogleProfileTaskResponse";

export class SerpGoogleProfile extends TaskManager {
	protected PLATFORM_ID = INTEGRATION_ID.SERP_GOOGLE_PROFILE;

	protected taskHandlerMap = {
		fetch_google_profile: async taskId => this.fetchGoogleProfile(taskId)
	};

	async fetchGoogleProfile(taskID: UUID) {
		try {
			const task = await TaskManager.getEnrichedTask(taskID);
			await this.updateTaskStatus(taskID, TASK_STATUS.IN_PROGRESS);

			let name: string;
			let address: string;
			const businessID = task.business_id;

			logger.info(`fetchGoogleProfile - Running SERP search for business ${businessID} and task ${task.id}`);

			if (isSerpGoogleProfileTaskMetadata(task.metadata)) {
				logger.info(
					`fetchGoogleProfile - Using metadata from task for business ${businessID} and task ${task.id} ${JSON.stringify(task.metadata)}`
				);
				name = task.metadata.name;
				address = task.metadata.address;
			} else {
				const businessData = await internalGetBusinessNamesAndAddresses(businessID);
				const { names, addresses } = businessData;
				logger.info(
					{ names, addresses },
					`fetchGoogleProfile - Using fetched business names and addresses for business ${businessID} - names: ${names.map(n => n.name).join(", ")} - addresses: ${addresses.map(a => a.line_1).join(", ")}`
				);

				const dbaName = names.find(n => !n.is_primary)?.name;
				const legalName = names.find(n => n.is_primary)?.name;
				const primaryAddress = addresses.find(a => a.is_primary) ?? addresses?.[0];

				name = dbaName || legalName || "";
				address = primaryAddress
					? [
							primaryAddress.line_1,
							primaryAddress.city,
							primaryAddress.state,
							/** Guard against invalid >5 digit postal code input */
							primaryAddress.postal_code?.slice(0, 5),
							primaryAddress.country
						]
							.filter(Boolean)
							.join(", ")
					: "";
			}

			if (!name) throw new SerpGoogleProfileMissingDataError(task, businessID, "business dba or legal name");
			if (!address) throw new SerpGoogleProfileMissingDataError(task, businessID, "business address");

			logger.info(
				`fetchGoogleProfile - Running SERP search for business ${name} and task ${task.id} with Google engine with name "${name}" and address "${address}"`
			);
			const serpSearchResponseWithKnowledgeGraph = await searchSerpWithGoogleEngine(name, address);

			logger.info(serpSearchResponseWithKnowledgeGraph, "fetchGoogleProfile - searchSerpWithGoogleEngine response");

			/**
			 * If the SERP response doesn't match the expected shape, it's not indicative of an error.
			 * SERP will do it's best to return *anything* for the search query; it can and will return a lot of different response shapes.
			 *
			 * If the response does not contain a knowledge graph, that means that the search did not return a profile for the business.
			 * So, in that case, we just log and return :)
			 */
			if (!isSerpSearchResponseWithKnowledgeGraph(serpSearchResponseWithKnowledgeGraph)) {
				logger.info(
					createAbortErrorMessage(
						task,
						businessID,
						`the SERP response did not match the expected shape (no knowledge_graph): ${JSON.stringify(serpSearchResponseWithKnowledgeGraph)}`
					)
				);
				return false;
			}

			/**
			 * Fetch the place results from the SERP (via Google Maps) to get the thumbnail and gps coordinates for the business,
			 * which are not included in the knowledge graph response.
			 */
			const placeId = serpSearchResponseWithKnowledgeGraph.knowledge_graph.place_id;
			logger.info(`fetchGoogleProfile - Running SERP search with Google Maps engine for place id: ${placeId}`);
			const serpGoogleMapsSearchData = await searchSerpWithGoogleMapsEngine(placeId);
			const isValidSerpGoogleMapsSearchData = isSerpSearchResponseWithPlaceResults(serpGoogleMapsSearchData);

			if (!isValidSerpGoogleMapsSearchData) {
				logger.info(
					serpGoogleMapsSearchData,
					createAbortErrorMessage(
						task,
						businessID,
						"the SERP response did not match the expected shape (no place_results)"
					)
				);
			}

			const serpResponseWithPlaceResults = isValidSerpGoogleMapsSearchData ? serpGoogleMapsSearchData : null;

			/**
			 * Map the responses to a GoogleProfileMatchResult.
			 */
			const googleProfileMatchResult = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
				serpSearchResponseWithKnowledgeGraph,
				serpResponseWithPlaceResults,
				address
			);

			logger.info(googleProfileMatchResult, "fetchGoogleProfile - googleProfileMatchResult");

			await TaskManager.saveRawResponseToDB<SerpGoogleProfileTaskResponse>(
				{
					google_profile_match_result: googleProfileMatchResult,
					knowledge_graph: serpSearchResponseWithKnowledgeGraph.knowledge_graph,
					place_results: serpResponseWithPlaceResults?.place_results ?? null,
					rawSerpResponses: [serpSearchResponseWithKnowledgeGraph, serpResponseWithPlaceResults].filter(Boolean)
				},
				businessID,
				task,
				INTEGRATION_ID.SERP_GOOGLE_PROFILE,
				"fetch_google_profile"
			);

			await this.updateTaskStatus(taskID, TASK_STATUS.SUCCESS);

			return true;
		} catch (error) {
			if (error instanceof Error) {
				await this.updateTaskStatus(taskID, TASK_STATUS.FAILED, error);
				logger.error({ error }, "fetchGoogleProfile - Error");
			} else {
				const message = typeof error === "string" ? error : "Unknown error -- check the logs for this task.";
				await this.updateTaskStatus(taskID, TASK_STATUS.FAILED, new Error(message));
				logger.error({ error }, "fetchGoogleProfile - Error");
			}
		}

		return false;
	}
}
