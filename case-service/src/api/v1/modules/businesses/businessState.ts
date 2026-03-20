import { CASE_TYPE, TIN_BEHAVIOR } from "#constants/index";
import { type Business, type Case } from "#types/index";
import { StateMachine, type InjectableArgs, type StateTable } from "../../../../utils/stateMachine";
import { randomUUID, type UUID } from "crypto";
import type { CustomerDetailsByBusinessID } from "./types";
import { AddressUtil } from "#utils";
import { Owners } from "./owners";
import type z from "zod";
import { db, getBusinessFacts } from "#helpers";
import type { Knex } from "knex";
// Heavy modules are imported lazily in methods to avoid test-time side effects

export type BusinessStateTable = StateTable<{
	data_businesses: Business.Record;
	data_cases: Case.Record[];
	onboarding_case?: Case.Record;
	rel_business_customer_monitoring: CustomerDetailsByBusinessID | null;
	data_business_addresses: Business.BusinessAddress[];
	data_business_names: { name: string; is_primary?: boolean }[];
	data_business_custom_fields: Record<string, any>;
	data_business_owners: Business.Owner[];
	integration_data?: Record<string, any>;
	facts?: Record<string, unknown>;
}>;

export type BusinessStateDbRecord = {
	id: UUID;
	created_at: string;
	business_id: UUID;
	customer_id: UUID;
	state: BusinessStateTable;
	state_diff: Record<string, any>;
	business_score_trigger_id?: UUID | null;
};

type FactShape<T = any> = {
	value: T | undefined;
	schema?: z.ZodAny;
};

type ForBusinessArgs = {
	caseType: CASE_TYPE | undefined;
};
export class BusinessState extends StateMachine<BusinessStateTable> {
	private readonly repository: BusinessStateRepository;

	constructor(args: InjectableArgs<BusinessStateTable> & { db?: Knex }) {
		super(args as InjectableArgs<BusinessStateTable>);
		this.repository = new BusinessStateRepository(args.db ?? db);
	}

	protected static readonly sensitiveFields: string[] = [
		"data_businesses.tin",
		"data_business_owners[].ssn",
		"data_business_owners[].date_of_birth",
		"rel_business_customer_monitoring.metadata.tin",
		"rel_business_customer_monitoring.metadata.owner1_ssn",
		"rel_business_customer_monitoring.metadata.owner1_dob",
		"rel_business_customer_monitoring.metadata.owner2_ssn",
		"rel_business_customer_monitoring.metadata.owner2_dob",
		"rel_business_customer_monitoring.metadata.owner3_ssn",
		"rel_business_customer_monitoring.metadata.owner3_dob",
		"rel_business_customer_monitoring.metadata.owner4_ssn",
		"rel_business_customer_monitoring.metadata.owner4_dob",
		"rel_business_customer_monitoring.metadata.owner5_ssn",
		"rel_business_customer_monitoring.metadata.owner5_dob",
		"rel_business_customer_monitoring.metadata.bank_account_number",

		"integration_data.tin",
		"integration_data.owner1_ssn",
		"integration_data.owner1_dob",
		"integration_data.owner2_ssn",
		"integration_data.owner2_dob",
		"integration_data.owner3_ssn",
		"integration_data.owner3_dob",
		"integration_data.owner4_ssn",
		"integration_data.owner4_dob",
		"integration_data.owner5_ssn",
		"integration_data.owner5_dob",
		"integration_data.bank_account_number"
	];

	public static async forBusiness(
		businessId: UUID,
		customerId?: UUID,
		args?: ForBusinessArgs & Partial<BusinessStateTable>
	) {
		const { businesses } = await import("./businesses");
		const { caseManagementService } = await import("../case-management/case-management");
		const DEFAULT_CASE_TYPE = CASE_TYPE.ONBOARDING;
		const business = await businesses.getBusinessByID({ businessID: businessId, tinBehavior: TIN_BEHAVIOR.PLAIN });
		const cases = await caseManagementService.getCasesByBusinessId(business.id, {
			customerId
		});
		const primaryCase = cases.find(c => c.case_type === (args?.caseType ?? DEFAULT_CASE_TYPE));
		const childRecords = await this.getBusinessChildRecords(
			business.id as UUID,
			customerId as UUID,
			primaryCase?.id as UUID | null
		);

		const state: BusinessStateTable = {
			data_businesses: business,
			data_cases: cases,
			onboarding_case: primaryCase,
			data_business_addresses: args?.data_business_addresses ?? childRecords.data_business_addresses,
			data_business_names: args?.data_business_names ?? childRecords.data_business_names,
			data_business_owners: args?.data_business_owners ?? childRecords.data_business_owners,
			data_business_custom_fields: args?.data_business_custom_fields ?? childRecords.data_business_custom_fields,
			rel_business_customer_monitoring:
				args?.rel_business_customer_monitoring ?? childRecords.rel_business_customer_monitoring,
			integration_data: args?.integration_data ?? childRecords.integration_data,
			facts: args?.facts ?? childRecords.facts
		};

		return new BusinessState({
			state,
			id: businessId,
			customerId: customerId ?? null,
			updatedAt: business.updated_at,
			comparators: {
				"data_business_addresses.__self": this.addressComparator,
				"data_business_names.__self": this.nameComparator,
				"data_business_owners.__self": this.ownerDiffComparator,
				"facts.__self": this.factComparator
			}
		});
	}

