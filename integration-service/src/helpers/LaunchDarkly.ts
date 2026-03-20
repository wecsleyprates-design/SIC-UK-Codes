import { envConfig } from "#configs";
import { init, LDOptions, type LDClient, type LDContext, type LDFlagValue } from "@launchdarkly/node-server-sdk";
import { logger } from "./logger";
import { FileDataSourceFactory } from "@launchdarkly/node-server-sdk/integrations";
import { getLaunchDarklyFilePath, verifyToken } from "#utils";

let launchDarklyClient: LDClient;

export async function initializeLDClient() {
	const options: LDOptions = {};
	if (envConfig.LD_TEST_FLAGS_FILE) {
		// Make sure you run the make cmd to generate the feature_flags.json file in local
		// to test the feature flags locally
		// CMD id => make feature-flags LD_SDK_KEY=YOUR_SDK
		// Else it will use the feature flags from the LaunchDarkly dashboard
		const paths = getLaunchDarklyFilePath();
		if (paths) {
			const fileData = new FileDataSourceFactory({
				paths
			});
			options.updateProcessor = fileData.getFactory();
			options.sendEvents = false;
		}
	}

	if (!envConfig.LD_SDK_KEY) {
		throw new Error("LaunchDarkly SDK Key is missing");
	}

	launchDarklyClient = init(envConfig.LD_SDK_KEY as string, options);
	await launchDarklyClient.waitForInitialization({ timeout: envConfig.LD_INTIALIZATION_TIMEOUT || 10 });
	logger.info("LaunchDarkly initialised");
}

export async function getClient() {
	if (launchDarklyClient) {
		await launchDarklyClient.waitForInitialization({ timeout: 5 });
		return launchDarklyClient;
	}
	await initializeLDClient();
	return launchDarklyClient;
}

export async function getFlagValue<T = LDFlagValue>(
	key: string,
	user?: LDContext | null,
	defaultValue: T | boolean = false
): Promise<T | boolean> {
	const ldClient = await getClient();
	let flagValue: T;
	if (!user || (typeof user === "object" && Object.hasOwn(user, key) && !user.key)) {
		user = {
			key: "anonymous"
		};
	}
	flagValue = await ldClient.variation(key, user, defaultValue);
	return flagValue;
}

export async function featureFlagStatus(featureFlagKey: string, userID: string = "anonymous", additionalAttributes = {}) {
	const user = { key: userID, ...additionalAttributes };
	try {
		const ldClient = await getClient();
		const { value, reason } = await ldClient.variationDetail(featureFlagKey, user, false);
		return { isEnabled: value, hasFeatureFlag: reason.kind !== "ERROR" };
	} catch (err) {
		logger.error({ err, featureFlagKey, user, additionalAttributes }, "failed to retrieve feature flag status");
	}
	return { isEnabled: false, hasFeatureFlag: false };
}

export async function getFlagValueByToken(featureFlagKey: string, payload: { authorization: string }) {
	try {
		const token = payload.authorization.split(" ")[1];

		const tokenData = await verifyToken(token);

		const context = {
			key: tokenData["custom:id"] as string,
			name: `${tokenData.given_name as string} ${tokenData.family_name as string}`,
			email: tokenData.email as string
		};

		const flagValue = await getFlagValue(featureFlagKey, context);
		return flagValue;
	} catch (error) {
		throw error;
	}
}
