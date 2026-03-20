import { DeferrableTaskManager } from "#api/v1/modules/tasks/deferrableTaskManager";
import OpenAI from "openai";
import { AIEnrichmentError } from "./aiEnrichmentError";
import { FactEngine } from "#lib/facts/factEngine";
import { EVENTS, QUEUES, type EventEnum, type IntegrationPlatformId } from "#constants";
import { logger } from "#helpers/logger";
import BullQueue, { type SandboxedJob } from "#helpers/bull-queue";
import { z } from "zod-v4";

import type { IBusinessIntegrationTask, IBusinessIntegrationTaskEnriched, IDBConnection } from "#types/db";
import type { Responses, ResponsesModel } from "openai/resources";
import type { EnqueuedJob, ResponseCreateWithInput } from "./types";
import type { Job, QueueOptions } from "bull";
import type { Knex } from "knex";
import type { UUID } from "crypto";
import { RequestProxy } from "#utils/requestProxy";
import { OPENAI_MODEL_VERSION } from "./constants";

export abstract class AIEnrichment extends DeferrableTaskManager {
	protected readonly openaiClient: OpenAI;
	protected static readonly PLATFORM_ID: IntegrationPlatformId;
	protected static readonly MODEL: ResponsesModel = OPENAI_MODEL_VERSION;
	protected static readonly TEMPERATURE: number | undefined = 0.1; // Between 0 to 2
	protected static readonly QUEUE_NAME = QUEUES.AI_ENRICHMENT;
	protected static readonly QUEUE_EVENT: EventEnum = EVENTS.AI_ENRICHMENT;
	protected static readonly QUEUE_WORKER_SANDBOX_PATH: string = "sandboxed/deferrableTaskWorker.ts";
	protected static readonly QUEUE_OPTIONS: Partial<QueueOptions> = {
		prefix: "{aiEnrichment}",
		settings: { maxStalledCount: 10, stalledInterval: 90000 }
	};

	protected staticRef: typeof AIEnrichment;
	/**
	 * Number of seconds to wait before allowing the task to run with the data available to it. Set to 0 to disable and always run.
	 */
	protected static readonly TASK_TIMEOUT_IN_SECONDS: number = 90;

	constructor({
		dbConnection,
		db,
		bullQueue,
		factEngine,
		openaiClient
	}: {
		dbConnection: IDBConnection;
		db: Knex;
		bullQueue: BullQueue;
		factEngine: FactEngine;
		openaiClient: OpenAI;
	}) {
		super({ dbConnection, db, bullQueue, factEngine });
		this.openaiClient = openaiClient;
		this.staticRef = this.constructor as typeof AIEnrichment;
	}

	protected calculateConfidence(input: "HIGH" | "MED" | "LOW"): number {
		switch (input) {
			case "HIGH":
				return 0.2;
			case "MED":
				return 0.15;
			default:
				return 0.1;
		}
	}

	public async executeDeferrableTask(
		task: IBusinessIntegrationTask,
		job: Job<EnqueuedJob> | SandboxedJob<EnqueuedJob>
	): Promise<boolean> {
		const factValues = await this.getFactValues();
		const prompt = await this.getPrompt(factValues);
		logger.debug({ task_id: task.id }, "📘 prompt generated");
		const rawResponse: Responses.Response = await this.getOpenAIResponse(prompt, task.id);
		const response = this.parseOpenAIResponse(rawResponse);
		logger.debug({ response }, "📘 response parsed");
		const enrichedTask = await this.staticRef.getEnrichedTask(task.id);
		if (response) {
			const confidence = this.calculateConfidence(response.confidence);
			await this.saveRequestResponse(enrichedTask, { factValues, response, confidence });
			await this.updateTaskMetadata(task.id, { response, prompt });
		}
		await this.executePostProcessing(enrichedTask, response);
		return true;
	}

	// Define to do something "special" once we get a response from the AI and save it
	protected async executePostProcessing<T, R>(
		enrichedTask: IBusinessIntegrationTaskEnriched<T>,
		response: R
	): Promise<void> {
		// Do something
	}

	protected async getPrompt(
		args: Record<string, any>
	): Promise<string | Responses.ResponseInput | ResponseCreateWithInput> {
		// Must be implemented by child classes
		throw new AIEnrichmentError("getPrompt() not implemented");
	}

	protected getResponseFormat(input: Responses.ResponseInput): z.ZodObject<any> | undefined {
		return undefined;
	}

	protected async getOpenAIResponse(
		input: string | Responses.ResponseInput | ResponseCreateWithInput,
		taskID?: UUID
	): Promise<Responses.Response> {
		// Build the prompt from either the input string, the input object, or the input object's input property
		const additionalParams: ResponseCreateWithInput = { input: [] };
		if (this.isResponseInput(input)) {
			additionalParams.input = input;
		} else if (this.isResponseCreateParams(input)) {
			Object.assign(additionalParams, input);
		} else if (typeof input === "string") {
			additionalParams.input = [{ role: "user", content: input }];
		}
		if (!additionalParams.input) {
			throw new AIEnrichmentError("No prompt provided");
		}

		// Build the response format from the prompt
		const zodSchema = this.getResponseFormat(additionalParams.input as Responses.ResponseInput);
		const jsonSchema = zodSchema ? z.toJSONSchema(zodSchema, { target: "draft-7" }) : undefined;

		logger.debug({ jsonSchema }, "jsonSchema for AI Enrichment");

		const request: ResponseCreateWithInput = {
			stream: false,
			model: this.staticRef.MODEL,
			temperature: this.staticRef.TEMPERATURE,
			...additionalParams,
			...(zodSchema &&
				jsonSchema && {
					text: {
						format: {
							type: "json_schema",
							name: "response",
							strict: true,
							schema: jsonSchema
						}
					}
				})
		};

		const create = RequestProxy.wrap(
			this.openaiClient.responses.create.bind(this.openaiClient.responses),
			(this.staticRef as any).PLATFORM_ID,
			{ taskID }
		);
		const response: Responses.Response = (await create(request)) as Responses.Response;
		return response;
	}
	protected parseOpenAIResponse<T = Record<string, any>>(responsesReponse: Responses.Response): T {
		const response = responsesReponse.output_text;
		if (!response) {
			throw new AIEnrichmentError("No response from OpenAI");
		}
		// detect JSON
		if (response.includes("```json")) {
			const jsonStart = response.indexOf("```json") + 7;
			const jsonEnd = response.indexOf("```", jsonStart);
			const json = response.substring(jsonStart, jsonEnd);
			return JSON.parse(json);
		}
		return JSON.parse(response);
	}

	private isResponseInput(
		input: string | Responses.ResponseInput | Partial<Responses.ResponseCreateParams>
	): input is Responses.ResponseInput {
		return Array.isArray(input) && input.every(item => typeof item === "object" && "role" in item && "content" in item);
	}
	private isResponseCreateParams(
		input: string | Responses.ResponseInput | Partial<Responses.ResponseCreateParams>
	): input is Partial<Responses.ResponseCreateParams> & { input: Responses.ResponseInput } {
		return typeof input === "object" && "input" in input;
	}

	protected async updateTaskMetadata(taskId: UUID, metadata: Record<string, any>): Promise<void> {
		await this.updateTask(taskId, {
			metadata: this.db.raw(`COALESCE(metadata::jsonb, '{}'::jsonb) || ?::jsonb`, [JSON.stringify(metadata)])
		});
	}
}
