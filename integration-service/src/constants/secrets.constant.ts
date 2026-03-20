export const SECRET_PATH = {
	PREFIX: "customer",
	SUFFIX: "storage-data"
} as const;

export const VERSION_STAGE = "AWSCURRENT";
export const OPERATION = {
	CREATE: "CREATE",
	READ: "READ",
	UPDATE: "UPDATE",
	DELETE: "DELETE"
} as const;

export const SECRET_STATUS = {
	ACTIVE: "ACTIVE",
	INACTIVE: "INACTIVE",
	DELETED: "DELETED"
} as const;
