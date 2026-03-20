import { IntegrationPlatformId } from "#constants";
import type * as StripeTypes from "#lib/paymentProcessor/types/stripe";
import { UUID } from "crypto";
import { MerchantProfileConverter } from "./merchantProfileConverter";
import * as MerchantProfileTypes from "./types/merchantProfile";

export class MerchantProfile {
	public profileId?: UUID;
	public businessId: UUID;
	public customerId: UUID;
	public profile: MerchantProfileTypes.Profile;
	public platformId: IntegrationPlatformId | null;
	public accounts: MerchantProfileTypes.MerchantProfileAccounts = []; // Can be extended with other processor account info in the future
	public createdAt?: Date;
	public updatedAt?: Date;
	private merchantProfileConverter: MerchantProfileConverter;

	constructor(
		customerId: UUID,
		businessId: UUID,
		platformId: IntegrationPlatformId,
		profile: MerchantProfileTypes.Profile,
		profileId?: UUID,
		createdAt?: Date,
		updatedAt?: Date,
		accounts: MerchantProfileTypes.MerchantProfileAccounts = []
	) {
		this.customerId = customerId;
		this.businessId = businessId;
		this.profileId = profileId;
		this.profile = profile;
		this.platformId = platformId;
		this.createdAt = createdAt;
		this.updatedAt = updatedAt;
		this.accounts = accounts;
		this.merchantProfileConverter = new MerchantProfileConverter(this.customerId);
	}

	public static isValidProfile(profile: MerchantProfile | null): profile is MerchantProfile {
		return profile !== null;
	}

	public toApiResponse(): MerchantProfileTypes.MerchantProfileApiResponse {
		return MerchantProfileConverter.toApiResponse(this);
	}

	public toDbRecord() {
		return {
			id: this.profileId,
			customer_id: this.customerId,
			business_id: this.businessId,
			platform_id: this.platformId,
			profile: MerchantProfileConverter.toProtectedProfile(this.profile),
			created_at: this.createdAt,
			updated_at: this.updatedAt
		};
	}

	public static fromDb(dbRecord: Record<string, any> | undefined): MerchantProfile | null {
		if (!dbRecord) return null;

		// Need to convert TOS acceptance back to Date format for the API layer since Stripe returns it as a timestamp and we store it as a String because its
		// we store the entire profile as a JSON Blob thus accepted_at gets converted to a string after saving it.
		if (dbRecord.profile.tos_acceptance && typeof dbRecord.profile.tos_acceptance.accepted_at === "string") {
			dbRecord.profile.tos_acceptance.accepted_at = new Date(dbRecord.profile.tos_acceptance.accepted_at);
		}

		return new MerchantProfile(
			dbRecord.customer_id,
			dbRecord.business_id,
			dbRecord.platform_id,
			MerchantProfileConverter.fromProtectedProfile(dbRecord.profile),
			dbRecord.id,
			dbRecord.created_at,
			dbRecord.updated_at
		);
	}

	public static fromDbWithRelationships(dbRecord: Record<string, any>[] | undefined): MerchantProfile | null {
		// Allow us to handle joins that return multiple rows per profile
		// This lets us be flexibile in what related data we pull from the DB when using the get method
		// on the repository.
		if (!dbRecord || dbRecord.length === 0) return null;

		// Since this for a single profile, we can just use the first record for base info, in cases where you'd grab multiple merchant profiles
		// We'd need to group by profile ID first. We don't have a use case for that as it stands today, but can see it being useful in the future.
		// TODO: Refactor this method if we need to support that use case.
		const baseRecord = dbRecord[0];

		const profile = MerchantProfile.fromDb(baseRecord);

		// If we don't have a base profile, return null
		if (!profile) return null;

		// Currently only handling accounts relationship, but can be extended in the future since that is the only
		// relationship we have right now.
		if (baseRecord?.account) {
			const accounts = dbRecord.map(record => ({
				account_id: record.account_id,
				processor_account_id: record.processor_account_id,
				status: record.status,
				account: record.account
			}));
			profile.accounts = accounts;
		}

		return profile;
	}

	public setTermsOfService(tos: MerchantProfileTypes.TermsOfServiceInput) {
		this.profile.tos_acceptance = this.merchantProfileConverter.toTermsOfService(tos);
	}

	public toStripeCreateAccountFormat(stripeTestMode: boolean = false): StripeTypes.CreateAccountContext {
		return this.merchantProfileConverter.toStripeCreateAccountFormat(this, stripeTestMode);
	}

	public toStripePersonsContext(): StripeTypes.CreatePersonContext[] {
		return this.merchantProfileConverter.toStripePersonsContext(this.profile.people.owners);
	}

	public toStripeExternalAccountFormat({
		bankInfo = null,
		testMode = false
	}: {
		bankInfo?: MerchantProfileTypes.BankingInfo | null;
		testMode?: boolean;
	}): StripeTypes.CreateExternalAccountContext | null {
		// If we want to associate another set of banking info other than the default one on the profile
		// we can pass it in here.
		return this.merchantProfileConverter.toStripeExternalAccountFormat(bankInfo || this.profile.banking_info, testMode);
	}

	public static async createOne(
		args: MerchantProfileTypes.CreateMerchantProfileParams,
		stripeContext: MerchantProfileTypes.MerchantProfileStripeContext | undefined = undefined
	): Promise<MerchantProfile> {
		const mpc = new MerchantProfileConverter(args.customerId);
		return await mpc.createMerchantProfile(args.params, stripeContext);
	}

	public static async createMany(
		args: MerchantProfileTypes.CreateMerchantProfileParams[],
		stripeContext: MerchantProfileTypes.MerchantProfileStripeContext | undefined
	): Promise<MerchantProfile[]> {
		if (args.length === 0) {
			return [];
		}

		const mpc = new MerchantProfileConverter(args[0].customerId);

		return await Promise.all(
			args.map(async arg => {
				return await mpc.createMerchantProfile(arg.params, stripeContext);
			})
		);
	}

	public async isReadyToOnboard(): Promise<MerchantProfileTypes.ReadyToOnboardStatus> {
		return this.merchantProfileConverter.isReadyToOnboard(this);
	}

	static async gatherMerchantProfileOnboardContext(
		merchantProfiles: MerchantProfile[],
		force: boolean = false
	): Promise<MerchantProfileTypes.MerchantProfileOnboardContext> {
		return await MerchantProfileConverter.generateMerchantProfileOnboardContext(merchantProfiles, force);
	}
}
