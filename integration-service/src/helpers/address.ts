import { envConfig } from "#configs";
import axios from "axios";
import { logger } from "#helpers";
import QueryString from "qs";

export const getAddressWithGeoCode = async (lat: number, lon: number) => {
	try {
		const url = "https://maps.googleapis.com/maps/api/geocode/json";
		const API_KEY = envConfig.GOOGLE_MAP_API_KEY;
		const params = { latlng: `${lat},${lon}`, key: API_KEY };
		const config = {
			method: "get",
			url: `${url}?${QueryString.stringify(params)}`,
			headers: {
				"Content-Type": "application/json"
			}
		};
		const response = await axios(config);
		return response.data?.results?.[0]?.formatted_address;
	} catch (error: any) {
		logger.error(`Error getting address with geo code: ${lat}, ${lon}: ${error.message}`);
	}
};
