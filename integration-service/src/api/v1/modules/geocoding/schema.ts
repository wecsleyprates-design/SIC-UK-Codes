import { z } from "zod";

export const schema = {
	geocodeAddress: z.object({
		query: z.object({
			address: z.string().min(1, "Address is required")
		})
	})
};

