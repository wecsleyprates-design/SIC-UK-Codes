module.exports = {
	testEnvironment: "node",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
	testEnvironmentOptions: {
		NODE_ENV: "development"
	},
	restoreMocks: true,
	coveragePathIgnorePatterns: [
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
			statements: 70,
			branches: 50,
			functions: 70,
			lines: 70
		}
	},
	testPathIgnorePatterns: ["/node_modules/", "/dist/", "__mocks__"],
	// Transform ES modules from node_modules that use export syntax
	transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],
	// A map from regular expressions to module names that allow to stub out resources with a single module
	moduleNameMapper: {
		"#common/*": "<rootDir>/src/common/",
		"#configs/*": "<rootDir>/src/configs/",
		"#constants/*": "<rootDir>/src/constants/",
		"#core/*": "<rootDir>/src/core/",
		"#errors/*": "<rootDir>/src/errors/",
		"#helpers/*": "<rootDir>/src/helpers/",
		"#lib/*": "<rootDir>/lib/",
		"#middlewares/*": "<rootDir>/src/middlewares/",
		"#messaging/*": "<rootDir>/src/messaging/",
		"#utils/*": "<rootDir>/src/utils/",
		"#types/*": "<rootDir>/src/types/",
		"#workers/*": "<rootDir>/src/workers/"
	}
};
