const { compilerOptions } = require("./jsconfig");
/* Translate jsconfig paths to babel paths */
const convertedPaths = Object.entries(compilerOptions.paths).reduce((acc, [key, [value]]) => {
	acc[key.replace("/*", "")] = `${value.replace("./src/", "./dist/src/").replace("./lib/", "./dist/lib/").replace("/*", "/")}`;
	return acc;
}, {});

module.exports = function (api) {
	const config = {
		presets: [["@babel/preset-env"], ["@babel/preset-typescript", { allowDeclareFields: true }]],
		plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]]
	};

	const isTest = api.env("test");

	// this config is used by jest
	if (isTest) {
		return config;
	}

	return {
		...config,
		plugins: [
			[
				"module-resolver",
				{
					root: ["./"],
					alias: convertedPaths
				}
			],
			["@babel/plugin-proposal-decorators", { legacy: true }]
		]
	};
};
