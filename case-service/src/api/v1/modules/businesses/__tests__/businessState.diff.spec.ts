jest.mock("jsonwebtoken");
jest.mock("#helpers/index");
jest.mock("#common/index");
jest.mock("#lib/index");
jest.mock("#utils/index");
jest.mock("uuid");
jest.mock("#configs/index");
jest.mock("kafkajs");
jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
		//   ... other mocked configuration properties
	},
	tokenConfig: {
		TOKEN_LIFE: "3h",
		REFRESH_TOKEN_LIFE: "30d",
		REFRESH_TOKEN_LIFE_SECONDS: 2592000, // 30*24*60*60
		FORGOT_PASSWORD_TOKEN_LIFE_SECONDS: 10 * 60, // 10 minutes
		VERIFY_EMAIL_TOKEN_LIFE_SECONDS: 10 * 60 // 10 minutes
	}
}));

import { BusinessState, type BusinessStateDbRecord, BusinessStateTable } from "../businessState";

function buildState(overrides?: Partial<BusinessStateTable>): BusinessStateTable {
	const base: BusinessStateTable = {
		data_businesses: {
			id: "biz-1",
			name: "ACME",
			created_at: "2025-01-01T12:00:00.000Z"
		} as any,
		data_cases: [{ id: "case-1" } as any],
		onboarding_case: undefined,
		rel_business_customer_monitoring: null,
		data_business_addresses: [],
		data_business_names: [{ name: "ACME", is_primary: true }],
		data_business_custom_fields: { foo: "bar" },
		data_business_owners: [],
		integration_data: { flags: { a: 1 } },
		facts: {}
	};
	return { ...base, ...(overrides ?? {}) };
}

