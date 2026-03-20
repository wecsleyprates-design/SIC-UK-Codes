/**
 * NOTICE: This script will not be executed unless signed off by other developers BEFORE execution in production!!!
 * Script to backfill merchant_name from S3-stored Plaid asset reports
 *
 * Usage (REQUIRES DOPPLER):
 *   # Backfill all transactions without merchant_name (across all customers):
 *   doppler run -- node scripts/backfill-merchant-name-from-s3.js
 *
 *   # Backfill transactions for a specific customer:
 *   doppler run -- node scripts/backfill-merchant-name-from-s3.js --customer-id <customerID>
 *
 *   # Backfill transactions for a specific business (legacy mode):
 *   doppler run -- node scripts/backfill-merchant-name-from-s3.js <businessID>
 *
 *   OR (if running in container):
 *   docker exec integration-service doppler run -- node scripts/backfill-merchant-name-from-s3.js [--customer-id <customerID>]
 *
 * NOTE: This script MUST be run with Doppler. Environment variables are loaded via Doppler.
 *
 * This script:
 * 1. Retrieves the asset report from S3
 * 2. Extracts merchant_name from transactions in the asset report
 * 3. Updates bank_account_transactions table with merchant_name
 * 4. Matches transactions by transaction_id
 *
 */

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Pool } = require("pg");
const { logger } = require("../src/helpers/logger");

// This script requires Doppler for environment variables
// Doppler should be invoked via: doppler run -- node scripts/backfill-merchant-name-from-s3.js [...]

// Initialize S3 client
const s3Client = new S3Client({
	region: process.env.CONFIG_AWS_COGNITO_REGION || process.env.AWS_COGNITO_REGION || "us-east-1",
	credentials: {
		accessKeyId: process.env.CONFIG_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.CONFIG_AWS_ACCESS_KEY_SECRET || process.env.AWS_ACCESS_KEY_SECRET
	}
});

// Initialize database connection
const pool = new Pool({
	host: process.env.CONFIG_DB_HOST || process.env.DB_HOST,
	port: parseInt(process.env.CONFIG_DB_PORT || process.env.DB_PORT || "5432"),
	user: process.env.CONFIG_DB_USER || process.env.DB_USER,
	password: process.env.CONFIG_DB_PASSWORD || process.env.DB_PASSWORD,
	database: process.env.CONFIG_DB_NAME || process.env.DB_NAME || "integration",
	ssl: process.env.CONFIG_ENV === "production" ? { rejectUnauthorized: false } : false
});

async function getJSONFromS3(fileName) {
	try {
		// Try multiple environment variable names
		const bucket =
			process.env.CONFIG_AWS_ASSETS_BUCKET || process.env.AWS_ASSETS_BUCKET || process.env.ENV_CONFIG_AWS_ASSETS_BUCKET;
		if (!bucket) {
			logger.error(
				"Available env vars with 'BUCKET':",
				Object.keys(process.env).filter(k => k.includes("BUCKET"))
			);
			throw new Error("AWS_ASSETS_BUCKET environment variable is not set");
		}
		const params = {
			Bucket: bucket,
			Key: fileName
		};
		const command = new GetObjectCommand(params);
		const response = await s3Client.send(command);
		const chunks = [];
		for await (const chunk of response.Body) {
			chunks.push(chunk);
		}
		const buffer = Buffer.concat(chunks);
		return JSON.parse(buffer.toString());
	} catch (ex) {
		logger.warn(`Exception getting JSON from S3: ${fileName}`, ex.message);
		return null;
	}
}

function generateIntegrationFilePath(businessID, integrationDirectory, platformName) {
	return integrationDirectory.replace(":businessID", businessID).replace(":integrationPlatform", platformName);
}

async function getRawIntegrationDataFromS3(businessID, fileName, integrationDirectory, platformName) {
	const path = generateIntegrationFilePath(businessID, integrationDirectory, platformName);
	const fullFileName = `${path}/${fileName}.json`;
	return await getJSONFromS3(fullFileName);
}

/**
 * Get all business IDs for a given customer ID
 */
async function getBusinessIdsByCustomerId(customerId) {
	try {
		// Query to get business_ids from cases for a customer
		// This assumes businesses are linked through cases
		const result = await pool.query(
			`
			SELECT DISTINCT dc.business_id
			FROM integrations.data_connections dc
			JOIN integrations.data_business_integrations_tasks dbit ON dbit.connection_id = dc.id
			JOIN integrations.business_score_triggers bst ON bst.id = dbit.business_score_trigger_id
			JOIN public.data_cases cases ON cases.score_trigger_id = bst.id
			WHERE cases.customer_id = $1
			AND dc.business_id IS NOT NULL
		`,
			[customerId]
		);

		return result.rows.map(row => row.business_id);
	} catch (error) {
		logger.error({ error }, `❌ Error getting business IDs for customer ${customerId}`);
		throw error;
	}
}

/**
 * Get all business IDs that have transactions without merchant_name
 */
