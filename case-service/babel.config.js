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
						"#common": "./dist/src/common",
						"#configs": "./dist/src/configs",
						"#constants": "./dist/src/constants",
						"#core": "./dist/src/core",
						"#errors": "./dist/src/errors",
						"#helpers": "./dist/src/helpers",
						"#lib": "./dist/lib",
						"#messaging": "./dist/src/messaging",
						"#middlewares": "./dist/src/middlewares",
						"#types": "./dist/src/types",
						"#utils": "./dist/src/utils",
						"#workers": "./dist/src/workers"
					}
				}
			]
		]
	};
};
