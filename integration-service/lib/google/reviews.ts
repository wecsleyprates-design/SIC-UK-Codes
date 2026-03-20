import axios from "axios";

export const getGoogleBusinessReviews = async (account: string, location: string, authorization: string, queryParams?: string) => {
	try {
		const config = {
			method: "get",
			url: `https://mybusiness.googleapis.com/v4/${account}/${location}/reviews${queryParams ? `?${queryParams}` : ""}`,
			headers: {
				"Content-Type": "application/json",
				authorization
			}
		};

		const response = await axios.request(config);

		return response.data;
	} catch (error) {
		throw error;
	}
};

export const getGooglePlaceID = async (params: string) => {
	try {
		const config = {
			method: "get",
			url: `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`,
			headers: {
				"Content-Type": "application/json"
			}
		};
		const response = await axios(config);
		return response.data;
	} catch (error) {
		throw error;
	}
};

export const getGooglePlacesReviews = async (params: string) => {
	try {
		const config = {
			method: "get",
			url: `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);

		return response.data;
	} catch (error) {
		throw error;
	}
};
