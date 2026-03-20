import { logger } from "#helpers/logger";
import { sqlQuery } from "#helpers";
import { BusinessExtendedData } from "./types";

// Dedicated module for comprehensive data aggregation.
export class ExtendedData {
    // Currently, this is intended only to be used for Eccalon.
    static async getBusinessExtendedData(businessID: string): Promise<BusinessExtendedData | null> {
        logger.info(`Fetching extended data for businessID: ${businessID}`);

        // Stored procedure to fetch extended data for the business
        const getBusinessExtendedDataQuery = `SELECT * FROM integration_data.extended_attributes($1)`;
        
        const result = await sqlQuery({ sql: getBusinessExtendedDataQuery, values: [businessID] });

        if (!result.rows || result.rows.length === 0) return null;

        return result.rows[0];
    }
}
