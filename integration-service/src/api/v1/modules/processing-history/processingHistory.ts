import { extractEdits, getApplicationEdit, logger, setApplicationEditData, sqlQuery } from "#helpers";
import { randomUUID, UUID } from "crypto";
import { ProcessingHistoryType } from "./schema";
import { UserInfo } from "#types";
import { WEBHOOK_EVENTS } from "#constants";
import { sendEventToGatherWebhookData } from "#common";
import { getCachedSignedUrl } from "#utils";
import _ from "lodash";

class ProcessingHistory {
	/**
	 * Get processing history data for a business
	 * Note: For data field values with overrides, prefer the /facts/business/:id/processing-history endpoint.
	 * This endpoint is maintained for:
	 * - File/statement information (file_name, file_path, signed URLs)
	 * - Legacy fallback with guest_owner_edits per section
	 * - Internal use by addProcessingHistory for edit tracking
	 * - Documents endpoint integration
	 */
	async getProcessingHistory(params: { businessId: UUID }, query: { case_id: UUID }) {
		let getProcessingHistoryQuery = `SELECT dph.*, uod.file_name, uod.file_path, ARRAY[]::jsonb[] AS guest_owner_edits FROM integration_data.data_processing_history dph INNER JOIN public.data_cases dc ON dc.id = dph.case_id LEFT JOIN integration_data.uploaded_ocr_documents uod ON uod.id = dph.ocr_document_id WHERE dc.business_id = $1 ORDER BY dph.created_at DESC LIMIT 1`;
		let getProcessingHistoryValues = [params.businessId];
		if (query.case_id) {
			getProcessingHistoryQuery = `SELECT dph.*, uod.file_name, uod.file_path, ARRAY[]::jsonb[] AS guest_owner_edits FROM integration_data.data_processing_history dph LEFT JOIN integration_data.uploaded_ocr_documents uod ON uod.id = dph.ocr_document_id WHERE dph.case_id = $1`;
			getProcessingHistoryValues = [query.case_id];
		}
		const getProcessingHistoryResponse = await sqlQuery({
			sql: getProcessingHistoryQuery,
			values: getProcessingHistoryValues
		});

		if (getProcessingHistoryResponse.rows && getProcessingHistoryResponse.rows.length) {
			// Get customer edits for guest_owner_edits mapping
			const applicationEdit = await getApplicationEdit(params.businessId, { stage_name: "processing_history" });
			const patterns: [string, string][] = [
				["americanExpressData", "american_express_data"],
				["cardData", "card_data"],
				["pointOfSaleData", "point_of_sale_data"],
				["generalData", "general_data"],
				["seasonalData", "seasonal_data"]
			];

			const editMap: Record<string, Set<string>> = {
				americanExpressData: new Set(),
				cardData: new Set(),
				pointOfSaleData: new Set(),
				generalData: new Set(),
				seasonalData: new Set()
			};

			for (const record of getProcessingHistoryResponse.rows) {
				// Insert the guest owner edits in the related Set
				applicationEdit?.data?.forEach(edit => {
					const fieldName = edit.field_name;
					if (fieldName) {
						for (const [pattern, mapKey] of patterns) {
							if (fieldName.includes(mapKey)) {
								const key = fieldName.split(".")?.[1];
								if (key) editMap[pattern].add(key);
								break; // stop once matched
							}
						}
						if (fieldName === "file_name") {
							record.guest_owner_edits.push(fieldName);
						}
					}
				});
				// Attach guest_owner_edits key in related section of response
				for (const [pattern, mapKey] of patterns) {
					record[mapKey].guest_owner_edits = Array.from(editMap[pattern]);
				}
				// Handle file information and signed URLs
				if (record.file_name && record.file_path) {
					const file = await getCachedSignedUrl(record.file_name, record.file_path);
					record.file = file;
				}
			}
		}
		return getProcessingHistoryResponse.rows;
	}

	async addProcessingHistory(params: { businessId: UUID }, body: ProcessingHistoryType, userInfo: UserInfo) {
		const processingHistoryId = randomUUID();
		if (userInfo.is_guest_owner) {
			const existingRecordList = await this.getProcessingHistory({ businessId: params.businessId }, { case_id: body.case_id as UUID });
			const existingRecord = existingRecordList?.[0];

			logger.info(`existingRecord processing history: ${JSON.stringify(existingRecordList)}`);
			// Collect all edits in one array
			const edits: any[] = [];
			const fieldKeyMap = {
				american_express_data: "american_express",
				card_data: "visa_mastercard_discover",
				point_of_sale_data: "point_of_sale_volume",
				general_data: "general_data",
				seasonal_data: "seasonal_data"
			};

			for (const [existingKey, requestKey] of Object.entries(fieldKeyMap)) {
				const original = existingRecord?.[existingKey];
				const updated = body?.[requestKey];
				if (!original && !updated) continue; // skip empty pairs
				// Remove guest_owner_edits from original to avoid including it in union
				const cleanedOriginal = _.omit(original, ["guest_owner_edits"]);
				edits.push(...extractEdits(existingKey, cleanedOriginal, updated, true)); // pass the existingKey as prefix
			}
			
			const oldValue = existingRecord && Object.keys(existingRecord).length > 0 && existingRecord?.file_name?.trim() ? existingRecord.file_name.trim() : null;
			const newVal = body?.file_name?.trim() || null;
			if (oldValue != newVal) {
				edits.push({
					field_name: "file_name",
					old_value: oldValue,
					new_value: newVal
				});
			}
			
			logger.info(`edits processing history: ${JSON.stringify(edits)}`);
			if (edits.length > 0) {
				await setApplicationEditData(params.businessId, {
					case_id: body.case_id,
					customer_id: userInfo?.issued_for?.customer_id,
					stage_name: "processing_history",
					user_name: `${userInfo?.issued_for?.first_name ?? ""} ${userInfo?.issued_for?.last_name ?? ""}`.trim(),
					created_by: userInfo?.issued_for?.user_id,
					data: edits
				});
			}
		}
		const addProcessingHistoryQuery = `INSERT INTO integration_data.data_processing_history (id, case_id, ocr_document_id, american_express_data, card_data, point_of_sale_data, general_data, seasonal_data, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (case_id) DO UPDATE SET ocr_document_id = EXCLUDED.ocr_document_id, american_express_data = EXCLUDED.american_express_data, card_data = EXCLUDED.card_data, point_of_sale_data = EXCLUDED.point_of_sale_data, general_data = EXCLUDED.general_data, seasonal_data = EXCLUDED.seasonal_data, updated_by = EXCLUDED.updated_by`;
		const addProcessingHistoryValues = [
			processingHistoryId,
			body.case_id,
			body.ocr_document_id,
			body.american_express,
			body.visa_mastercard_discover,
			body.point_of_sale_volume,
			body.general_data,
			body.seasonal_data,
			userInfo.user_id,
			userInfo.user_id
		];
		await sqlQuery({ sql: addProcessingHistoryQuery, values: addProcessingHistoryValues });

		if (params.businessId) {
			await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: params.businessId });
		}

		return {};
	}
}

export const processingHistory = new ProcessingHistory();