async function getAllBusinessIdsWithoutMerchantName() {
	try {
		const result = await pool.query(`
			SELECT DISTINCT dc.business_id
			FROM integration_data.bank_account_transactions bat
			JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = bat.business_integration_task_id
			JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
			WHERE (bat.merchant_name IS NULL OR bat.merchant_name = '')
			AND dc.business_id IS NOT NULL
		`);

		return result.rows.map(row => row.business_id);
	} catch (error) {
		logger.error({ error }, "❌ Error getting business IDs without merchant_name");
		throw error;
	}
}

async function backfillMerchantNameFromS3(businessID) {
	try {
		logger.info(`\n🔍 Fetching asset report from S3 for business: ${businessID}...`);

		// Get asset report from S3
		const DIRECTORIES = {
			BANKING: "businesses/:businessID/banking/:integrationPlatform"
		};
		const assetReport = await getRawIntegrationDataFromS3(businessID, "asset_reports", DIRECTORIES.BANKING, "PLAID");

		if (!assetReport || !assetReport.report) {
			logger.warn(`⚠️  No asset report found in S3 for business: ${businessID}`);
			return { updated: 0, skipped: 0, errors: 0 };
		}

		logger.info(`✅ Found asset report with ${assetReport.report.items?.length || 0} items`);

		// Build a map of transaction_id -> merchant_name from the asset report
		// Also track which source each merchant_name came from
		const transactionMerchantMap = new Map();
		const transactionSourceMap = new Map(); // Track source for each transaction
		let totalTransactionsInReport = 0;
		const sourceCounts = {
			"transaction.name": 0,
			"transaction.merchant_name": 0,
			none: 0
		};

		for (const item of assetReport.report.items || []) {
			for (const account of item.accounts || []) {
				for (const transaction of account.transactions || []) {
					totalTransactionsInReport++;

					// Extract merchant_name from Plaid transaction
					// Prioritize merchant_name over name (name is legacy and may be deprecated)
					// When include_insights is true, Plaid provides merchant name in the 'merchant_name' field
					let merchantName = null;
					let source = "none";

					if (transaction.merchant_name != null && transaction.merchant_name !== "") {
						// Preferred: merchant_name is the recommended field (when include_insights is true)
						merchantName = transaction.merchant_name;
						source = "transaction.merchant_name";
						sourceCounts["transaction.merchant_name"]++;
					} else if (transaction.name) {
						// Fallback: name is legacy but still used in some cases
						merchantName = transaction.name;
						source = "transaction.name";
						sourceCounts["transaction.name"]++;
					} else {
						sourceCounts["none"]++;
					}

					if (merchantName && transaction.transaction_id) {
						transactionMerchantMap.set(transaction.transaction_id, merchantName);
						transactionSourceMap.set(transaction.transaction_id, source);
					}
				}
			}
		}

		logger.info(`📊 Found ${totalTransactionsInReport} transactions in asset report`);
		logger.info(`📊 Found ${transactionMerchantMap.size} transactions with merchant_name`);
		logger.info(`\n📊 Merchant name sources:`);
		logger.info(`   - transaction.merchant_name: ${sourceCounts["transaction.merchant_name"]}`);
		logger.info(`   - transaction.name: ${sourceCounts["transaction.name"]}`);
		logger.info(`   - none (no merchant name found): ${sourceCounts["none"]}`);

		if (transactionMerchantMap.size === 0) {
			logger.warn("⚠️  No merchant names found in asset report. This might mean:");
			logger.warn("   - Asset report was created without include_insights: true");
			logger.warn("   - Transactions don't have merchant information from Plaid");
			return { updated: 0, skipped: 0, errors: 0 };
		}

		// Get all transactions for this business that don't have merchant_name populated
		logger.info(`\n🔍 Finding transactions to update...`);
		const result = await pool.query(
			`
			SELECT bat.id, bat.transaction_id, bat.merchant_name, bat.description
			FROM integration_data.bank_account_transactions bat
			JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = bat.business_integration_task_id
			JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
			WHERE dc.business_id = $1
			AND (bat.merchant_name IS NULL OR bat.merchant_name = '')
		`,
			[businessID]
		);

		const transactions = result.rows || [];
		logger.info(`📊 Found ${transactions.length} transactions without merchant_name`);

		let updated = 0;
		let skipped = 0;
		let errors = 0;
		const updateSourceCounts = {
			"transaction.name": 0,
			"transaction.merchant_name": 0
		};

		// Update transactions with merchant_name from the map
		// Batch update: collect ids and merchantNames
		const ids = [];
		const merchantNames = [];
		const sources = [];
		for (const transaction of transactions) {
			const merchantName = transactionMerchantMap.get(transaction.transaction_id);
			const source = transactionSourceMap.get(transaction.transaction_id);
			if (merchantName) {
				ids.push(transaction.id);
				merchantNames.push(merchantName);
				sources.push(source);
				if (source) {
					updateSourceCounts[source] = (updateSourceCounts[source] || 0) + 1;
				}
			} else {
				skipped++;
			}
		}

		// Perform batch update
		if (ids.length > 0) {
			try {
				await pool.query(
					`
					UPDATE integration_data.bank_account_transactions AS bat
					SET merchant_name = updates.merchant_name
					FROM (
						SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::text[]) AS merchant_name
					) AS updates
					WHERE bat.id = updates.id
				`,
					[ids, merchantNames]
				);
				updated = ids.length;
				if (updated % 100 === 0) {
					logger.info(`  ✅ Updated ${updated} transactions...`);
				}
			} catch (error) {
				logger.error({ error }, "❌ Error updating transactions batch");
				errors = ids.length;
			}
		}

		logger.info(`\n✅ Backfill complete!`);
		logger.info(`   - Updated: ${updated} transactions`);
		logger.info(`   - Skipped: ${skipped} transactions (no merchant_name in asset report)`);
		logger.info(`   - Errors: ${errors} transactions`);
		logger.info(`\n📊 Updated transactions by source:`);
		logger.info(`   - transaction.merchant_name: ${updateSourceCounts["transaction.merchant_name"]}`);
		logger.info(`   - transaction.name: ${updateSourceCounts["transaction.name"]}`);

		return { updated, skipped, errors };
	} catch (error) {
		logger.error({ error }, "❌ Error during backfill");
		throw error;
	}
}

