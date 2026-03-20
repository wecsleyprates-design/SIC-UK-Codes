export type Serialized<T> = {
	[K in keyof T]: T[K] extends Object ? any : T[K];
};

// Keys that should only exist in an Egg<T>
export type EggOnly<T> = { __optional: T };
// Keys that should only exist in a Stored<T>
export type StoredOnly<T> = T & { __persist: T };

// Representation of an Egg<T> object
export type Egg<T> = Omit<T, StoredKeys<T> | EggKeys<T>> & {
	[K in EggKeys<T>]: UnwrapField<T[K]>;
};

// Representation of a Stored<T> object
export type Stored<T> = {
	[K in ExtractKey<Omit<T, EggKeys<T>>>]: UnwrapField<T[K]>;
};

// Utility to take an Egg<T> or Stored<T> and return the underlying object
export type Unwrap<T> = {
	[K in keyof T]: UnwrapField<T[K]>;
};

export type AnyUnserialized<T> = Stored<T> | Egg<T>;
export type AnySerialized<T> = Serialized<Stored<T>> | Serialized<Egg<T>>;
export type AnyEgg<T> = Egg<T> | Serialized<Egg<T>>;
export type AnyStored<T> = Stored<T> | Serialized<Stored<T>>;
export type Any<T> = AnyEgg<T> | AnyStored<T>;

type UnwrapField<T> = T extends StoredOnly<infer U> ? U : T extends EggOnly<infer U> ? U : T;
type EggKeys<T> = {
	[K in keyof T]-?: T[K] extends EggOnly<any> ? K : never;
}[keyof T];

type StoredKeys<T> = {
	[K in keyof T]-?: T[K] extends StoredOnly<any> ? K : never;
}[keyof T];

type ExtractKey<T> = {
	[K in keyof T]-?: K;
}[keyof T];

/** Pagination  */
export type PaginatedResponse<T, RecordType> = [T[], PaginationOptions<RecordType>];
export type PaginationOptions<RecordType> = {
	page: number;
	orderBy?: keyof RecordType;
	orderDirection?: "asc" | "desc";
	pageSize?: number | "all";
	count?: number;
};
