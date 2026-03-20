declare module "us-state-codes" {
	export const getStateCodeByStateName: (code: string) => string | null;
	export const sanitizeStateCode: (code: string) => string | null;
	export const sanitizeStateName: (name: string) => string | null;
	export const getStateNameByStateCode: (code: string) => string | null;
}
