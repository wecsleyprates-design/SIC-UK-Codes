import { BusinessApiError, InternationalBusinessError } from "./error";
import { StatusCodes } from "http-status-codes";
import {
	ERROR_CODES,
	kafkaEvents,
	kafkaTopics,
	OWNER_FIELDS_TO_ENCRYPT,
	OWNER_TYPES,
	OWNERSHIP_FIELD_NAMES,
	OWNERSHIP_SUB_FIELD_NAMES,
	progressionStages,
	WEBHOOK_EVENTS
} from "#constants";
import {
	db,
	producer,
	redis,
	logger,
	isCountryAllowedWithSetupCheck,
	resolveCountryCode,
	getBusinessApplicants,
	resolveApplicantIdForAudit
} from "#helpers";
import {
	decryptData,
	decryptEin,
	encryptEin,
	encryptFields,
	formatNumberWithoutPlus,
	pick,
	safeDecrypt,
	safeEncrypt,
	sanitizeDate
} from "#utils";
import { sendEventToGatherWebhookData, triggerSectionCompletedKafkaEventWithRedis } from "#common";
import currency from "currency.js";
import { v4 as uuid } from "uuid";
import { applicationEdit } from "../application-edits/application-edit";
import { BusinessInvites } from "./businessInvites";
import { getCase } from "#core/data-cases";
import type { DataCase } from "#core/data-cases";
import type { Business, UserInfo } from "#types";
import type { UUID } from "crypto";
import type { Knex } from "knex";

export abstract class Owners {
	private static DEFAULT_COUNTRY_CODE = "US";

	/**
	 * get the mapping of owner titles by title id
	 * @returns {object} mapping of id with object of title and id
	 */
	public static async getOwnerTitles(): Promise<Record<number, { id: number; title: string }>> {
		return db<{ id: number; title: string }>("core_owner_titles")
			.select("*")
			.then(titles =>
				titles.reduce((acc, title) => {
					(acc ?? {})[title.id] = title;
					return acc;
				})
			);
	}

	/**
	 * Resolve owner title to a display string for audit comparison.
	 * Owner from DB may have title as { id, title } (join); body after normalize has title as id (number).
	 */
	private static resolveTitleDisplay(
		titles: Record<number, { id: number; title: string }>,
		value: unknown
	): string | null {
		if (value == null) return null;
		const id =
			typeof value === "object" && value !== null && "id" in value
				? (value as { id: number }).id
				: value;
		if (typeof id !== "number") return null;
		return titles[id]?.title ?? null;
	}