	public static fromRecord(record: BusinessStateDbRecord): BusinessState {
		return new BusinessState({
			state: record.state,
			id: record.business_id,
			customerId: record.customer_id,
			updatedAt: record.created_at,
			comparators: {
				"data_business_addresses.__self": this.addressComparator,
				"data_business_names.__self": this.nameComparator,
				"data_business_owners.__self": this.ownerDiffComparator,
				"facts.__self": this.factComparator
			}
		});
	}

	public async saveState(): Promise<BusinessStateDbRecord> {
		return this.repository.saveNewState(this);
	}

	private static factComparator(a: unknown, b: unknown): boolean {
		if (
			BusinessState.isFactShape(a) &&
			BusinessState.isFactShape(b) &&
			a.schema?.safeParse(a.value).success &&
			b.schema?.safeParse(b.value).success
		) {
			return a.value === b.value;
		}
		return JSON.stringify(a) === JSON.stringify(b);
	}

	private static isFactShape(value: unknown): value is FactShape {
		return typeof value === "object" && value != null && "value" in value;
	}

	private static addressComparator(a: unknown, b: unknown): boolean {
		const fingerprintArray = (arr: unknown) =>
			(Array.isArray(arr) ? arr : [])
				.filter(Boolean)
				.map(addr => AddressUtil.toFingerprint(addr as any))
				.sort();
		const aa = fingerprintArray(a);
		const bb = fingerprintArray(b);
		if (aa.length !== bb.length) return false;
		for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
		return true;
	}

	private static nameComparator(a: unknown, b: unknown): boolean {
		const normalize = (vals: unknown) =>
			(Array.isArray(vals) ? vals : [])
				.filter(Boolean)
				.map(v => ({
					name: String((v as any)?.name ?? "")
						.trim()
						.toLowerCase(),
					is_primary: Boolean((v as any)?.is_primary)
				}))
				.sort((x, y) => x.name.localeCompare(y.name) || Number(x.is_primary) - Number(y.is_primary));
		const aa = normalize(a);
		const bb = normalize(b);
		if (aa.length !== bb.length) return false;
		for (let i = 0; i < aa.length; i++) {
			if (aa[i].name !== bb[i].name || aa[i].is_primary !== bb[i].is_primary) return false;
		}
		return true;
	}

	private static ownerDiffComparator(firstOwner: unknown, secondOwner: unknown): boolean {
		const normalizeOwners = (owners: unknown) =>
			(Array.isArray(owners) ? owners : [])
				.filter(Boolean)
				.map(o => {
					const owner = (o ?? {}) as Record<string, unknown>;
					return {
						id: owner.id ?? null,
						first_name: owner.first_name ?? null,
						last_name: owner.last_name ?? null,
						email: owner.email ?? null,
						mobile: owner.mobile ?? null,
						title: (owner as any)?.title?.title ?? owner.title ?? null,
						owner_type: owner.owner_type ?? null,
						ownership_percentage: owner.ownership_percentage ?? null,
						address_line_1: owner.address_line_1 ?? null,
						address_line_2: owner.address_line_2 ?? null,
						address_city: owner.address_city ?? null,
						address_state: owner.address_state ?? null,
						address_postal_code: owner.address_postal_code ?? null,
						address_country: owner.address_country ?? null,
						// Presence-sensitive but normalized fields
						ssn: owner.ssn ?? null,
						date_of_birth: owner.date_of_birth ?? null
					};
				})
				.sort((x, y) => {
					const left = String((x as any)?.id ?? "").toLowerCase();
					const right = String((y as any)?.id ?? "").toLowerCase();
					return left.localeCompare(right);
				});

		const firstOwnerNormalized = normalizeOwners(firstOwner);
		const secondOwnerNormalized = normalizeOwners(secondOwner);
		if (firstOwnerNormalized.length !== secondOwnerNormalized.length) return false;
		for (let i = 0; i < firstOwnerNormalized.length; i++) {
			if (JSON.stringify(firstOwnerNormalized[i]) !== JSON.stringify(secondOwnerNormalized[i])) return false;
		}
		return true;
	}

