module.exports = function (api) {
	const config = { presets: [["@babel/preset-env"], "@babel/preset-typescript"] };

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
					alias: {
						"#api": "./dist/src/api",
						"#common": "./dist/src/common",
						"#configs": "./dist/src/configs",
						"#constants": "./dist/src/constants",
						"#helpers": "./dist/src/helpers",
						"#middlewares": "./dist/src/middlewares",
						"#utils": "./dist/src/utils",
						"#lib": "./dist/lib",
						"#types": "./dist/src/types",
						"#workers": "./dist/src/workers"
					}
				}
			]
		]
	};
};
