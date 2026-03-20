// ESLint flat config with ignore patterns migrated from .eslintignore
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
	{
		// Global ignores - these files/directories will be completely ignored
		ignores: [
			"**/node_modules/**",
			"**/dist/**",
			"**/coverage/**",
			"**/logs/**",
			"**/*.d.ts",
			"db/migrations/migrate/*.js",
			"db/migrations/seed/*.js",
			"package.json",
			"bin/**",
			"plopfile.ts"
		]
	},
	{
		// Configuration for JavaScript files (excluding ignored patterns)
		files: ["src/**/*.js", "*.js"],
		ignores: ["**/dist/**", "**/node_modules/**"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module"
		},
		rules: {
			"no-tabs": "off",
			"no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_"
				}
			]
		}
	},
	{
		// Configuration for TypeScript files (excluding ignored patterns)
		files: ["src/**/*.ts"],
		ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts"],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2022,
			sourceType: "module",
			parserOptions: {
				project: "./tsconfig.json"
			}
		},
		plugins: {
			"@typescript-eslint": tsPlugin
		},
		rules: {
			"no-tabs": "off",
			// Enforce camelCase for variables but ignore destructured ones
			"@typescript-eslint/naming-convention": [
				"error",
				// Normal variables must be camelCase or UPPER_CASE
				{
					selector: "variable",
					format: ["camelCase", "UPPER_CASE"],
					leadingUnderscore: "allow"
				},
				// Destructured variables: allow anything
				{
					selector: "variable",
					modifiers: ["destructured"],
					format: null
				}
			],
			// Disable the base rule for TypeScript files
			"no-unused-vars": "off",
			// Use TypeScript-specific rule instead
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_"
				}
			]
		}
	}
];
