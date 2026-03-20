import type { KafkaMessage } from "kafkajs";

export * from "./business";
export * from "./case";
export * from "./integration";
export * from "./scores";
export * from "./report";
export * from "./electronic-consent";
export * from "./entity-matching";
export * from "./notifications";

export interface IEventsHandler {
	handleEvent: (event: KafkaMessage) => Promise<void>;
}
