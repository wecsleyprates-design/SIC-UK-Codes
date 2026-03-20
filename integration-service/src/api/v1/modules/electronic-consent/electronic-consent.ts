import { CONNECTION_STATUS, ERROR_CODES, FEATURE_FLAGS, INTEGRATION_ID } from "#constants";
import { createSessionToken, getBusinessDetailsForTaxConsent, getFlagValueByToken, getOrCreateConnection, logger, updateConnectionByConnectionId } from "#helpers";
import { IDBConnection } from "#types";
import { UUID } from "crypto";
import { CreateSessionBody, SignBody } from "./types";
import { convertState } from "#lib/plaid/convert";
import { StatusCodes } from "http-status-codes";
import { ElectronicConsentApiError } from "./error";
import { generateRandomInvalidTIN } from "#utils";

class ElectronicConsent {
	async createSession(params: { businessID: UUID }, body: CreateSessionBody, headers: { authorization: string }) {
		try {
			const connection: IDBConnection = await getOrCreateConnection(params.businessID, INTEGRATION_ID.ELECTRONIC_SIGNATURE);

			// Check if easy onboarding flow is enabled
			const isEasyFlow = (headers.authorization && (await getFlagValueByToken(FEATURE_FLAGS.WIN_1152_EASY_ONBOARDING_FLOW, { authorization: headers.authorization }))) ?? false;

			if (!isEasyFlow && connection.connection_status === CONNECTION_STATUS.SUCCESS) {
				throw new ElectronicConsentApiError("Consent has already been given", StatusCodes.BAD_REQUEST, ERROR_CODES.NOT_ALLOWED);
			}

			// for easyflow the TIN may not be present, hence we need to generate a random invalid TIN
			if (isEasyFlow) {
				const tin = generateRandomInvalidTIN();
				body.documentFields.taxId = tin.slice(0, 2) + "-" + tin.slice(2); // converting into format 00-0000000
			}

			if (connection.connection_status === CONNECTION_STATUS.INITIALIZED) {
				const expiryTime = new Date(connection.configuration.expiresAt);
				const currentTime = new Date(Date.now());
				if (currentTime <= expiryTime) {
					logger.debug(`Returning existing connection configuration for businessID: ${params.businessID}`);
					return connection.configuration;
				}
			}

			// sanity of body
			try {
				body.documentFields.state = body?.documentFields?.state ? convertState(body?.documentFields?.state) : "";
			} catch (ex) {}

			if (!body?.documentFields?.taxId) {
				let { data } = await getBusinessDetailsForTaxConsent(params.businessID);

				if (!Object.keys(data).length || !data?.tin) {
					logger.error(`No business details found for businessID: ${params.businessID}`);
					throw new ElectronicConsentApiError("Business TaxId not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
				}

				body.documentFields.taxId = data.tin.slice(0, 2) + "-" + data.tin.slice(2); // converting into format 00-0000000
			}

			// create session token by making request to electronicConsent svc
			const sessionData = await createSessionToken(params.businessID, body);

			// if easyflow is enabled, then set devMode to true
			sessionData.devMode = isEasyFlow;

			// update connection status to INITIALIZED
			await updateConnectionByConnectionId(connection.id, CONNECTION_STATUS.INITIALIZED, sessionData);

			return sessionData;
		} catch (error) {
			throw error;
		}
	}
}

export const electronicConsent = new ElectronicConsent();