describe("BusinessState.diff", () => {
	test("getState encrypts data_businesses.tin using provided encryptor", () => {
		const encryptor = jest.fn((v: string) => `enc:${v}`);
		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_businesses: {
					id: "biz-1",
					name: "ACME",
					tin: "123456789" as any,
					created_at: "2025-01-01T12:00:00.000Z"
				} as any
			}),
			encryptor
		});

		const protectedState = a.getState();
		expect(encryptor).toHaveBeenCalledWith("123456789");
		expect((protectedState as any).data_businesses.tin).toBe("enc:123456789");
	});

	test("getState encrypts all owner ssn values via [] pattern", () => {
		const encryptor = jest.fn((v: string) => `enc:${v}`);
		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_business_owners: [{ id: "o1", ssn: "1111" } as any, { id: "o2", ssn: "2222" } as any]
			}),
			encryptor
		});

		const protectedState = a.getState() as any;
		expect(encryptor).toHaveBeenCalledWith("1111");
		expect(encryptor).toHaveBeenCalledWith("2222");
		expect(protectedState.data_business_owners[0].ssn).toBe("enc:1111");
		expect(protectedState.data_business_owners[1].ssn).toBe("enc:2222");
	});

	test("diff returns sensitive change for business tin even when decryptor returns empty string", () => {
		const encryptor = (v: string) => `enc:${v}`;
		// Simulate a decryptor that returns an empty string when given plaintext (e.g., misconfigured)
		const decryptor = jest.fn(() => "");

		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_businesses: {
					...(buildState().data_businesses as any),
					tin: "123456789" as any
				} as any
			}),
			encryptor,
			decryptor
		});
		const b = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_businesses: {
					...(buildState().data_businesses as any),
					tin: "987654321" as any
				} as any
			}),
			encryptor,
			decryptor
		});

		const d = a.diff(b);
		expect(d.data_businesses?.tin).toEqual(
			expect.objectContaining({
				path: "data_businesses.tin",
				isSensitive: true,
				previousValue: "enc:123456789",
				newValue: "enc:987654321"
			})
		);
	});

	test("marks changed object fields with default comparator metadata", () => {
		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState()
		});
		const b = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_businesses: {
					...(buildState().data_businesses as any),
					name: "ACME Corp"
				} as any
			})
		});

		const d = a.diff(b);
		expect(d.data_businesses?.name).toBeDefined();
		expect(d.data_businesses?.name?.previousValue).toBe("ACME");
		expect(d.data_businesses?.name?.newValue).toBe("ACME Corp");
		expect(d.data_businesses?.name?.comparison?.method).toBe("default");
		expect(d.data_businesses?.name?.comparison?.path).toBe("data_businesses.name");
		expect(b.getState().__metadata).toEqual(
			expect.objectContaining({
				id: "biz-1",
				customerId: null,
				updatedAt: "2025-01-01T00:00:00.000Z",
				sensitiveFields: expect.arrayContaining(["data_businesses.tin", "data_business_owners[].ssn"])
			})
		);
	});

	test("includes fields present in one state but not the other", () => {
		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState()
		});
		const b = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_businesses: {
					...(buildState().data_businesses as any),
					naics_code: "1234"
				} as any
			})
		});

		const d = a.diff(b);
		expect(d.data_businesses?.naics_code).toBeDefined();
		expect(d.data_businesses?.naics_code?.previousValue).toBeUndefined();
		expect(d.data_businesses?.naics_code?.newValue).toBe("1234");
	});

	test("handles business names as same (unordered equality)", () => {
		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_business_names: [
					{ name: "ACME Corp", is_primary: false },
					{ name: "ACME", is_primary: true }
				]
			})
		});
		const b = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_business_names: [
					{ name: "ACME", is_primary: true },
					{ name: "ACME Corp", is_primary: false }
				]
			})
		});

		const d = a.diff(b);
		expect(d.data_business_names).toBeUndefined();
	});
	test("handles business names pluralization difference with details", () => {
		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_business_names: [
					{ name: "ACME Corp", is_primary: false },
					{ name: "ACME", is_primary: true }
				]
			})
		});
		const b = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_business_names: [
					{ name: "ACME", is_primary: true },
					{ name: "ACME Corps", is_primary: false }
				]
			})
		});

		const d = a.diff(b);

		expect(d).toEqual(
			expect.objectContaining({
				data_business_names: expect.objectContaining({
					__self: expect.objectContaining({
						details: expect.objectContaining({
							addedElements: expect.arrayContaining([
								expect.objectContaining({ name: "ACME Corps", is_primary: false })
							]),
							removedElements: expect.arrayContaining([
								expect.objectContaining({ name: "ACME Corp", is_primary: false })
							])
							// changedElements may be undefined or omitted; only assert if you need to:
							// changedElements: undefined
						})
					})
				})
			})
		);
	});
	test("treats array tables as __self by default", () => {
		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState()
		});
		const b = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_cases: [{ id: "case-1" } as any, { id: "case-2" } as any]
			})
		});

		const d = a.diff(b);
		expect(d.data_cases?.__self).toBeDefined();
		expect(d.data_cases?.__self?.comparison?.method).toBe("default");
		expect(Array.isArray(d.data_cases?.__self?.previousValue)).toBe(true);
		expect(Array.isArray(d.data_cases?.__self?.newValue)).toBe(true);
	});

	test("supports comparator for arrays to ignore order", () => {
		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({ data_cases: [{ id: "case-1" } as any, { id: "case-2" } as any] })
		});
		const b = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({ data_cases: [{ id: "case-2" } as any, { id: "case-1" } as any] })
		});

		const d = a.diff(b, {
			comparators: {
				"data_cases.__self": (x, y) => {
					const idsA = (Array.isArray(x) ? x : [])
						.map(v => (v as any)?.id)
						.filter(Boolean)
						.sort();
					const idsB = (Array.isArray(y) ? y : [])
						.map(v => (v as any)?.id)
						.filter(Boolean)
						.sort();
					if (idsA.length !== idsB.length) return false;
					for (let i = 0; i < idsA.length; i++) if (idsA[i] !== idsB[i]) return false;
					return true;
				}
			}
		});
		expect(d.data_cases).toBeUndefined();
	});

	test("resolver normalizes values and emits resolver metadata on difference", () => {
		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState()
		});
		const b = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_businesses: {
					...(buildState().data_businesses as any),
					created_at: "2025-01-02T01:00:00.000Z"
				} as any
			})
		});

		// Compare only by the calendar day to force a resolver-based comparison
		const d = a.diff(b, {
			resolvers: {
				// Compare by UTC calendar day (YYYY-MM-DD), ignoring time components
				"data_businesses.created_at": v => (v ? new Date(v as any).toISOString().slice(0, 10) : v)
			}
		});
		expect(d.data_businesses?.created_at).toBeDefined();
		expect(d.data_businesses?.created_at?.comparison?.method).toBe("resolver");
		expect(d.data_businesses?.created_at?.comparison?.path).toBe("data_businesses.created_at");
	});

	test("treats equal Date instances as unchanged via deep equality", () => {
		const createdAtA = new Date("2025-01-01T12:00:00.000Z");
		const createdAtB = new Date(createdAtA.getTime());

		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: createdAtA,
			customerId: null,
			state: buildState({
				data_businesses: {
					...(buildState().data_businesses as any),
					created_at: createdAtA
				} as any
			})
		});
		const b = new BusinessState({
			id: "biz-1" as any,
			updatedAt: createdAtB,
			customerId: null,
			state: buildState({
				data_businesses: {
					...(buildState().data_businesses as any),
					created_at: createdAtB
				} as any
			})
		});

		const d = a.diff(b);
		expect(d.data_businesses?.created_at).toBeUndefined();
		expect(d.data_businesses).toBeUndefined();
	});

	test("comparator short-circuits equality and prevents diff emission", () => {
		const a = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState()
		});
		const b = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: buildState({
				data_businesses: {
					...(buildState().data_businesses as any),
					name: "acme  "
				} as any
			})
		});

		const d = a.diff(b, {
			comparators: {
				"data_businesses.name": (x, y) =>
					String(x ?? "")
						.trim()
						.toLowerCase() ===
					String(y ?? "")
						.trim()
						.toLowerCase()
			}
		});
		expect(d.data_businesses?.name).toBeUndefined();
	});

	describe("facts in business state shape", () => {
		test("treats equal facts as unchanged (no diff)", () => {
			const facts = { risk_score: 1, verified: true };
			const a = new BusinessState({
				id: "biz-1" as any,
				updatedAt: "2025-01-01T00:00:00.000Z",
				customerId: null,
				state: buildState({ facts: { ...facts } })
			});
			const b = new BusinessState({
				id: "biz-1" as any,
				updatedAt: "2025-01-01T00:00:00.000Z",
				customerId: null,
				state: buildState({ facts: { ...facts } })
			});

			const d = a.diff(b);
			expect(d.facts).toBeUndefined();
		});

		test("emits diff when facts differ (field-level)", () => {
			const a = new BusinessState({
				id: "biz-1" as any,
				updatedAt: "2025-01-01T00:00:00.000Z",
				customerId: null,
				state: buildState({ facts: { risk_score: 1 } })
			});
			const b = new BusinessState({
				id: "biz-1" as any,
				updatedAt: "2025-01-01T00:00:00.000Z",
				customerId: null,
				state: buildState({ facts: { risk_score: 2 } })
			});

			const d = a.diff(b);
			expect(d.facts?.["risk_score"]).toBeDefined();
			expect(d.facts?.["risk_score"]?.previousValue).toBe(1);
			expect(d.facts?.["risk_score"]?.newValue).toBe(2);
			expect(d.facts?.["risk_score"]?.path).toBe("facts.risk_score");
		});

		test("emits diff when one state has facts and the other has none", () => {
			const a = new BusinessState({
				id: "biz-1" as any,
				updatedAt: "2025-01-01T00:00:00.000Z",
				customerId: null,
				state: buildState({ facts: {} })
			});
			const b = new BusinessState({
				id: "biz-1" as any,
				updatedAt: "2025-01-01T00:00:00.000Z",
				customerId: null,
				state: buildState({ facts: { risk_score: 1 } })
			});

			const d = a.diff(b);
			expect(d.facts?.["risk_score"]).toBeDefined();
			expect(d.facts?.["risk_score"]?.previousValue).toBeUndefined();
			expect(d.facts?.["risk_score"]?.newValue).toBe(1);
		});

		test("fromRecord preserves facts in state", () => {
			const stateWithFacts = buildState({ facts: { risk_score: 42, verified: true } });
			const record: BusinessStateDbRecord = {
				id: "state-id" as any,
				created_at: "2025-01-01T00:00:00.000Z",
				business_id: "biz-1" as any,
				customer_id: "cust-1" as any,
				state: stateWithFacts,
				state_diff: {}
			};

			const instance = BusinessState.fromRecord(record);
			const plain = instance.getState("plain") as BusinessStateTable;
			expect(plain.facts).toEqual({ risk_score: 42, verified: true });
		});
	});
});

