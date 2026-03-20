import type { MapperField } from "#types";
import { Mapper } from "../mapper";

jest.mock("kafkajs");

jest.mock("#configs/index", () => ({
	envConfig: {
		CRYPTO_SECRET_KEY: "secretkey",
		CRYPTO_IV: "cryptoiv",
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
		//   ... other mocked configuration properties
	}
}));
class DummyMapper extends Mapper {
	constructor(mapperDefinition: any, input: Map<string, any>, additionalMetadata: any = {}) {
		super(mapperDefinition, input, additionalMetadata);
	}
}

describe("Mapper", () => {
	let mapper: Mapper;

	beforeEach(() => {
		const mapperDefinition = {
			tables: {
				table1: {
					fields: [
						{ column: "column1", private: false },
						{ column: "column2", private: false }
					],
					order: 1
				},
				table2: {
					fields: [
						{ column: "column3", private: false },
						{ column: "column4", private: false, isDefault: true, concat: true }
					],
					order: 2
				}
			}
		};

		const input = new Map<string, any>([
			["column1", "value1"],
			["column2", "value2"],
			["maptodefault", "value3"]
		]);

		mapper = new DummyMapper(mapperDefinition, input);
	});

	describe("constructor", () => {
		it("should initialize the mapper with the provided mapper definition and input", () => {
			expect(mapper).toBeDefined();
		});
	});

	describe("getPossibleFields", () => {
		it("should return an array of possible fields", () => {
			const possibleFields = mapper.getPossibleFields();
			expect(possibleFields).toHaveLength(4);
			expect(possibleFields).toEqual(
				expect.arrayContaining([
					{ column: "column1", private: false, table: "table1" },
					{ column: "column2", private: false, table: "table1" },
					{ column: "column3", private: false, table: "table2" },
					{ column: "column4", private: false, table: "table2", isDefault: true, concat: true }
				])
			);
		});
	});

	describe("searchColumn", () => {
		it("should return the matched column for the provided key", () => {
			const matchedColumn = mapper.searchColumn("column1");
			expect(matchedColumn).toBe("column1");
		});

		it("should return the default field's column if no match is found", () => {
			const matchedColumn = mapper.searchColumn("unknownKey");
			expect(matchedColumn).toBe("column4");
		});
	});

	describe("toApiResponse", () => {
		it("should return a serializable representation of the fields", () => {
			const fields: MapperField[] = [{ column: "column1", required: false, description: "dummy", private: false, table: "table1", value: "abc" }] as MapperField[]
			const toString = mapper.toApiResponse(fields);
			expect(toString).toEqual({ column1: { column: "column1", description: "dummy", required: false, value: "abc", previousValue: undefined, providedKey: undefined } });
		});
	});
});
describe("match and execute", () => {
	const mapperDefinition = {
		tables: {
			table1: {
				fields: [
					{ column: "column1", private: false, required: true },
					{ column: "column2", private: false, table: "table1" }
				],
				order: 1
			},
			table2: {
				fields: [
					{ column: "column3", private: false },
					{ column: "column4", private: false, isDefault: true, concat: true }
				],
				order: 2
			}
		}
	};
	it("should match fields and return the required, mapped, and rejected fields", async () => {
		// Mock the input and mapper definition
		const input = new Map<string, any>([
			["column1", "value1"],
			["column2", "value2"],
			["unknownKey", "value3"]
		]);

		// Create a new instance of the DummyMapper class
		const dummyMapper = new DummyMapper(mapperDefinition, input);

		// Call the match method
		const result = await dummyMapper.match();

		// Assert the expected output
		expect(result.required).toHaveLength(0);
		expect(result.rejected).toHaveLength(0);
		expect(result.mapped).toEqual({
			column1: {
				column: "column1",
				private: false,
				table: "table1",
				value: "value1",
				providedKey: "column1",
				required: true
			},
			column2: {
				column: "column2",
				private: false,
				table: "table1",
				value: "value2",
				providedKey: "column2"
			},
			unknownKey: { column: "column4", concat: true, isDefault: true, private: false, table: "table2", value: "value3", providedKey: "unknownKey" }
		});
	});

	it("should throw an error if there are rejected or required fields", async () => {
		const input = new Map<string, any>([["column2", "value2"]]);
		const mapper = new DummyMapper(mapperDefinition, input);
		await expect(mapper.execute()).rejects.toThrow();
	});

	it("should group mapped fields by table and execute insert for each table in order", async () => {
		const tableDefinition = {
			tables: {
				table1: {
					fields: [
						{ column: "column1", private: false },
						{ column: "column2", private: false }
					],
					order: 1
				},
				table2: {
					fields: [
						{ column: "column3", private: false },
						{ column: "column4", private: false }
					],
					order: 2
				}
			}
		};
		const match = {
			rejected: [],
			required: [],
			mapped: {
				column1: { column: "column1", private: false, table: "table1", value: "value1" },
				column2: { column: "column2", private: false, table: "table1", value: "value2" },
				column3: { column: "column3", private: false, table: "table2", value: "value3" },
				column4: { column: "column4", private: false, table: "table2", value: "value4" }
			}
		};
		const mapper = new DummyMapper(tableDefinition, new Map<string, any>());
		mapper.match = jest.fn().mockResolvedValue(match);
		mapper.setMatches(match);
		mapper.executeInsert = jest.fn().mockResolvedValue("INSERT SQL");
		mapper.addAdditionalMetadata = jest.fn();

		await mapper.execute();

		expect(mapper.executeInsert).toHaveBeenCalledTimes(2);
		expect(mapper.executeInsert).toHaveBeenCalledWith(tableDefinition.tables.table1, [
			{ column: "column1", private: false, table: "table1", value: "value1" },
			{ column: "column2", private: false, table: "table1", value: "value2" }
		]);
		expect(mapper.executeInsert).toHaveBeenCalledWith(tableDefinition.tables.table2, [
			{ column: "column3", private: false, table: "table2", value: "value3" },
			{ column: "column4", private: false, table: "table2", value: "value4" }
		]);
		expect(mapper.addAdditionalMetadata).toHaveBeenCalledWith({ table1: "INSERT SQL" });
		expect(mapper.addAdditionalMetadata).toHaveBeenCalledWith({ table2: "INSERT SQL" });
	});

	it("should call checkSafeInsert and prefill functions if defined in table definition", async () => {
		const match = {
			rejected: [],
			required: [],
			mapped: {
				column1: { column: "column1", private: false, table: "table1", value: "value1" },
				column2: { column: "column2", private: false, table: "table1", value: "value2" }
			}
		};

		const mapperDefinition = {
			tables: {
				table1: {
					fields: [
						{ column: "column1", private: false },
						{ column: "column2", private: false }
					],
					order: 1,
					checkSafeInsert: jest.fn(),
					prefill: {
						table2: {
							column3: jest.fn(mapper => mapper.getFieldForColumn("column3", "table2")),
							column4: jest.fn(mapper => mapper.getFieldForColumn("column4", "table2"))
						}
					}
				},
				table2: {
					fields: [
						{ column: "column3", private: false },
						{ column: "column4", private: false }
					],
					order: 2
				}
			}
		};

		const mapper = new DummyMapper(mapperDefinition, new Map<string, any>());
		mapper.setMatches(match);

		mapper.match = jest.fn().mockResolvedValue(match);
		mapper.executeInsert = jest.fn();
		mapper.addAdditionalMetadata = jest.fn();

		await mapper.execute();

		expect(mapperDefinition.tables.table1.checkSafeInsert).toHaveBeenCalledWith(mapper, [
			{ column: "column1", private: false, table: "table1", value: "value1" },
			{ column: "column2", private: false, table: "table1", value: "value2" }
		]);
	});

	it("should call process function if defined in table definition", async () => {
		const match = {
			rejected: [],
			required: [],
			mapped: {
				column1: { column: "column1", private: false, table: "table1", value: "value1" },
				column2: { column: "column2", private: false, table: "table1", value: "value2" }
			}
		};

		const mapperDefinition = {
			tables: {
				table1: {
					fields: [
						{ column: "column1", private: false },
						{ column: "column2", private: false }
					],
					order: 1,
					process: jest.fn()
				}
			}
		};

		const mapper = new DummyMapper(mapperDefinition, new Map<string, any>());
		mapper.setMatches(match);

		mapper.match = jest.fn().mockResolvedValue(match);
		mapper.executeInsert = jest.fn();
		mapper.addAdditionalMetadata = jest.fn();

		await mapper.execute();

		expect(mapperDefinition.tables.table1.process).toHaveBeenCalledWith(mapper, [
			{ column: "column1", private: false, table: "table1", value: "value1" },
			{ column: "column2", private: false, table: "table1", value: "value2" }
		]);
	});
});