	public static async updateOwner(
		body,
		params: { ownerID: string; businessID: string },
		userInfo: UserInfo,
		headers?: { authorization: string }
	) {
		try {
			let totalOwnershipPercent = 0;
			let controlOwnerExists = false;
			let customerID: UUID | null = null;
			let caseID: UUID | null = null;

			//Lazy load to avoid circular dependency
			const { businesses } = await import("./businesses");
			let progressionConfig: object[] = [];

			if (body.invitation_id) {
				try {
					const invitation = await BusinessInvites.fromId(body.invitation_id);
					if (invitation.business_id !== params.businessID) {
						throw new BusinessApiError("Invitation is not linked with this business");
					}
					customerID = invitation.customer_id ?? null;
					caseID = invitation.case_id ?? null;

					customerID && (progressionConfig = await businesses.getProgressionConfig(customerID));
				} catch (_error: unknown) {
					throw new BusinessApiError(
						"Invitation is not linked with this business",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}
			// Resolve caseID/customerID when not from invitation: body.case_id (e.g. customer admin from microsite) or guest_owner fallback
			const getCaseParams = {
				business_id: params.businessID,
				...(body.case_id && { id: body.case_id }),
				...(userInfo?.is_guest_owner && userInfo?.issued_for?.user_id && {
					applicant_id: userInfo.issued_for.user_id
				})
			};
			const dataCase: Pick<DataCase, "id" | "customer_id"> | undefined =
				await getCase(getCaseParams);
			if (dataCase) {
				caseID = dataCase.id as UUID;
				customerID = (dataCase.customer_id ?? null) as UUID | null;
				if (customerID) progressionConfig = await businesses.getProgressionConfig(customerID);
			}
			if (userInfo?.is_guest_owner && !caseID) {
				throw new BusinessApiError(
					"You are not allowed to update owner details without invitation",
					StatusCodes.UNAUTHORIZED,
					ERROR_CODES.NOT_ALLOWED
				);
			}
			if (!userInfo.role?.code || ["ADMIN"].includes(userInfo.role?.code)) {
				const businessApplicants = await getBusinessApplicants(params.businessID, headers?.authorization);
				if (!businessApplicants.some(applicant => applicant.id === userInfo.user_id)) {
					throw new BusinessApiError(
						"You are not allowed to access details of this business",
						StatusCodes.UNAUTHORIZED,
						ERROR_CODES.UNAUTHENTICATED
					);
				}
			}
			const businessOwners = (await this.getOwnersSQL({ business_id: params.businessID })) ?? [];
			const owner = businessOwners.find(owner => owner.id === params.ownerID);
			if (!businessOwners.length || !owner) {
				throw new BusinessApiError("Owner not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			const otherOwners = businessOwners.filter(owner => owner.id !== params.ownerID);
			totalOwnershipPercent = otherOwners.reduce((acc, owner) => acc + Number(owner?.ownership_percentage), 0);
			controlOwnerExists = otherOwners.some(owner => owner.owner_type === OWNER_TYPES.CONTROL);

			const extendedOwnershipSetting = businesses.getFieldFromProgressionConfig(
				progressionConfig,
				progressionStages.OWNERSHIP,
				OWNERSHIP_FIELD_NAMES.EXTENDED_OWNERSHIP
			);
			const isExtendedOwnershipEnabled = extendedOwnershipSetting?.status ?? false;

			const minBeneficialOwnerPercentage = this.identifyMinimumOwnershipPercentage(isExtendedOwnershipEnabled);

			if (
				(body?.is_owner_beneficiary === true || body?.owner_type === OWNER_TYPES.BENEFICIARY) &&
				body?.ownership_percentage < minBeneficialOwnerPercentage
			) {
				// If is_owner_beneficiary is true, ownership_percentage must be between minBeneficialOwnerPercentage and 100
				throw new BusinessApiError(`Ownership percentage must be between ${minBeneficialOwnerPercentage} and 100 when owner is a beneficiary.`);
			}

			if (isExtendedOwnershipEnabled) {
				const ownerLimits = await this.getExtendedOwnershipLimits(extendedOwnershipSetting.sub_fields);
				this.validateExtendedOwnership(body, otherOwners, ownerLimits);
			}

			// check for max one control owner only
			if (!isExtendedOwnershipEnabled && controlOwnerExists && body?.owner_type === OWNER_TYPES.CONTROL) {
				throw new BusinessApiError(
					"Business can have one control owner at max",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			} else if (body?.owner_type === OWNER_TYPES.CONTROL) {
				controlOwnerExists = true;
			} else if (body?.owner_type === OWNER_TYPES.BENEFICIARY && Object.hasOwn(body, "is_owner_beneficiary")) {
				throw new BusinessApiError(
					"Combination of is_owner_beneficiary & owner_type as BENEFICIARY is not valid",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			totalOwnershipPercent += body?.ownership_percentage || 0;
			if (totalOwnershipPercent > 100) {
				throw new BusinessApiError(
					"Total ownership percentage is greater than 100",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			const ownerFields = [
				"title",
				"first_name",
				"last_name",
				"date_of_birth",
				"address_postal_code",
				"address_apartment",
				"address_line_1",
				"address_line_2",
				"address_city",
				"address_state",
				"address_country",
				"mobile",
				"email",
				"ssn"
			];
			const ownerRelFields = ["ownership_percentage"];

			if (body?.mobile) {
				if (!body.mobile.startsWith("+")) {
					body.mobile = `+1${body.mobile}`;
				}
				body.mobile = `+${formatNumberWithoutPlus(body.mobile)}`;
			}
			if (body?.ssn) {
				body.ssn = encryptEin(body.ssn);
			} else {
				body.ssn = null;
			}
			// Some clients may echo back encrypted DOB (e.g. values previously returned from APIs).
			// Normalize to plaintext date string before writing to the DB.
			if (body?.date_of_birth) {
				body.date_of_birth = safeDecrypt(String(body.date_of_birth), decryptData);
			}
			if (!body?.date_of_birth) {
				body.date_of_birth = null;
			}
			if (body?.title) {
				body.title = body.title.id;
			}
			if (body?.address_country) {
				body.address_country = resolveCountryCode(body.address_country);
			}
			const updateOwnerData: Record<string, any> = {
				updated_by: userInfo.user_id,
				updated_at: db.fn.now()
			};
			for (const field of ownerFields) {
				if (Object.hasOwn(body, field)) {
					updateOwnerData[field] = body[field] || null;
				}
			}

			await db.transaction(async trx => {
				await trx("data_owners").update(updateOwnerData).where({ id: params.ownerID });
				await trx("rel_business_owners")
					.update({
						owner_type: body.owner_type ? body.owner_type : owner.owner_type,
						ownership_percentage:
							body.ownership_percentage != null ? body.ownership_percentage : owner.ownership_percentage
					})
					.where({ business_id: params.businessID, owner_id: params.ownerID });
			});

			const changedFields: any[] = [];
			const titles = await this.getOwnerTitles();
			// Build diff for the single owner being updated (supports both guest owner and customer admin for audit)
			ownerFields.forEach(field => {
				if (!Object.hasOwn(body, field)) return;
				const bodyVal = body[field];
				if (bodyVal === undefined) return;
				let oldValue = owner[field];
				let newValue = bodyVal;
				if (field === "title") {
					oldValue = this.resolveTitleDisplay(titles, owner[field]);
					newValue = this.resolveTitleDisplay(titles, bodyVal);
					if (newValue === oldValue) return;
				} else if (field === "date_of_birth") {
					oldValue = oldValue ? new Date(oldValue).toISOString() : null;
					newValue = newValue ? new Date(newValue).toISOString() : null;
					if (newValue === oldValue) return;
				} else if (field === "ssn") {
					try {
						oldValue = oldValue ? decryptEin(oldValue) : null;
						newValue = newValue ? decryptEin(newValue) : null;
						if (oldValue === newValue) return;
					} catch {
						if (String(oldValue) === String(newValue)) return;
					}
				} else if (field === "address_country") {
					oldValue = resolveCountryCode(oldValue);
					newValue = resolveCountryCode(newValue);
					if (newValue === oldValue) return;
				} else if (oldValue === newValue) {
					return;
				}
				changedFields.push({
					field_name: field,
					old_value: oldValue,
					new_value: newValue,
					metadata: { owner_id: params.ownerID, is_updated: true }
				});
			});
			ownerRelFields.forEach(field => {
				if (!Object.hasOwn(body, field)) return;
				const bodyVal = body[field];
				if (bodyVal === undefined) return;
				let ownerRelOldValue = owner[field];
				let ownerRelNewValue = bodyVal;
				if (field === "ownership_percentage") {
					const toNumericStr = (value: unknown) => {
						const num = Number(value);
						return isNaN(num) ? null : num.toFixed(2);
					};
					ownerRelOldValue = toNumericStr(ownerRelOldValue);
					ownerRelNewValue = toNumericStr(ownerRelNewValue);
					if (ownerRelNewValue === ownerRelOldValue) return;
				} else if (ownerRelOldValue === ownerRelNewValue) return;
				changedFields.push({
					field_name: field,
					old_value: ownerRelOldValue,
					new_value: ownerRelNewValue,
					metadata: { owner_id: params.ownerID, is_updated: true }
				});
			});

			// Send application_edit event for audit when we have case context (invite, body.case_id, or guest fallback)
			const resolvedCustomerID = customerID ?? (userInfo?.is_guest_owner ? userInfo?.issued_for?.customer_id : undefined);
			const createdBy = userInfo
				? resolveApplicantIdForAudit({
						userInfo: {
							user_id: userInfo.user_id,
							is_guest_owner: userInfo.is_guest_owner,
							issued_for: userInfo.issued_for
						},
						cachedApplicationEditInvite: undefined
					})
				: undefined;
			const getFullName = (p: { first_name?: string; last_name?: string } | null | undefined) =>
				`${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();
			const userName = userInfo?.is_guest_owner
				? getFullName(userInfo.issued_for)
				: getFullName(userInfo) || "Customer Admin";
			if (
				changedFields.length &&
				caseID &&
				resolvedCustomerID &&
				createdBy &&
				userName
			) {
				await applicationEdit.editApplication(
					{
						businessID: params.businessID as UUID
					},
					{
						case_id: caseID,
						customer_id: resolvedCustomerID as UUID,
						stage_name: "ownership",
						created_by: createdBy as UUID,
						user_name: userName,
						data: changedFields
					}
				);
			}

			await this.sendOwnerUpdateEvent(params.ownerID);

			await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: params.businessID });

			return params.ownerID;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description delete a business owner
	 * @param params.ownerID : ID of a business owner
	 * @param params.businessID : ID of a business
	 */
	public static async deleteBusinessOwner(
		params: { ownerID: string; businessID: string },
		query: { invitation_id?: UUID },
		userInfo: UserInfo
	) {
		try {
			//Lazy load to avoid circular dependency
			const { businesses } = await import("./businesses");
			let progressionConfig: object[] = [];

			if (!query.invitation_id && userInfo?.is_guest_owner) {
				throw new BusinessApiError(
					"You are not allowed to delete owner details without invitation",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.NOT_ALLOWED
				);
			}

			let caseID: UUID | null = null;
			let customerID: UUID | null = null;

			if (query.invitation_id) {
				try {
					const invitation = await BusinessInvites.fromId(query.invitation_id);
					if (invitation.business_id !== params.businessID) {
						throw new BusinessApiError("Invitation is not linked with this business");
					}
					caseID = invitation.case_id ?? null;
					customerID = invitation.customer_id ?? null;

					customerID && (progressionConfig = await businesses.getProgressionConfig(customerID));
				} catch (_error: unknown) {
					throw new BusinessApiError(
						"Invitation is not linked with this business",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}

			const businessesForOwner: (Business.Owner & { business_id: UUID })[] =
				(await this.getOwnersSQL({ id: params.ownerID })) ?? [];
			const otherBusinessesJoinedToOwner = businessesForOwner.filter(
				business => business.business_id !== params.businessID
			);

			const owner: Business.Owner | undefined = businessesForOwner.find(
				owner => owner.business_id === params.businessID
			);
			if (!owner) {
				throw new BusinessApiError("Owner not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const extendedOwnershipSetting = businesses.getFieldFromProgressionConfig(
				progressionConfig,
				progressionStages.OWNERSHIP,
				OWNERSHIP_FIELD_NAMES.EXTENDED_OWNERSHIP
			);
			const isExtendedOwnershipEnabled = extendedOwnershipSetting?.status ?? false;

			if (owner.owner_type === OWNER_TYPES.CONTROL && !isExtendedOwnershipEnabled) {
				throw new BusinessApiError("Control owner cannot be deleted", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const changedFields: {
				field_name: string;
				old_value: any;
				new_value: any;
				metadata: { owner_id: string; is_deleted: boolean };
			}[] = [];
			if (userInfo?.is_guest_owner) {
				const fields = [
					"title",
					"first_name",
					"last_name",
					"ssn",
					"email",
					"mobile",
					"date_of_birth",
					"address_apartment",
					"address_line_1",
					"address_line_2",
					"address_city",
					"address_state",
					"address_postal_code",
					"address_country",
					"ownership_percentage",
					"owner_type"
				];

				const titles = await Owners.getOwnerTitles();

				Object.keys(owner).map(field => {
					if (fields.includes(field)) {
						let oldValue = owner[field] ?? null;
						if (field === "date_of_birth") {
							oldValue = oldValue ? new Date(oldValue).toISOString() : null;
						} else if (field === "title") {
							oldValue = this.resolveTitleDisplay(titles, owner[field]);
						}

						if (oldValue) {
							changedFields.push({
								field_name: field,
								old_value: oldValue,
								new_value: null,
								metadata: { owner_id: params.ownerID, is_deleted: true }
							});
						}
					}
				});
			}

			if (otherBusinessesJoinedToOwner.length) {
				// Delete the relation between owner and business
				await db("rel_business_owners").where({ business_id: params.businessID, owner_id: params.ownerID }).delete();
			} else if (otherBusinessesJoinedToOwner.length === 0) {
				// Delete the owner and the relation between owner and business
				await db.transaction(async trx => {
					await trx("rel_business_owners").where({ owner_id: params.ownerID, business_id: params.businessID }).delete();
					await trx("data_owners").where({ id: params.ownerID }).delete();
				});
			}

			if (userInfo?.is_guest_owner && changedFields.length && caseID) {
				await applicationEdit.editApplication(
					{
						businessID: params.businessID as UUID
					},
					{
						case_id: caseID,
						customer_id: userInfo?.issued_for?.customer_id as UUID,
						stage_name: "ownership",
						created_by: userInfo?.issued_for?.user_id as UUID,
						user_name: `${userInfo?.issued_for?.first_name} ${userInfo?.issued_for?.last_name}`,
						data: changedFields
					}
				);
			}

			await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: params.businessID });
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {object} body
	 * @param {uuid} params.businessID: Id of a business
	 * @param {uuid} userInfo.user_id: for adding the user as created_by
	 * @param {object} options.bypassMinPercentageValidation: specifies if the function should skip validating minimum ownership percentage.
	 * Currently, bulk processes do not validate minimum ownership percentage. TODO: Identify if this is the intended functionality.
	 */
	public static async addOrUpdateOwners(
		body: { owners: Partial<Business.Owner>[]; customerID: UUID; invitation_id?: UUID | null },
		businessID: UUID,
		userInfo: UserInfo,
		options?: { bypassMinPercentageValidation: boolean }
	): Promise<UUID[]> {
		try {
			let controlOwner: Partial<Business.Owner> | undefined;
			let customerID: UUID | null = body?.customerID ?? null;
			let caseID: UUID | null = null;
			// Identify countries that are not allowed based on setup check
			const disallowedInternationalCountries: string[] = [];
			//Lazy load to avoid circular dependency
			const { businesses } = await import("./businesses");
			let progressionConfig: object[] = [];

			if (!body?.invitation_id && userInfo?.is_guest_owner) {
				throw new BusinessApiError(
					"You are not allowed to update owner details without invitation",
					StatusCodes.UNAUTHORIZED,
					ERROR_CODES.NOT_ALLOWED
				);
			}

			if (body.invitation_id) {
				try {
					const invitation = await BusinessInvites.fromId(body.invitation_id);
					if (invitation.business_id !== businessID) {
						throw new BusinessApiError("Invitation is not linked with this business");
					}
					customerID = invitation.customer_id ?? null;
					caseID = invitation.case_id ?? null;

					customerID && (progressionConfig = await businesses.getProgressionConfig(customerID));
				} catch (_error: unknown) {
					throw new BusinessApiError(
						"Invitation is not linked with this business",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}
			const currentOwners = await Owners.getBusinessOwnersUnencrypted(businessID);
			// Map the current owners' ownership percentages to their IDs so we can later check if we somehow get up over 100%
			const currentOwnersOwnershipPercentages: Record<string, number> = currentOwners.reduce((acc, owner) => {
				acc[owner.id] = currency(owner.ownership_percentage ?? 0).value;
				return acc;
			}, {});
			const foundOwner: Business.Owner | undefined = currentOwners.find(owner => owner.owner_type === OWNER_TYPES.CONTROL);
			if (foundOwner) {
				// Make a copy to avoid weird mutation issues
				controlOwner = { ...foundOwner };
			}

			const upsertedOwnerIds: UUID[] = [];
			const changedFields: {
				field_name: string;
				old_value: any;
				new_value: any;
				metadata: { owner_id: string; is_inserted: boolean };
			}[] = [];

			const extendedOwnershipSetting = businesses.getFieldFromProgressionConfig(
				progressionConfig,
				progressionStages.OWNERSHIP,
				OWNERSHIP_FIELD_NAMES.EXTENDED_OWNERSHIP
			);
			const isExtendedOwnershipEnabled = extendedOwnershipSetting?.status ?? false;

			// Avoid duplicate validation when creating/updating owners in bulk
			if (isExtendedOwnershipEnabled && !options?.bypassMinPercentageValidation) {
				const ownerLimits = await this.getExtendedOwnershipLimits(extendedOwnershipSetting.sub_fields);
				this.validateExtendedOwnership(body.owners, currentOwners, ownerLimits);
			}
			
			// There does not exist a minimum beneficial ownership percentage when creating/updating owners in bulk
			// TODO: Identify if this is the intended functionality
			const minBeneficialOwnerPercentage = options?.bypassMinPercentageValidation ? 0 :
				this.identifyMinimumOwnershipPercentage(isExtendedOwnershipEnabled);

			await db.transaction(async trx => {
				// Iterate though the owner details provided in the request body
				for (const owner of body.owners as Partial<Business.Owner>[]) {
					if (!owner) {
						continue;
					}
					// If no internal id is provided but an external_id is, resolve to the matching
					// existing owner so the upsert below treats this as an update rather than a new insert.
					if (!owner.id && owner.external_id) {
						const match = currentOwners.find(o => o.external_id === owner.external_id);
						if (match) {
							owner.id = match.id;
						}
					}
					const ownerID = owner.id ?? uuid();
					const countryCode: string = owner?.address_country?.toUpperCase() ?? Owners.DEFAULT_COUNTRY_CODE;
					const isAllowed = await isCountryAllowedWithSetupCheck(countryCode, customerID);
					if (!isAllowed) {
						disallowedInternationalCountries.push(countryCode);
						continue;
					}

					if (
						(owner.is_owner_beneficiary === true || owner.owner_type === OWNER_TYPES.BENEFICIARY) &&
						(owner.ownership_percentage ?? 0) < minBeneficialOwnerPercentage
					) {
						// If is_owner_beneficiary is true, ownership_percentage must be between minBeneficialOwnerPercentage and 100
						throw new BusinessApiError(`Ownership percentage must be between ${minBeneficialOwnerPercentage} and 100 when owner is a beneficiary.`);
					}
					
					// check for max one control owner only
					if (
            !isExtendedOwnershipEnabled &&
            controlOwner?.id &&
            owner.owner_type === OWNER_TYPES.CONTROL &&
            owner.id !== controlOwner.id
          ) {
						throw new BusinessApiError(
							`A business can have only one control owner; current control owner is ${controlOwner?.id}`,
							StatusCodes.BAD_REQUEST,
							ERROR_CODES.INVALID
						);
					} else if (owner.owner_type === OWNER_TYPES.CONTROL) {
						controlOwner = { ...owner } as Business.Owner;
					} else if (owner.owner_type === OWNER_TYPES.BENEFICIARY && Object.hasOwn(owner, "is_owner_beneficiary")) {
						throw new BusinessApiError(
							"Combination of is_owner_beneficiary & owner_type as BENEFICIARY is not valid",
							StatusCodes.BAD_REQUEST,
							ERROR_CODES.INVALID
						);
					}
					currentOwnersOwnershipPercentages[ownerID] = currency(owner.ownership_percentage ?? 0).value;

					this.mutateOwnerFields(owner);
					upsertedOwnerIds.push(ownerID as UUID);
					await trx("data_owners")
						.insert({
							id: ownerID,
							title: owner?.title?.id ?? null,
							first_name: owner.first_name,
							last_name: owner.last_name,
							date_of_birth: owner.date_of_birth,
							address_postal_code: owner.address_postal_code,
							address_apartment: owner.address_apartment,
							address_line_1: owner.address_line_1,
							address_line_2: owner.address_line_2,
							address_city: owner.address_city,
							address_state: owner.address_state,
							address_country: resolveCountryCode(countryCode),
							mobile: owner.mobile,
							email: owner.email,
							ssn: owner.ssn ? safeEncrypt(owner.ssn, encryptEin, decryptEin) : undefined,
							created_by: userInfo.user_id,
							updated_by: userInfo.user_id
						})
						.onConflict(["id"])
						.merge({
							title: owner?.title?.id ?? null,
							first_name: owner.first_name,
							last_name: owner.last_name,
							date_of_birth: owner.date_of_birth,
							address_postal_code: owner.address_postal_code,
							address_apartment: owner.address_apartment,
							address_line_1: owner.address_line_1,
							address_line_2: owner.address_line_2,
							address_city: owner.address_city,
							address_state: owner.address_state,
							address_country: resolveCountryCode(countryCode),
							mobile: owner.mobile,
							email: owner.email,
							ssn: owner.ssn ? safeEncrypt(owner.ssn, encryptEin, decryptEin) : undefined,
							updated_by: userInfo.user_id,
							updated_at: db.fn.now()
						});

					await trx("rel_business_owners")
						.insert({
							business_id: businessID,
							owner_id: ownerID,
							owner_type: owner.owner_type,
							ownership_percentage: owner.ownership_percentage,
							external_id: owner.external_id ?? null
						})
						.onConflict(["business_id", "owner_id"])
						.merge({
							owner_type: owner.owner_type,
							ownership_percentage: owner.ownership_percentage
							// external_id intentionally omitted — set once on insert, not mutable
						});

					Object.keys(owner).map(field => {
						let newVal = owner[field];
						if (field === "title") {
							newVal = owner?.title?.title ?? null;
						} else if (field === "date_of_birth") {
							newVal = newVal ? new Date(newVal).toISOString() : null;
						} else if (field === "address_country") {
							newVal = resolveCountryCode(newVal);
						}
						changedFields.push({
							field_name: field,
							old_value: null,
							new_value: newVal,
							metadata: { owner_id: ownerID, is_inserted: true }
						});
					});
				}

				// Final? validation related checks
				if (disallowedInternationalCountries.length > 0) {
					throw new InternationalBusinessError(
						`International owners detected from countries not allowed by setup: ${[
							...new Set(disallowedInternationalCountries)
						].join(", ")}`,
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.NOT_ALLOWED
					);
				}
				// check for ownership percentage
				const totalOwnershipPercent = Object.values(currentOwnersOwnershipPercentages).reduce(
					(acc, value) => acc + value,
					0
				);
				if (totalOwnershipPercent > 100) {
					throw new BusinessApiError(
						`Total ownership percentage is greater than 100 (${totalOwnershipPercent}%)`,
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			});

			// if guest owner, insert changes made by guest owner
			if (userInfo?.is_guest_owner && changedFields.length && caseID) {
				await applicationEdit.editApplication(
					{ businessID: businessID },
					{
						case_id: caseID,
						customer_id: customerID,
						stage_name: "ownership",
						created_by: userInfo?.issued_for?.user_id as UUID,
						user_name: `${userInfo?.issued_for?.first_name} ${userInfo?.issued_for?.last_name}`,
						data: changedFields
					}
				);
			}

			// Ensure async side-effects complete before returning (important for tests + request lifecycle)
			await Promise.all(upsertedOwnerIds.filter(Boolean).map(ownerId => Owners.sendOwnerUpdateEvent(ownerId)));

			await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: businessID });

			// send event to trigger emails for co-applicants
			let customerIDs: string[] = [];
			try {
				// Lazy load businesses to avoid circular dependency
				const { businesses } = await import("./businesses");
				const customerDetails = await businesses.getCustomersByBusinessId(businessID);
				customerIDs = customerDetails.map(customer => customer.customer_id);
			} catch (err: any) {
				logger.error({ err }, `Error fetching customer IDs for business ${businessID}`);
			}
			if (!userInfo?.is_guest_owner && customerIDs?.[0]) {
				await triggerSectionCompletedKafkaEventWithRedis(
					businessID,
					"Ownership",
					userInfo.user_id as UUID,
					customerIDs[0] as UUID,
					redis
				);
			}
			return upsertedOwnerIds;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get business owners
	 * Encrypts the SSN and date of birth
	 * @param businessID
	 * @returns
	 */
	static async getBusinessOwners(businessID): Promise<Business.Owner[]> {
		const owners = await this.getOwnersSQL({ business_id: businessID });
		return owners.map(owner => encryptFields(owner, OWNER_FIELDS_TO_ENCRYPT));
	}

	/**
	 * Gets owner records -- with sensitive fields decrypted
	 * Should not be serialized to JSON outside this service
	 * @param businessID
	 * @returns
	 */
	static async getBusinessOwnersUnencrypted(businessID): Promise<Business.Owner[]> {
		const owners = await this.getOwnersSQL({ business_id: businessID });
		return owners.map(owner => ({
			...owner,
			ssn: safeDecrypt(owner.ssn, decryptEin),
			date_of_birth: safeDecrypt(owner.date_of_birth, decryptEin)
		}));
	}

	/**
	 * Base Knex query to get owner records with business & title relationships
	 */
	private static getOwnersSQL(
		where: Record<
			keyof Omit<Business.Owner, "created_at" | "updated_at" | "updated_by" | "updated_at"> & {
				business_id: UUID;
				is_deleted: boolean;
			},
			any
		>
	): Knex.QueryBuilder<Business.Owner & { customer_id: UUID | null; business_id: UUID }> {
		const query = db<Business.Owner>("public.data_owners")
			.select(
				"data_owners.*",
				db.raw("to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth"),
				"rel_business_owners.business_id",
				"rel_business_owners.owner_type",
				"rel_business_owners.ownership_percentage",
				"rel_business_owners.business_id",
				"rel_business_owners.external_id",
				db.raw(`json_build_object(
                      'id', core_owner_titles.id,
                      'title', core_owner_titles.title) as title`)
			)
			.join("rel_business_owners", "rel_business_owners.owner_id", "data_owners.id")
			.leftJoin("core_owner_titles", "core_owner_titles.id", "data_owners.title");
		for (const [key, value] of Object.entries(where)) {
			if (
				["owner_type", "ownership_percentage", "business_id", "customer_id", "owner_id", "external_id"].includes(key)
			) {
				query.whereRaw(`rel_business_owners.${key} = ?`, [value]);
			} else {
				query.whereRaw(`data_owners.${key} = ?`, [value]);
			}
		}
		return query;
	}

	/**
	 * Get an owner record with customer relationships
	 * @param ownerId
	 * @returns
	 */
	private static async getOwnerWithCustomerRelationships(
		ownerId: string
	): Promise<Array<Business.Owner & { business_id: UUID; customer_id: UUID | null }>> {
		const ownerRecords: Array<Business.Owner & { business_id: UUID; customer_id: UUID | null }> =
			await this.getOwnersSQL({
				id: ownerId
			})
				.select("rbc.customer_id")
				.join("data_businesses as db", "db.id", "rel_business_owners.business_id")
				.andWhere("db.is_deleted", false)
				.join("rel_business_customer_monitoring as rbc", "rbc.business_id", "rel_business_owners.business_id");

		return ownerRecords.map(owner => encryptFields(owner, OWNER_FIELDS_TO_ENCRYPT)) as Array<
			Business.Owner & { customer_id: UUID | null; business_id: UUID }
		>;
	}

	/**
	 * typeguard to check if the owner is a partial Business.Owner object
	 * @param owner
	 * @returns
	 */
	private static isOwner(owner: unknown): owner is Partial<Business.Owner> {
		if (!owner || typeof owner !== "object") {
			return false;
		}
		return Object.hasOwn(owner, "id") && Object.hasOwn(owner, "first_name") && Object.hasOwn(owner, "last_name");
	}

	/**
	 * Given some unknown (hopefully at least a partial Business.Owner object), return a Business.Owner object with the expected fields
	 * @param owner
	 * @returns
	 */
	private static buildBaseOwner(owner: unknown): Business.Owner {
		if (!this.isOwner(owner)) {
			throw new BusinessApiError("Invalid owner object", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		return pick(owner, [
			"id",
			"external_id",
			"title",
			"first_name",
			"last_name",
			"date_of_birth",
			"address_line_1",
			"address_line_2",
			"address_apartment",
			"address_postal_code",
			"address_city",
			"address_state",
			"address_country",
			"mobile",
			"email",
			"ssn",
			"ownership_percentage",
			"owner_type",
			"created_by",
			"updated_by",
			"created_at",
			"updated_at"
		]);
	}

	/**
	 * TODO: Make this private and remove the admin route when no longer needed
	 * Emit Kafka event for owner being updated
	 * @param ownerId
	 * @param customerId
	 */

	public static async sendOwnerUpdateEvent(ownerId: string, customerId?: UUID) {
		const ownerRecords = await this.getOwnerWithCustomerRelationships(ownerId);
		const sendPromises = ownerRecords.map(async owner => {
			const baseOwner = this.buildBaseOwner(owner);
			const customerIdToSend: UUID | null = customerId ?? owner.customer_id ?? null;
			await producer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: owner.business_id,
						value: {
							event: kafkaEvents.OWNER_UPDATED,
							...baseOwner,
							customer_id: customerIdToSend,
							business_id: owner.business_id,
							owner_id: owner.id
						}
					}
				]
			});
		});
		await Promise.all(sendPromises);
	}

	/**
	 * Mutate the owner fields to the expected format:
	 * 	- Encrypt SSN if provided
	 *  - Plaintext DOB if provided (may exist in encrypted form from previous API calls)
	 *  - Internationalize the phone number
	 *  - Set null for empty fields
	 * @param owner
	 * @returns void (mutates the owner object in place)
	 */
	private static mutateOwnerFields(owner: Partial<Business.Owner>): void {
		// DOB should be stored as a plaintext date. If an encrypted value is passed in, decrypt it.
		// Use decryptData (not decryptEin) - decryptEin is for SSN only and produces garbage with null bytes on plaintext dates
		if (owner.date_of_birth) {
			owner.date_of_birth = safeDecrypt(String(owner.date_of_birth), decryptData) as any;
			owner.date_of_birth = sanitizeDate(owner.date_of_birth);
		}
		if (!owner.date_of_birth) {
			owner.date_of_birth = undefined;
		}

		if (owner.ssn) {
			owner.ssn = safeEncrypt(owner.ssn, encryptEin, decryptEin);
		} else {
			owner.ssn = undefined;
		}
		if (owner.mobile) {
			if (!owner.mobile.startsWith("+")) {
				owner.mobile = `+1${owner.mobile}`;
			}
			owner.mobile = `+${formatNumberWithoutPlus(owner.mobile)}`;
		}

		for (const field of [
			"date_of_birth",
			"mobile",
			"email",
			"ssn",
			"address_line_1",
			"address_line_2",
			"address_apartment",
			"address_postal_code",
			"address_city",
			"address_state",
			"address_country"
		]) {
			if (!Object.hasOwn(owner, field)) {
				owner[field] = null;
			}
			if (Object.hasOwn(owner, field)) {
				owner[field] = owner[field] || null;
			}
		}
	}

	/**
	 * Given a list of subfields, return the ownership limits for the customer.
	 *
	 * @param fields - The list of subfields.
	 * @returns An object with the customer's identified ownership limits.
	 */
	private static async getExtendedOwnershipLimits(fields: { name: string; status: number }[]) {
		let maxTotalOwners: number | null = null;
		let maxControlOwners: number | null = null;
		let maxBeneficialOwners: number | null = null;

		for (const field of fields) {
			if (field.name === OWNERSHIP_SUB_FIELD_NAMES.MAX_TOTAL_OWNERS) {
				maxTotalOwners = field.status ? Number(field.status) : null;
			} else if (field.name === OWNERSHIP_SUB_FIELD_NAMES.MAX_CONTROL_PERSONS) {
				maxControlOwners = field.status ? Number(field.status) : null;
			} else if (field.name === OWNERSHIP_SUB_FIELD_NAMES.MAX_BENEFICIAL_OWNERS) {
				maxBeneficialOwners = field.status ? Number(field.status) : null;
			}
		}

		return {
			maxTotalOwners: maxTotalOwners,
			maxControlOwners: maxControlOwners,
			maxBeneficialOwners: maxBeneficialOwners
		};
	}

	/**
	 * Validates whether the creation or modification of a list of owners on an application
	 * would exceed the ownership limits specified in a customer's onboarding settings.
	 * If so, throws an error.
	 *
	 * @param modifiedOwner - The owner(s) that are being created or updated.
	 * @param otherOwners - Existing owner(s) that are not being updated.
	 * @param ownerLimits - The customer's specified ownership limits.
	 */
	private static validateExtendedOwnership(
		modifiedOwners: Business.Owner | Business.Owner[] | Partial<Business.Owner> | Partial<Business.Owner>[],
		otherOwners: Business.Owner[],
		ownerLimits: { maxTotalOwners: number | null; maxControlOwners: number | null; maxBeneficialOwners: number | null }
	) {
		const { maxTotalOwners, maxControlOwners, maxBeneficialOwners } = ownerLimits;
		modifiedOwners = Array.isArray(modifiedOwners) ? modifiedOwners : [modifiedOwners];

		const uniqueExistingOwners = new Map<string, Business.Owner>();

		for (const owner of otherOwners) {
			if (owner.id) {
				uniqueExistingOwners.set(owner.id, owner);
			}
		}

		//Overwrite any existing owners with the updated version
		for (const owner of modifiedOwners) {
			if (owner.id) {
				uniqueExistingOwners.set(owner.id, owner as Business.Owner);
			}
		}

		const newOwners: Partial<Business.Owner>[] = modifiedOwners.filter(owner => !owner.id);
		const processedOwners = [...uniqueExistingOwners.values(), ...newOwners];

		let totalOwnerCount = 0;
		let controlOwnerCount = 0;
		let beneficialOwnerCount = 0;

		for (const owner of processedOwners) {
			if (owner.owner_type === OWNER_TYPES.CONTROL) {
				controlOwnerCount++;
			} else if (owner.owner_type === OWNER_TYPES.BENEFICIARY) {
				beneficialOwnerCount++;
			}
			totalOwnerCount++;
		}

		if (
			maxTotalOwners != null &&
			totalOwnerCount > maxTotalOwners
		) {
			throw new BusinessApiError(
				"You've reached the maximum allowed number of owners.",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		if (
			maxControlOwners != null &&
			controlOwnerCount > maxControlOwners
		) {
			throw new BusinessApiError(
				"You've reached the maximum allowed number of control persons.",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		} 
    if (
			maxBeneficialOwners != null &&
			beneficialOwnerCount > maxBeneficialOwners
		) {
			throw new BusinessApiError(
				"You've reached the maximum allowed number of beneficial owners.",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}

	/**
	 * Identifies the minimum ownership percentage that a beneficial owner can have based on customer configurations.
	 * 
	 * @param isExtendedOwnershipEnabled - Whether extended ownership is enabled for the customer.
	 * @returns The minimum ownership percentage for a beneficial owner.
	 */
	public static identifyMinimumOwnershipPercentage(
		isExtendedOwnershipEnabled: boolean = false
	) {
		if (isExtendedOwnershipEnabled) return 0;		
		return 25;
	}
}
