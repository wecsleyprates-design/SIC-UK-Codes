import { db } from "#helpers/knex";
import { INTEGRATION_ID } from "#constants";
import type { IBusinessEntityPerson } from "#types/db";
import type { UUID } from "crypto";

/**
 * Data access for UBO extraction flow.
 * Keeps SQL concerns out of the extractor orchestration logic.
 */
export class TruliooUBORepository {
	async fetchMiddeskDiscoveredOfficers(businessId: UUID): Promise<IBusinessEntityPerson[]> {
		return db<IBusinessEntityPerson>("integration_data.business_entity_people as bep")
			.select(
				"bep.id",
				"bep.business_entity_verification_id",
				"bep.created_at",
				"bep.updated_at",
				"bep.name",
				"bep.submitted",
				"bep.metadata",
				"bep.source",
				"bep.titles"
			)
			.join(
				"integration_data.business_entity_verification as bev",
				"bep.business_entity_verification_id",
				"bev.id"
			)
			.join(
				"integrations.data_business_integrations_tasks as task",
				"bev.business_integration_task_id",
				"task.id"
			)
			.join(
				"integrations.data_connections as conn",
				"task.connection_id",
				"conn.id"
			)
			.where("conn.business_id", businessId)
			.where("conn.platform_id", INTEGRATION_ID.MIDDESK)
			.where("bep.submitted", false);
	}
}
