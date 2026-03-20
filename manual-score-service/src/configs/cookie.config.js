import { tokenConfig } from "./token.config";

export const cookieOptions = {
	domain: "localhost:3000",
	maxAge: tokenConfig.REFRESH_TOKEN_LIFE_SECONDS * 1000, // milliseconds
	secure: true,
	httpOnly: true,
	sameSite: "lax"
};