test("merges constructor comparators with per-call comparators", () => {
	const ctorComparators = { "data_cases.__self": (x: any, y: any) => Array.isArray(x) && Array.isArray(y) };
	const a = new BusinessState({
		id: "biz-1" as any,
		updatedAt: "2025-01-01T00:00:00.000Z",
		customerId: null,
		state: buildState({ data_cases: [{ id: "case-1" } as any] }),
		comparators: ctorComparators
	});
	const b = new BusinessState({
		id: "biz-1" as any,
		updatedAt: "2025-01-01T00:00:00.000Z",
		customerId: null,
		state: buildState({ data_cases: [{ id: "case-2" } as any] }),
		comparators: ctorComparators
	});
	// per-call comparator should override ctor comparator and detect difference
	const d = a.diff(b, {
		comparators: {
			"data_cases.__self": (x, y) => {
				const idsA = (Array.isArray(x) ? x : []).map(v => (v as any)?.id).sort();
				const idsB = (Array.isArray(y) ? y : []).map(v => (v as any)?.id).sort();
				return idsA.join("|") === idsB.join("|");
			}
		}
	});
	expect(d.data_cases?.__self).toBeDefined();
	expect(d.data_cases?.__self?.comparison?.method).toBe("comparator");
	expect((d.data_cases?.__self?.previousValue as any)?.[0]?.id).toBe("case-1");
	expect((d.data_cases?.__self?.newValue as any)?.[0]?.id).toBe("case-2");
});

