/**
 * Base type for integration adapters.
 * Adapters convert resolved facts into platform-specific metadata formats.
 */
export interface IntegrationFactGetMetadata<M = Record<string, unknown>> {
	(businessID: string): Promise<M | undefined>;
}
