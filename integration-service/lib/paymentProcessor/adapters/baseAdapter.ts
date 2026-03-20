import { ERROR_CODES, type IntegrationPlatformId } from "#constants";
import type { UUID } from "crypto";
import { PaymentProcessorError } from "../paymentProcessorError";
import { StatusCodes } from "http-status-codes";
import type { MerchantProfile } from "../merchantProfile";
import type { PaymentProcessor } from "../repositories/paymentProcessorRepository";
import type { PaymentProcessorStatus } from "../types/processor";
import type { PaymentProcessorAccountStatus } from "../paymentProcessorAccount.constants";

export interface IBaseAPIAdapterConfig {
	processorId: UUID;
	platformId: IntegrationPlatformId;
}

export type AccountStatusSyncResult<Summary = unknown, Account = Record<string, any>> = {
	summary: Summary;
	account: Account;
	mappedStatus: PaymentProcessorAccountStatus;
};

export abstract class BaseAPIAdapter {
	public readonly client;
	protected processorId: UUID;
	protected platformId: IntegrationPlatformId;
	public readonly usedCustomerCredentials: boolean;

	protected readonly customerId: UUID;

	constructor(customerId: UUID, config: IBaseAPIAdapterConfig) {
		this.customerId = customerId;
		this.processorId = config.processorId;
		this.platformId = config.platformId;
		this.usedCustomerCredentials = false;
	}

	// Must be implemented by the child class
	public async createAccount(merchantProfiles: MerchantProfile[]): Promise<[any[], string[]]> {
		throw new PaymentProcessorError("Not implemented", StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
	}

	// Must be implemented by the child class
	public async attachPersonsToAccount(merchantProfile: MerchantProfile, accountId: string): Promise<any> {
		throw new PaymentProcessorError("Not implemented", StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
	}

	// Must be implemented by the child class
	public async deleteProcessor(processor: PaymentProcessor): Promise<void> {
		throw new PaymentProcessorError("Not implemented", StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
	}

	// Optional override for processors that can fetch account status
	public async retrieveAccount(accountId: string): Promise<Record<string, any>> {
		throw new PaymentProcessorError("Not implemented", StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
	}

	public getProcessorStatus<RecordType extends Record<string, any> = Record<string, any>>(
		record: RecordType
	): PaymentProcessorStatus {
		throw new PaymentProcessorError("Not implemented", StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
	}

	public async syncAccountStatus(_accountId: string, _context?: Record<string, any>): Promise<AccountStatusSyncResult> {
		throw new PaymentProcessorError("Not implemented", StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
	}

	public deriveAccountStatus(_account: Record<string, any>): PaymentProcessorAccountStatus | null {
		return null;
	}

	public async getProcessorSession(_processorAccount: Record<string, any>): Promise<unknown> {
		throw new PaymentProcessorError("Not implemented", StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
	}
	/**
	When implemented, checks provided credentials against the Client to see if they're valid and returns a tuple of [success, account]
	*/
	public async checkCredentials(credentials: Record<string, any>): Promise<[boolean, unknown?]> {
		return (this.constructor as typeof BaseAPIAdapter).checkCredentials(credentials);
	}
	public static async checkCredentials(_credentials: Record<string, any>): Promise<[boolean, unknown?]> {
		return [true, undefined];
	}

	// Must be implemented by the child class
	public static async createProcessor<T = any, R = any>(
		processor: PaymentProcessor,
		platformSpecificArguments: T
	): Promise<R> {
		throw new PaymentProcessorError("Not implemented", StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
	}

	// Must be implemented by the child class
	public static async initializeProcessor<TConfig extends IBaseAPIAdapterConfig = IBaseAPIAdapterConfig, R = any>(
		processor: PaymentProcessor,
		config: TConfig
	): Promise<R> {
		throw new PaymentProcessorError("Not implemented", StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
	}

	public static buildConfiguration(processorId: UUID, implementationOptions: unknown): IBaseAPIAdapterConfig {
		throw new PaymentProcessorError("Not implemented", StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
	}
}
