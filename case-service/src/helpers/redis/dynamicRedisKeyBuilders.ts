import { UUID } from "@joinworth/types/dist/utils/utilityTypes";

export const buildApplicationEditInviteRedisKey = (customerID: UUID, caseID: UUID) => `{customer}:${customerID}:{application-edit-invite}:${caseID}`;

