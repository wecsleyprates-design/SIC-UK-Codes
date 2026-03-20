import { IntegrationFactGetMetadata } from "./IntegrationFactGetMetadata";
import { IntegrationFactAdapter } from "./IntegrationFactAdapter";
import { IntegrationFactEntityMatchingMetadata } from "./IntegrationFactEntityMatchingMetadata";

export interface IntegrationFactEntityMatchingAdapter<T extends IntegrationFactEntityMatchingMetadata>
	extends IntegrationFactAdapter<T> {
	getMetadata: IntegrationFactGetMetadata<T>;
}
