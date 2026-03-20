const fs = require("fs");
const path = require("path");

const envConfigPath = path.resolve(__dirname, "../src/configs/env.config.js");
const envExamplePath = path.resolve(__dirname, "../.env.example");

// Read env.config.js
const configContent = fs.readFileSync(envConfigPath, "utf8");

// Regex to match all CONFIG_* keys (unicode-safe)
const configKeyRegex = /CONFIG_[A-Z0-9_]+/gu;
const matchedKeys = configContent.match(configKeyRegex) || [];
const uniqueKeys = [...new Set(matchedKeys)].sort();

// Read .env.example
const envExampleContent = fs.readFileSync(envExamplePath, "utf8");
const exampleKeys = envExampleContent
	.split("\n")
	.map(line => line.trim())
	.filter(line => line && !line.startsWith("#"))
	.map(line => line.split("=")[0]);

// Find missing keys
const missingKeys = uniqueKeys.filter(key => !exampleKeys.includes(key));

if (missingKeys.length > 0) {
	throw new Error(`Missing keys in .env.example:\n\n${missingKeys.join("\n")}`);
}
