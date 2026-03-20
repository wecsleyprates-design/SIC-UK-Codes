const cwd = process.cwd();
const packageJson = require(`${cwd}/package.json`);

export const pkgConfig = {
	APP_NAME: packageJson.name,
	APP_VERSION: packageJson.version
};
