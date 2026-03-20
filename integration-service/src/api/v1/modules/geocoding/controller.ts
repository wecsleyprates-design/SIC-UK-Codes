import { catchAsync } from "#utils/catchAsync";
import { Request } from "express";
import { Response } from "#types/index";
import { geocodingService } from "./geocoding";

/**
 * Controller for geocoding endpoints.
 * Handles HTTP requests and delegates business logic to geocodingService.
 */
export const controller = {
	/**
	 * Geocodes an address using Google Maps Geocoding API via backend proxy.
	 * 
	 * @route GET /api/v1/geocoding
	 * @param req.query.address - The address string to geocode (validated by schema middleware)
	 * @returns GeocodingResponse with location data
	 */
	geocodeAddress: catchAsync(async (req: Request, res: Response) => {
		// Address is already validated by schema middleware, so we can safely cast
		const { address } = req.query as { address: string };

		const result = await geocodingService.geocodeAddress(address);

		return res.jsend.success(result, "Address geocoded successfully");
	})
};

