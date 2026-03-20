import { sendWebhookEvent } from "#common/common";
import { QUEUES, QUEUE_EVENTS, WEBHOOK_EVENTS } from "#constants/index";
import { BullQueue } from "#helpers/bullQueue";
import { sqlQuery, sqlTransaction } from "#helpers/database";
import { logger } from "#helpers/logger";
import { type Job } from "bull";

export const invitationStatusQueue = new BullQueue(QUEUES.INVITATION_STATUS);

export const invitationStatusWorker = () => {
	invitationStatusQueue.queue.process(QUEUE_EVENTS.INVITATION_STATUS_UPDATE, async (job: Job) => {
		logger.info(`Processing invitation status job with data: ${JSON.stringify(job.data)}`);
		const tokenData = job.data;
		const getDataInvitesQuery = `SELECT core_invite_statuses.code as invitation_status, data_invites.customer_id, 
			data_invites.case_id, data_invites.business_id, data_businesses.name as business_name FROM data_invites
			LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
			JOIN data_businesses ON data_businesses.id = data_invites.business_id
			WHERE data_invites.id = $1
			AND data_businesses.is_deleted = false`;

		const inviteStatus: any = await sqlQuery({ sql: getDataInvitesQuery, values: [tokenData.invitation_id] });

		if (["accepted", "completed", "rejected", "revoked"].includes(inviteStatus.rows[0].invitation_status as string)) return;

		if (inviteStatus.rows[0].invitation_status !== "expired") {
			const updateInviteQuery = `UPDATE data_invites
				SET status = (SELECT id FROM core_invite_statuses WHERE code = $1)
				WHERE data_invites.id = $2`;

			const updateInviteValues = ["expired", tokenData.invitation_id];

			const insertHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status)
				VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2))`;

			const insertHistoryValues = [tokenData.invitation_id, "expired"];

			await sqlTransaction([updateInviteQuery, insertHistoryQuery], [updateInviteValues, insertHistoryValues]);

			const payload = {
				case_id: inviteStatus.rows[0].case_id,
				status: "EXPIRED",
				business_id: inviteStatus.rows[0].business_id,
				business_name: inviteStatus.rows[0].business_name
			};
			await sendWebhookEvent(inviteStatus.rows[0].customer_id, WEBHOOK_EVENTS.ONBOARDING_INVITE_EXPIRED, payload);
		}
	});
};
