import type { IDBConnection } from "#types/db";
import { Rutter } from "../rutter";

class QuickBooks extends Rutter {
	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
	}
}

module.exports = QuickBooks;
