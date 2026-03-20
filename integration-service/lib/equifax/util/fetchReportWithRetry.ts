import axios, { AxiosRequestConfig, isAxiosError } from "axios";

/**
 *
 * @param token - The bearer token for the API request.
 * @param path - The path (URL) to the report.
 * @param retryUntil - The timestamp when the retry should retry until. Once this timestamp is reached, the function will no longer retry.
 * @param retryDelay - The delay between retries in milliseconds. The default is 1 second.
 * @returns The report as a buffer
 */
export const fetchReportWithRetry = async (
	token: string,
	path: string,
	retryUntil: number,
	retryDelay: number = 1000
): Promise<Buffer> => {
	const options: AxiosRequestConfig = {
		responseType: "arraybuffer",
		headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" }
	};

	try {
		const result = await axios.get<Buffer>(path, options);
		return result.data;
	} catch (error) {
		if (isAxiosError(error) && error.response?.status === 409) {
			if (Date.now() < retryUntil) {
				/** Wait retryDelay milliseconds and try again */
				await new Promise(resolve => setTimeout(resolve, retryDelay));
				return await fetchReportWithRetry(token, path, retryUntil);
			}
		}
		throw error;
	}
};
