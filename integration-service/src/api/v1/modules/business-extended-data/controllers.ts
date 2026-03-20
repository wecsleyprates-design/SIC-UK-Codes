import { catchAsync } from "#utils/catchAsync";
import type { Response } from "#types/index";
import type { Request } from "express";
import { getBusinessCustomers, getFlagValue } from "#helpers";
import { FEATURE_FLAGS } from "#constants";
import { StatusCodes } from "http-status-codes";
import { ExtendedData } from "#lib/extendedData/extendedData";

export const controller = {
	getBusinessExtendedData: catchAsync(async (req: Request, res: Response) => {
		const { businessID } = req.params;

		const getBusinessCustomersResponse = await getBusinessCustomers(businessID);
		const customerIds = getBusinessCustomersResponse.customer_ids;
		if (!customerIds || customerIds.length === 0) return res.jsend.error("You do not have access to this resource", StatusCodes.FORBIDDEN);
		const hasAccess = await getFlagValue(FEATURE_FLAGS.DOS_636_BUSINESS_EXTENDED_DATA, { key: "customer", kind: "customer", customer_id: customerIds[0] });
		if (!hasAccess) return res.jsend.error("You do not have access to this resource", StatusCodes.FORBIDDEN);

		try {
			const getBusinessExtendedDataRespone = await ExtendedData.getBusinessExtendedData(businessID);
			if (!getBusinessExtendedDataRespone) return res.jsend.success({}, "No extended data found for the specified business");
			return res.jsend.success(getBusinessExtendedDataRespone, "Extended data retrieved successfully");
		} catch (error: any) {
			return res.jsend.error(`Error retrieving extended data for business: ${error.message}`, StatusCodes.INTERNAL_SERVER_ERROR);
		}
	})
};
