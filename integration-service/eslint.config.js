// ESLint flat config with ignore patterns migrated from .eslintignore

module.exports = [
	{
		ignores: ["**/node_modules/**", "db/migrations/migrate/*.js", "db/migrations/seed/*.js", "package.json", "bin", "dist/**"],
		rules: {
			"no-tabs": "off",
			camelcase: ["error", { properties: "never", ignoreDestructuring: true, allow: [] }],
			// "multiline-comment-style": ["error", "starred-block"],
			"no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }]
		}
	}
];
