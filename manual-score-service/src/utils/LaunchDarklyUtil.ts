import { envConfig } from "#configs/index";
import fs from "fs";
import path from "path";

export function getLaunchDarklyFilePath() {
	const filePath = path.join(__dirname, "..", "..", envConfig.LD_TEST_FLAGS_FILE);

	if (fs.existsSync(filePath)) {
		return [filePath];
	}
	return undefined;
}
