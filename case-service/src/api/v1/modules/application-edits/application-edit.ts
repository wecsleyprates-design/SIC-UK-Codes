import { CASE_STATUS, ERROR_CODES, kafkaEvents, kafkaTopics, SCORE_TRIGGER } from "#constants";
import { db, producer, redis, resolveApplicantIdForAudit } from "#helpers";
import { UserInfo } from "#types";
import { JsonObject } from "aws-jwt-verify/safe-json-parse";
import { UUID } from "crypto";
import { calculateBusinessFactsEvent, sendEventToFetchAdverseMedia } from "#common/index";
import { ApplicationEditApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { caseManager } from "#core";
import { businesses } from "../businesses/businesses";
import { buildApplicationEditInviteRedisKey } from "#helpers/redis";

type StageName = "company" | "ownership" | "processing_history" | "tax_filing";
class ApplicationEdit {
	async editApplication(
		params: { businessID: UUID },
		body: {
			case_id: UUID;
			customer_id: UUID;
			stage_name: string;
			created_by: UUID;
			user_name: string;
			data: {
				field_name: string;
				old_value: string | null;
				new_value: string | null;
				metadata?: JsonObject;
			}[];
		}
	) {
		const { businessID } = params;
		const { case_id, customer_id, stage_name, created_by, user_name, data } = body;

		const insertData = data
			.map(edit => {
				if (edit.old_value === edit.new_value) {
					return;
				}

				return {
					case_id,
					business_id: businessID,
					customer_id,
					field_name: edit.field_name,
					stage_name,
					old_value: edit.old_value,
					new_value: edit.new_value,
					metadata: edit.metadata ?? {},
					created_by
				};
			})
			.filter(Boolean);

		if (insertData.length) {
			await db("application_edits.data_application_edits").insert(insertData);

			const message = {
				business_id: businessID,
				case_id,
				customer_id,
				created_by,
				user_name,
				stage_name,
				data
			};
			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.APPLICATION_EDIT,
							...message
						}
					}
				]
			});
			await calculateBusinessFactsEvent(params.businessID);
		}
	}

	async getApplicationEdit(params: { businessID: UUID }, body: { stage_name: StageName }) {
		try {
			let records = await db("application_edits.data_application_edits")
				.where("business_id", params.businessID)
				.modify(qb => {
					if (body.stage_name) {
						qb.andWhere("stage_name", body.stage_name);
					}
				});
			records = records.filter(record => !(record.old_value === null && record.new_value === null));
			return records;
		} catch (err) {
			throw err;
		}
	}

	async getEditApplicationStatus(params: { customerID: UUID }, body: { case_id: UUID }, userInfo: UserInfo) {
		try {
			const { customerID } = params;
			const { case_id } = body;
			const redisKey = buildApplicationEditInviteRedisKey(customerID, case_id);
			const cachedData = await redis.get<{ link: string; inviteToken: any; customerID: UUID; applicantID: UUID }>(
				redisKey
			);

			let activeSession: boolean = false;
			if (cachedData) {
				activeSession = true;
			}
			return {
				is_session_active: activeSession,
				session_user_id: userInfo?.issued_for?.user_id
			};
		} catch (err) {
			throw err;
		}
	}

	async clearApplicationEditLock(
		params: { businessID: UUID },
		body: { case_id: UUID; customer_id: UUID },
		userInfo: UserInfo
	) {
		try {
			const { case_id, customer_id } = body;

			const redisKey = buildApplicationEditInviteRedisKey(customer_id, case_id);
			const cachedData = await redis.get<{ link: string; inviteToken: any; customerID: UUID; applicantID: UUID }>(
				redisKey
			);

			if (!cachedData) {
				throw new ApplicationEditApiError("No active session found.", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			// Check if current user is the applicant
			if (userInfo.user_id !== cachedData?.inviteToken?.applicant_id) {
				throw new ApplicationEditApiError(
					"You are not allowed to access this data.",
					StatusCodes.UNAUTHORIZED,
					ERROR_CODES.UNAUTHORIZED
				);
			}

			await redis.delete(redisKey);

			return { success: true };
		} catch (err) {
			throw err;
		}
	}

	async submitEditApplication(params: { businessID: UUID }, body: { case_id: UUID }, userInfo: UserInfo) {
		try {
			const { case_id } = body;

			let customerID = userInfo?.issued_for?.customer_id;
			const cachedApplicationEditInvite = await caseManager.getCachedApplicationEditInvite(case_id, customerID);
			const applicantID = cachedApplicationEditInvite?.applicantID;

			if (cachedApplicationEditInvite) {
				customerID = cachedApplicationEditInvite.customerID;
				await caseManager.deleteCachedApplicationEditInvite(case_id, customerID)
			}

			// Delete existing integration data. Currently, only adverse media data is being removed as per the scope of PAT-515
			await producer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: params.businessID,
						value: {
							event: kafkaEvents.DELETE_INTEGRATION_DATA,
							case_id: case_id,
							business_id: params.businessID,
							customer_id: customerID
						}
					}
				]
			});

			await producer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: params.businessID,
						value: {
							event: kafkaEvents.CASE_SUBMITTED_EXECUTE_TASKS,
							case_id: case_id,
							business_id: params.businessID
						}
					}
				]
			});

			await sendEventToFetchAdverseMedia(params.businessID, customerID as UUID, case_id);

			const event = {
				case_id: case_id,
				trigger_type: SCORE_TRIGGER.APPLICATION_EDIT
			};

			const payload = {
				topic: kafkaTopics.SCORES,
				messages: [
					{
						key: params.businessID,
						value: {
							event: kafkaEvents.RESCORE_CASE_EVENT,
							...event
						}
					}
				]
			};

		await producer.send(payload);

		const businessDetails = await businesses.getBusinessByID({ businessID: params.businessID });
		const auditMessage = {
			case_id: case_id,
			business_name: businessDetails.name,
			applicant_id: resolveApplicantIdForAudit({
				userInfo,
				cachedApplicationEditInvite
			}),
			business_id: params.businessID
		};
		await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: params.businessID,
						value: {
							event: kafkaEvents.CASE_UPDATED_AUDIT,
							...auditMessage
						}
					}
				]
			});

			const { previousStatus } = await caseManager.updateCaseStatus(
				{ caseId: case_id, status: CASE_STATUS.SUBMITTED, userId: userInfo.user_id },
				[]
			);

			await calculateBusinessFactsEvent(params.businessID, case_id, customerID as UUID, previousStatus);

			return {
				is_session_active: false,
				applicant_id: applicantID ?? null
			};
		} catch (err) {
			throw err;
		}
	}
}

export const applicationEdit = new ApplicationEdit();