test("cloneWithState preserves config and swaps state", () => {
	const a = new BusinessState({
		id: "biz-1" as any,
		updatedAt: "2025-01-01T00:00:00.000Z",
		customerId: null,
		state: buildState({
			data_business_names: [
				{ name: "ACME", is_primary: true },
				{ name: "ACME Corp", is_primary: false }
			]
		})
	});
	const newState = buildState({
		data_business_names: [
			{ name: "ACME Corp", is_primary: false },
			{ name: "ACME", is_primary: true }
		]
	});
	const b = a.cloneWithState(newState);
	const d = a.diff(b); // comparator should consider names equal even after clone
	expect(d.data_business_names).toBeUndefined();
});

test("getState('plain') returns deep clones so external mutation is isolated", () => {
	const a = new BusinessState({
		id: "biz-1" as any,
		updatedAt: "2025-01-01T00:00:00.000Z",
		customerId: null,
		state: buildState({
			data_business_names: [{ name: "ACME", is_primary: true }],
			data_business_addresses: [
				{ line_1: "1 Main", city: "X", state: "CA", country: "US", postal_code: "12345", is_primary: true } as any
			]
		})
	});
	const plain = a.getState("plain") as any;
	plain.data_business_names.push({ name: "SHOULD NOT PERSIST", is_primary: false });
	plain.data_business_addresses[0].line_1 = "mutated";

	const fresh = a.getState("plain") as any;
	expect(fresh.data_business_names.length).toBe(1);
	expect(fresh.data_business_addresses[0].line_1).toBe("1 Main");
});
