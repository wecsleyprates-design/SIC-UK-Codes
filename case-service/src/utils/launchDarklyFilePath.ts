import { envConfig } from "#configs";

const fs = require('fs');
const path = require('path');
 
export function getLaunchDarklyFilePath() {
  const filePath = path.join(__dirname, '..', '..', envConfig.LD_TEST_FLAGS_FILE);
  
  if (fs.existsSync(filePath)) {
    return [filePath];
  }
  return undefined;
}
