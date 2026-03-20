export class PaginationMaxRangeError extends Error {
	constructor(message = "Page Requested is Out of Max Page Range") {
		super(message);
		this.name = "PaginationMaxRangeError";
	}
}
