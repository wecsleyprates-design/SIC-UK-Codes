import { invitationStatusWorker } from "./invitationStatus";
import { initTaskWorker } from "./taskWorker";

export const initWorkers = () => {
	invitationStatusWorker();
	initTaskWorker();
};

export * from "./invitationStatus";
export * from "./taskWorker";
