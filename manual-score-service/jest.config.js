module.exports = {
	testEnvironment: "node",
	testEnvironmentOptions: {
		NODE_ENV: "development"
	},
	restoreMocks: true,
	moduleFileExtensions: ["js", "json", "jsx", "ts", "tsx", "node"],
	testPathIgnorePatterns: ["/node_modules/", "/dist/"],
	coveragePathIgnorePatterns: ["node_modules", "dist", "src/configs", "src/constants", "src/helpers", "src/middlewares", "src/utils", "src/app.js", "src/index.js"],
	coverageThreshold: {
		global: {
			statements: 15
		}
	},
	moduleDirectories: ["node_modules", "src"],
	// A map from regular expressions to module names that allow to stub out resources with a single module
	moduleNameMapper: {
		"#configs/*": "<rootDir>/src/configs/",
		"#constants/*": "<rootDir>/src/constants/",
		"#helpers/*": "<rootDir>/src/helpers/",
		"#middlewares/*": "<rootDir>/src/middlewares/",
		"#utils/*": "<rootDir>/src/utils/",
		"#lib/*": "<rootDir>/lib/",
		"#common/*": "<rootDir>/src/common/"
	}
};