/**
 * Main function to backfill merchant names
 * Supports three modes:
 * 1. No arguments: backfill all transactions without merchant_name (across all customers)
 * 2. --customer-id <customerID>: backfill transactions for a specific customer
 * 3. <businessID>: backfill transactions for a specific business (legacy mode)
 */
async function main() {
	const args = process.argv.slice(2);

	// Check for --customer-id flag
	const customerIdIndex = args.indexOf("--customer-id");
	let customerId = null;
	let businessID = null;

	if (customerIdIndex !== -1) {
		// Customer ID mode
		customerId = args[customerIdIndex + 1];
		if (!customerId) {
			logger.error("❌ Error: --customer-id requires a customer ID");
			logger.error("Usage: doppler run -- node scripts/backfill-merchant-name-from-s3.js --customer-id <customerID>");
			process.exit(1);
		}

		logger.info(`\n🔍 Getting business IDs for customer: ${customerId}...`);
		const businessIds = await getBusinessIdsByCustomerId(customerId);

		if (businessIds.length === 0) {
			logger.warn(`⚠️  No businesses found for customer: ${customerId}`);
			await pool.end();
			process.exit(0);
		}

		logger.info(`✅ Found ${businessIds.length} business(es) for customer: ${customerId}`);

		let totalUpdated = 0;
		let totalSkipped = 0;
		let totalErrors = 0;

		for (const bid of businessIds) {
			logger.info(`\n📦 Processing business: ${bid}...`);
			const result = await backfillMerchantNameFromS3(bid);
			totalUpdated += result.updated;
			totalSkipped += result.skipped;
			totalErrors += result.errors;
		}

		logger.info(`\n✅ Backfill complete for customer: ${customerId}`);
		logger.info(`   - Total Updated: ${totalUpdated} transactions`);
		logger.info(`   - Total Skipped: ${totalSkipped} transactions`);
		logger.info(`   - Total Errors: ${totalErrors} transactions`);

		await pool.end();
		return;
	} else if (args.length > 0) {
		// Legacy mode: single business ID
		businessID = args[0];
		logger.info(`\n📦 Processing single business: ${businessID}...`);
		await backfillMerchantNameFromS3(businessID);
		logger.info(`\n✅ Backfill complete for business: ${businessID}`);
		await pool.end();
		return;
	} else {
		// Default mode: all transactions without merchant_name
		logger.info(`\n🔍 Getting all businesses with transactions missing merchant_name...`);
		const businessIds = await getAllBusinessIdsWithoutMerchantName();

		if (businessIds.length === 0) {
			logger.info(`✅ No businesses found with transactions missing merchant_name`);
			await pool.end();
			process.exit(0);
		}

		logger.info(`✅ Found ${businessIds.length} business(es) with transactions missing merchant_name`);

		let totalUpdated = 0;
		let totalSkipped = 0;
		let totalErrors = 0;

		for (const bid of businessIds) {
			logger.info(`\n📦 Processing business: ${bid}...`);
			const result = await backfillMerchantNameFromS3(bid);
			totalUpdated += result.updated;
			totalSkipped += result.skipped;
			totalErrors += result.errors;
		}

		logger.info(`\n✅ Backfill complete for all businesses`);
		logger.info(`   - Total Updated: ${totalUpdated} transactions`);
		logger.info(`   - Total Skipped: ${totalSkipped} transactions`);
		logger.info(`   - Total Errors: ${totalErrors} transactions`);

		await pool.end();
		return;
	}
}

// Run the script if called directly
if (require.main === module) {
	main()
		.then(() => {
			logger.info("\n✅ Script completed successfully");
			process.exit(0);
		})
		.catch(error => {
			logger.error({ error }, "❌ Script failed");
			process.exit(1);
		});
}

module.exports = { backfillMerchantNameFromS3 };
