import type { IntegrationPlatformId } from "#constants";
import type { FactName } from "#lib/facts/types";
import type { UUID } from "crypto";
import type { Responses } from "openai/resources";

export type AIEnrichmentTask = {
	dependentFacts: {
		[factName: string]: {
			minimumSources?: number;
			resolvedSources?: number;
			currentValue?: any;
			previousValue?: any;
		};
	};
	timeout: number; // number of seconds to wait before just running the task
};

export type EnqueuedJob = {
	business_id: UUID;
	task_id: UUID;
	platform_id: IntegrationPlatformId;
};

export type AIEnrichmentRequestResponse<T> = {
	factValues: Record<FactName, any>;
	response: T;
	confidence: number; // 0-1, 1==100%, 0 = 0%
	externalId?: string;
};

export type ResponseCreateWithInput = Partial<Responses.ResponseCreateParams> & {
	input: Responses.ResponseInputItem[];
};
