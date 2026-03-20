import { CustomerIdParams, CustomerSettingsBody } from "./schema";
import { WhiteLabelError } from "./error";
import { DIRECTORIES, ERROR_CODES, kafkaEvents, kafkaTopics } from "#constants";
import { getCustomerData, logger, producer } from "#helpers";
import { StatusCodes } from "http-status-codes";
import { sqlQuery } from "#helpers/index";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { UUID } from "crypto";
import { getFiles, putFile, addEmailIdentity, checkIdentityVerification } from "#utils/s3";
dayjs.extend(utc);

interface CustomerSettingsRecord {
	customer_id: UUID;
	settings: Partial<CustomerSettingsBody>;
	domain: string;
	created_at: Date;
	updated_at?: Date | null;
}
class WhiteLabelService {
	public async createCustomerSettings({ customerId }: CustomerIdParams, settings: CustomerSettingsBody, authorization?: string): Promise<CustomerSettingsRecord> {
		const customer = await getCustomerData(customerId, authorization);

		if (!customer) {
			throw new WhiteLabelError(`Customer not found`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		const customerSettings = await this.getCustomerSettingsById(customerId);

		if (customerSettings) {
			throw new WhiteLabelError(`Settings for this customer already exist.`, StatusCodes.BAD_REQUEST, ERROR_CODES.DUPLICATE);
		}

		const customerSettingsByDomain = await this.getCustomerSettingsByDomain(settings.domain);

		if (customerSettingsByDomain && customerSettingsByDomain.customer_id !== customerId) {
			throw new WhiteLabelError(`The specified domain already exists.`, StatusCodes.BAD_REQUEST, ERROR_CODES.DUPLICATE);
		}

		try {
			const createrCustomerSettingsItem = `INSERT INTO onboarding_schema.data_customer_settings (customer_id, settings, domain, created_at) VALUES ($1, $2, $3, $4) RETURNING *`;
			logger.info(`creating a new customer settings ${settings}, customerId: ${customerId}`);
			const result = await sqlQuery({ sql: createrCustomerSettingsItem, values: [customerId, settings, settings.domain, new Date()] });
			logger.info(`created customer settings: ${JSON.stringify(result, null, 1)}, customerId: ${customerId}`);
			const newCustomerSettings = result.rows[0];

			await this.notifyAdminNewDomainWasRegistered(newCustomerSettings, customerId, customer);

			return newCustomerSettings;
		} catch (error: any) {
			throw new WhiteLabelError(`createrCustomerSettingsItem: ${error?.message ?? "Failure to create a customer settings"}`, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	public async notifyAdminNewDomainWasRegistered(newCustomerSettings: any, customerId: string, customer: any) {
		const message = {
			domain: newCustomerSettings.domain,
			customer_id: customerId,
			customer_email: customer.email,
			customer_name: customer.first_name
		};

		const payload = {
			topic: kafkaTopics.NOTIFICATIONS,
			messages: [{ 
				key: customerId, 
				value: { 
					event: kafkaEvents.WHITE_LABEL_REGISTERED_NEW_DOMAIN,
					...message 
				}
			}]
		};

		await producer.send(payload);
	}

	public async updatePartialCustomerSettings({ customerId }: CustomerIdParams, settings: CustomerSettingsBody, authorization?: string): Promise<CustomerSettingsRecord> {
		const customer = await getCustomerData(customerId, authorization);

		if (!customer) {
			throw new WhiteLabelError(`Customer not found`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		const customerSettingsById = await this.getCustomerSettingsById(customerId);

		if (!customerSettingsById) {
			throw new WhiteLabelError(`Settings for this customer not found. domain: ${settings.domain}, customerId: ${customerId}`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		try {
			const currentDate = dayjs().utc();
			const result = await this.updatePartialCustomerSettingsAction(settings, customerSettingsById.settings, customerId, currentDate);
			const [newCustomerSettings] = result.rows;
			logger.info(`updated customer settings, new: ${newCustomerSettings.settings}, customerId: ${customerId}`);

			if (settings?.domain && settings.domain !== customerSettingsById.domain) {
				logger.info(`Send e-mail to update domain oldDomain: ${customerSettingsById.domain}, newDomain:${settings.domain}`);
				this.notifyAdminNewDomainWasRegistered(newCustomerSettings, customerId, customer);
			}

			return newCustomerSettings;
		} catch (error: any) {
			if (error instanceof WhiteLabelError) {
				throw error;
			}
			throw new WhiteLabelError(`updatePartialCustomerSettings: ${error?.message ?? "Failure to update a customer settings"}`, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	public async updatePartialCustomerSettingsAction(settings: CustomerSettingsBody, oldSettings: Partial<CustomerSettingsBody>, customerId: string, currentDate: dayjs.Dayjs) {
		let result;
		if (settings.domain) {
			const customerSettingsByDomain = await this.getCustomerSettingsByDomain(settings.domain);

			if (customerSettingsByDomain && customerSettingsByDomain.customer_id !== customerId) {
				throw new WhiteLabelError(`The specified domain already exists.`, StatusCodes.BAD_REQUEST, ERROR_CODES.DUPLICATE);
			}

			const updateCustomerSettingsQuery = `UPDATE onboarding_schema.data_customer_settings SET domain = $1, settings = $2::jsonb, updated_at = $3 where customer_id = $4 RETURNING *`;
			logger.info(`updating customer settings, old:  ${oldSettings}, customerId: ${customerId}`);
			result = await sqlQuery({ sql: updateCustomerSettingsQuery, values: [settings.domain, { ...oldSettings, ...settings }, currentDate, customerId] });
		} else {
			const updateCustomerSettingsQuery = `UPDATE onboarding_schema.data_customer_settings SET settings = $1::jsonb, updated_at = $2 where customer_id = $3 RETURNING *`;
			result = await sqlQuery({ sql: updateCustomerSettingsQuery, values: [{ ...oldSettings, ...settings }, currentDate, customerId] });
		}
		return result;
	}

	public async getCustomerSettingsDomain(domain: string): Promise<CustomerSettingsRecord> {
		const customerSettings = await this.getCustomerSettingsByDomain(domain);

		if (!customerSettings) {
			throw new WhiteLabelError(`Customer Settings not found`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		return customerSettings;
	}
	async getCustomerSettingsById(customerId: string): Promise<CustomerSettingsRecord> {
		const getCustomerSettingByIdQuery = `SELECT * from onboarding_schema.data_customer_settings where customer_id = $1 LIMIT 1`;
		const result = await sqlQuery({ sql: getCustomerSettingByIdQuery, values: [customerId] });
		const response = result.rows[0];
		return response;
	}

	async addImagesInResponse(response: CustomerSettingsRecord) {
		if (!response || !response.customer_id) {
			return response;
		}
		const files = await getFiles(this.getCustomerSettingsImagesPath(response.customer_id));
		response.settings = { ...response.settings, ...files };
		return response;
	}

	async getCustomerSettingsByDomain(domain: string): Promise<CustomerSettingsRecord> {
		const getCustomerSettingByIdQuery = `SELECT * from onboarding_schema.data_customer_settings where domain = $1 LIMIT 1`;
		const result = await sqlQuery({ sql: getCustomerSettingByIdQuery, values: [domain] });
		return result.rows[0];
	}

	async uploadFileCustomerSettings(
		file: Express.Multer.File,
		customerId: string,
		domain: string,
		type: "primaryCompanyLogo" | "secondaryCompanyLogo" | "welcomeBackgroundImage" | "termsAndConditions",
		authorization?: string
	) {
		if (!file.mimetype.startsWith("image/")) {
			throw new WhiteLabelError("File should be an image", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		let customerSettings = await this.getCustomerSettingsById(customerId);

		if (!customerSettings) {
			customerSettings = await this.createCustomerSettings({ customerId }, { domain }, authorization);
		}

		const fileExtension = file.originalname.split(".").pop();
		const path = this.getCustomerSettingsImagesPath(customerId);
		const fileName = `${type}.${fileExtension}`;
		const fullPath = `${path}/${fileName}`;
		await putFile({ buffer: file.buffer, fileName }, path);
		return { path };
	}

	private getCustomerSettingsImagesPath(customerId: string) {
		return DIRECTORIES.WHITE_LABEL_CUSTOMER_SETTINGS.replace(":customerId", customerId);
	}

	async addIdentityInSES(email: string) {
		try {
			const domain = email.split("@")[1];
			const getCustomerSettings = `SELECT * FROM onboarding_schema.data_customer_settings WHERE domain = $1`;
			const getCustomerSettingsResult = await sqlQuery({ sql: getCustomerSettings, values: [domain] });

			if (!getCustomerSettingsResult.rows.length) {
				throw new Error("No such domain found in customer settings");
			}

			//add email in data_customer_settings
			const updateEmailQuery = `UPDATE onboarding_schema.data_customer_settings dcs
						SET email = $1
						WHERE dcs.domain = $2`;

			await sqlQuery({ sql: updateEmailQuery, values: [email, domain] });

			const check = await checkIdentityVerification(email);
			if (check) {
				return {
					message: "Email already added in SES."
				};
			}
			await addEmailIdentity(email);
			return {
				message: "SES identity added successfully."
			};
		} catch (error) {
			throw error;
		}
	}
}

export const whiteLabelService = new WhiteLabelService();
