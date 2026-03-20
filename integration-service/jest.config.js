const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("./tsconfig");

module.exports = {
	testEnvironment: "node",
	testEnvironmentOptions: {
		NODE_ENV: "test"
	},
	restoreMocks: true,
	coveragePathIgnorePatterns: [
		"dist",
		"node_modules",
		"src/configs",
		"src/constants",
		"src/helpers",
		"src/middlewares",
		"src/utils",
		"src/app.js",
		"src/index.js"
	],
	coverageThreshold: {
		global: {
			statements: 5,
			branches: 2,
			functions: 5,
			lines: 5
		}
	},
	rootDir: ".",
	modulePathIgnorePatterns: ["<rootDir>/dist/"],
	moduleNameMapper: {
		...pathsToModuleNameMapper(compilerOptions.paths, { prefix: "<rootDir>" }),
		"@joinworth/types/(.*)": "<rootDir>/node_modules/@joinworth/types/$1"
	},
	testPathIgnorePatterns: ["/node_modules/", "/dist/", "test.utils.*"],
	setupFilesAfterEnv: ["./jest.setup.js"], // Or use setupFiles depending on your use case
	globalSetup: "./jest.globalSetup.js"
};