	private static async getBusinessChildRecords(
		businessId: UUID,
		customerId: UUID | null,
		caseId?: UUID | null
	): Promise<
		Pick<
			BusinessStateTable,
			| "data_business_names"
			| "data_business_addresses"
			| "data_business_owners"
			| "data_business_custom_fields"
			| "rel_business_customer_monitoring"
			| "integration_data"
			| "facts"
		>
	> {
		const { businesses } = await import("./businesses");
		const { caseManagementService } = await import("../case-management/case-management");

		const [
			businessNames,
			businessAddresses,
			businessOwners,
			relBusinessCustomerMonitoring,
			businessCustomFields,
			facts
		] = await Promise.allSettled([
			businesses.getBusinessAllNames({ businessID: businessId }),
			businesses.getBusinessAllAddresses({ businessID: businessId }),
			// Use unencrypted owners; StateMachine will handle protection/encryption when needed.
			Owners.getBusinessOwnersUnencrypted(businessId),
			customerId && businesses.getCustomersByBusinessId(businessId, customerId),
			caseId &&
				customerId &&
				caseManagementService.getCustomFields({
					businessID: businessId,
					caseID: caseId,
					customerID: customerId
				}),
			getBusinessFacts(businessId)
		]);

		const customerMetadata =
			relBusinessCustomerMonitoring.status === "fulfilled" && relBusinessCustomerMonitoring.value?.[0]
				? relBusinessCustomerMonitoring.value[0]
				: null;

		return {
			data_business_names: businessNames.status === "fulfilled" ? businessNames.value : [],
			data_business_addresses: businessAddresses.status === "fulfilled" ? businessAddresses.value : [],
			data_business_owners: businessOwners.status === "fulfilled" ? businessOwners.value : [],
			data_business_custom_fields:
				businessCustomFields?.status === "fulfilled" && businessCustomFields?.value
					? Object.assign({}, ...businessCustomFields.value.map(field => ({ [field.field_code]: field.value })))
					: {},
			rel_business_customer_monitoring: customerMetadata,
			integration_data: customerMetadata?.metadata ?? {},
			facts: facts.status === "fulfilled" ? BusinessState.mapWarehouseFactsToRecord(facts.value) : {}
		};
	}

	/**
	 * Take the Warehouse's fact array and map to a Record
	 * @param facts - The facts to map to a record.
	 * @returns
	 */
	private static mapWarehouseFactsToRecord(
		facts: {
			collected_at: string;
			business_id: UUID;
			name: string;
			value: unknown;
			received_at: string;
			created_at: string;
			updated_at: string;
		}[]
	): Record<string, unknown> {
		return facts.reduce((acc, rawFact) => {
			const fact = rawFact.value as { value: unknown; schema?: z.ZodAny };
			// coalesce the value to null because the warehouse may return undefined for a value
			acc[rawFact.name] = fact.value ?? null;
			return acc;
		}, {});
	}
}

export class BusinessStateRepository {
	private readonly db: Knex;

	constructor(db: Knex) {
		this.db = db;
	}

	async getMostRecentState(businessId: UUID): Promise<BusinessStateDbRecord | null> {
		const rows = await this.db<BusinessStateDbRecord>("monitoring.business_states")
			.select("*")
			.where("business_id", businessId)
			.orderBy("created_at", "desc")
			.limit(1);
		return rows.length > 0 ? rows[0] : null;
	}

	async saveNewState(
		newState: StateMachine<BusinessStateTable>,
		previousState?: StateMachine<BusinessStateTable>
	): Promise<BusinessStateDbRecord> {
		const protectedState = newState.getState("protected");
		const { id: businessId } = protectedState.data_businesses;
		const { customer_id: customerId } = protectedState.data_cases?.[0] ?? {};
		if (!customerId) {
			throw new BusinessStateError("Customer ID is required to save a new state");
		}
		if (!previousState) {
			const previousStateRecord = await this.getMostRecentState(businessId as UUID);
			if (previousStateRecord) {
				previousState = BusinessState.fromRecord(previousStateRecord);
			}
		}
		if (previousState) {
			const stateDiff = previousState.diff(newState);
			const state = {
				id: randomUUID(),
				business_id: businessId as UUID,
				customer_id: (customerId as UUID),
				state: newState.getState("protected") as BusinessStateTable,
				state_diff: stateDiff
			};
			const result = await this.db<BusinessStateDbRecord>("monitoring.business_states").insert(state).returning("*");
			return result?.[0];
		}

		const result = await this.db<BusinessStateDbRecord>("monitoring.business_states")
			.insert({
				id: randomUUID(),
				business_id: businessId as UUID,
				customer_id: customerId as UUID,
				state: protectedState as BusinessStateTable,
				state_diff: {}
			})
			.returning("*");
		return result?.[0];
	}
}

export class BusinessStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BusinessStateError";
	}
}