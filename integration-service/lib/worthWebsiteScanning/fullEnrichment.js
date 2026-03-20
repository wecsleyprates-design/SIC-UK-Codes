// ============================================================================
// Full enrichment with 4 core steps - Standalone Module
// ============================================================================
//
// 📦 BUNDLE INFORMATION:
//    Generated: 2025-06-04T01:55:15.127Z
//    Example: fullEnrichment
//    Source: examples/fullEnrichment/index.js
//    Output: fullEnrichment.bundle.js
//    Project Version: 1.0.0
//
// 🔧 BUILD ENVIRONMENT:
//    Build Tool: esbuild (bundle + CommonJS)
//    Node.js: v18.16.0
//    Platform: Darwin 24.2.0 (arm64)
//    Target: node14+
//    Format: CommonJS (require/module.exports)
//
// 📋 EXTERNAL DEPENDENCIES:
//    • playwright
//    • playwright-extra
//    • puppeteer-extra-plugin-stealth
//    • openai
//    • csv-parser
//    • dotenv
//    • naicsjs
//    • whois
//
// 🚀 USAGE:
//    const deps = {
//      fs: require('fs'),
//      csv: require('csv-parser'),
//      path: require('path'),
//      crypto: require('crypto'),
//      playwright: require('playwright'),
//      playwrightExtra: require('playwright-extra'),
//      stealthPlugin: require('puppeteer-extra-plugin-stealth'),
//    };
//
//    const { simplifiedFullEnrichment } = require('./fullEnrichment.bundle.js');
//    const businessData = { company_name: "Example Corp", /* ... */ };
//    await simplifiedFullEnrichment(deps, businessData, './output');
//
// 📖 MORE INFO:
//    - Source code: examples/fullEnrichment/index.js
//    - Build config: examples/build.config.js
//    - Documentation: README.md
//
// ============================================================================

const __getOwnPropNames = Object.getOwnPropertyNames;
const __commonJS = (cb, mod) =>
	function __require() {
		return mod || ((0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports);
	};

const { envConfig } = require("../../src/configs/env.config.js");
const { logger } = require("../../src/helpers/logger.js");
const https = require("https");
const axios = require("axios");
const OPENAI_MODEL_VERSION = "gpt-4.1-nano";

// utils/stringFormat.js
const _stringFormat = __commonJS({
	"utils/stringFormat.js"(exports2, module2) {
		function splitAddress(addressString) {
			const trimmedAddress = addressString.trim();
			const regex = /^(.*),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/u;
			const match = trimmedAddress.match(regex);
			if (match) {
				const postalCode = match[4];
				const state = match[3];
				const city = match[2];
				const address = match[1].trim();
				return { address, city, state, postalCode };
			}
			return { address: trimmedAddress, city: "", state: "", postalCode: "" };
		}
		function getShortBusinessName2(businessName) {
			const prefixes = /^(the|a|an)\s+/iu;
			const suffixes = /[\s,]*(llc|inc\.?|ltd|corp\.?|co\.?|plc|p\.?c\.?|s\.?a\.?|\(.*\))$/iu;
			let shortName = businessName.replace(prefixes, "");
			shortName = shortName.replace(suffixes, "");
			return shortName.trim();
		}
		function extractDomain(urlOrDomain) {
			if (!urlOrDomain || typeof urlOrDomain !== "string") {
				return "";
			}
			let domain = urlOrDomain.trim().toLowerCase();
			domain = domain.replace(/^[a-z]+:\/\//u, "");
			domain = domain.replace(/^www\./u, "");
			domain = domain.split("/")[0].split("?")[0].split("#")[0];
			domain = domain.split(":")[0];
			if (!/^[a-z0-9.-]+\.[a-z]{2,}$/iu.test(domain)) {
				return "";
			}
			return domain;
		}

		function parseWhoisData(whoisData) {
			if (!whoisData) {
				return getEmptyWhoisResult();
			}
			const result = {
				found: whoisData.found,
				registrar: whoisData.registrar?.name || "",
				creation_date: whoisData.ts?.created || "",
				expiration_date: whoisData.ts?.expires || "",
				updated_date: whoisData.ts?.updated || "",
				domain_age_days: 0,
				name_servers: whoisData.nameservers || [],
				domain_status: whoisData.status || [],
				confidence: "LOW"
			};
			if (result.creation_date) {
				result.domain_age_days = calculateDomainAge(result.creation_date);
			}
			result.confidence = determineConfidence(result);
			return result;
		}
		function calculateDomainAge(creationDate) {
			if (!creationDate) {
				return 0;
			}
			try {
				const created = new Date(creationDate);
				const now = /* @__PURE__ */ new Date();
				const diffTime = Math.abs(now - created);
				return Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
			} catch (error) {
				logger.error({ error }, "[fullEnrichment] - Error in calculateDomainAge");
				return 0;
			}
		}
		function determineConfidence(result) {
			let score = 0;
			if (result.found) {
				score += 2;
			}
			if (result.registrar) {
				score += 2;
			}
			if (result.creation_date) {
				score += 2;
			}
			if (result.expiration_date) {
				score += 2;
			}
			if (result.updated_date) {
				score += 1;
			}
			if (result.name_servers && result.name_servers.length > 0) {
				score += 1;
			}
			if (result.domain_status && result.domain_status.length > 0) {
				score += 1;
			}
			if (score >= 7) {
				return "HIGH";
			}
			if (score >= 4) {
				return "MED";
			}
			return "LOW";
		}
		function getEmptyWhoisResult() {
			return {
				found: false,
				registrar: "",
				creation_date: "",
				expiration_date: "",
				updated_date: "",
				domain_age_days: 0,
				name_servers: [],
				domain_status: [],
				confidence: "LOW"
			};
		}
		function escapeCSV2(str) {
			if (typeof str !== "string") {
				return str;
			}
			if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
				return `"${str.replace(/"/gu, '""')}"`;
			}
			return str;
		}
		function parseUrlsFromHtml(htmlContent, baseUrl) {
			if (!htmlContent || typeof htmlContent !== "string") {
				return [];
			}
			try {
				const url = baseUrl.startsWith("http://") || baseUrl.startsWith("https://") ? baseUrl : `http://${baseUrl}`;
				const baseUrlObj = new URL(url);
				const urlPatterns = [
					// href attributes in anchor tags
					/href\s*=\s*["']([^"']+)["']/giu,
					// src attributes in images, scripts, etc.
					/src\s*=\s*["']([^"']+)["']/giu,
					// action attributes in forms
					/action\s*=\s*["']([^"']+)["']/giu,
					// Direct HTTP/HTTPS URLs in text
					/https?:\/\/[^\s<>"']+/giu
				];
				const contactUrls = new Set();
				const privacyUrls = new Set();
				const aboutUrls = new Set();
				const remaining = new Set();
				urlPatterns.forEach(pattern => {
					let match;
					while ((match = pattern.exec(htmlContent)) !== null) {
						const matchedUrl = match[1] || match[0];
						try {
							const absoluteUrlObj = new URL(matchedUrl, baseUrlObj);
							let cleanedUrl = `${absoluteUrlObj.protocol}//${absoluteUrlObj.host}${absoluteUrlObj.pathname}`;
							cleanedUrl =
								cleanedUrl.endsWith("/") && cleanedUrl !== `${absoluteUrlObj.protocol}//${absoluteUrlObj.host}/`
									? cleanedUrl.slice(0, -1)
									: cleanedUrl;
							if (isValidWebsiteUrl(cleanedUrl, baseUrlObj.hostname)) {
								if (absoluteUrlObj.pathname === "/") {
									continue; // Skip root url since that's already passed in and processed originally
								} else if (
									absoluteUrlObj.pathname === "/index.html" ||
									absoluteUrlObj.pathname.endsWith("/index.html")
								) {
									continue; // Skip index.html pages as they're usually just the homepage
								} else if (/\/(contact|contact-us|contact_us)/u.test(absoluteUrlObj.pathname)) {
									contactUrls.add(cleanedUrl);
								} else if (/\/(privacy|privacy-policy|privacy_policy)/u.test(absoluteUrlObj.pathname)) {
									privacyUrls.add(cleanedUrl);
								} else if (/\/(about|about-us|about_us)/u.test(absoluteUrlObj.pathname)) {
									aboutUrls.add(cleanedUrl);
								} else {
									remaining.add(cleanedUrl);
								}
							}
						} catch (e) {
							logger.error({ error: e }, "[fullEnrichment] - Error in parseURLsFromHtml");
						}
					}
				});
				// Prioritize contact us and privacy policy URLs.
				const urlArray = [
					...Array.from(contactUrls),
					...Array.from(privacyUrls),
					...Array.from(aboutUrls),
					...Array.from(remaining)
				];
				return urlArray.slice(0, 10);
			} catch (error) {
				logger.error({ error }, "[fullEnrichment] - Error parsing URLs from HTML");
				return [];
			}
		}
		function isValidWebsiteUrl(url, baseHostname) {
			try {
				const urlObj = new URL(url);
				if (!["http:", "https:"].includes(urlObj.protocol)) {
					return false;
				}
				const pathname = urlObj.pathname.toLowerCase();
				const hasFileExtension = pathname.includes(".") && !pathname.endsWith("/");
				if (hasFileExtension) {
					const htmlExtensions = [".htm", ".html", ".asp", ".aspx", ".php", ".cgi", ".jsp", ".do", ".action"];
					const hasHtmlExtension = htmlExtensions.some(ext => pathname.endsWith(ext));
					if (!hasHtmlExtension) {
						return false;
					}
				}
				const staticAssetPatterns = [
					"/static/",
					"/assets/",
					"/cdn/",
					"/cache/",
					"/dist/",
					"/build/",
					"/public/",
					"/resources/",
					"/media/",
					"/fonts/",
					"/font/",
					"/images/",
					"/img/",
					"/css/",
					"/js/",
					"/vendor/",
					"/node_modules/"
				];
				if (staticAssetPatterns.some(pattern => pathname.includes(pattern))) {
					return false;
				}
				if (urlObj.search) {
					const { searchParams } = urlObj;
					const staticParams = ["v=", "version=", "ver=", "_=", "t=", "timestamp=", "hash="];
					const hasStaticParams = staticParams.some(param =>
						Array.from(searchParams.keys()).some(key => key.startsWith(param.replace("=", "")))
					);
					if (
						hasStaticParams &&
						(pathname.includes("/static/") || pathname.includes("/assets/") || pathname.includes("/fonts/"))
					) {
						return false;
					}
				}
				if (url.length > 200) {
					return false;
				}
				if (urlObj.hash && !urlObj.search && urlObj.pathname === "/") {
					return false;
				}
				if (["mailto:", "tel:"].includes(urlObj.protocol)) {
					return false;
				}
				const apiPatterns = ["/api/", "/rest/", "/graphql/"];
				if (apiPatterns.some(pattern => pathname.includes(pattern))) {
					return false;
				}
				const wpPatterns = [
					"/wp-admin",
					"/wp-login.php",
					"/wp-register.php",
					"/wp-signup.php",
					"/wp-activate.php",
					"/wp-includes",
					"/wp-cron.php",
					"/wp-config.php",
					"/wp-content",
					"/wp-json",
					"/xmlrpc.php",
					"/feed",
					"/?feed=",
					"/license.txt",
					"/readme.html",
					"/blogs.dir",
					"/mu-plugins",
					"/wordpress1",
					"/admin/",
					"/backend/"
				];
				if (wpPatterns.some(pattern => pathname.includes(pattern))) {
					return false;
				}
				if (pathname === "/undefined") {
					return false;
				}
				const isSameDomain = urlObj.hostname === baseHostname || urlObj.hostname.endsWith(`.${baseHostname}`);
				return isSameDomain;
			} catch (e) {
				logger.error({ error: e }, "[fullEnrichment] - Error in parseUrlsFromHtml");
				return false;
			}
		}
		module2.exports = {
			splitAddress,
			getShortBusinessName: getShortBusinessName2,
			extractDomain,
			parseWhoisData,
			escapeCSV: escapeCSV2,
			parseUrlsFromHtml,
			isValidWebsiteUrl
		};
	}
});

// services/webAnalysisService.js
const _webAnalysisService = __commonJS({
	"services/webAnalysisService.js"(exports2, module2) {
		const WebAnalysisService2 = class {
			constructor(dependencies = {}) {
				this.fs = dependencies.fs;
				this.csv = dependencies.csv;
				this.path = dependencies.path;
				this.escapeCSV = dependencies.escapeCSV;
				this.fileUtil = dependencies.fileUtil;
				this.whois = dependencies.whois;
				this.naics = dependencies.naics;
				this.serpApiService = dependencies.serpApiService;
				this.getShortBusinessName = dependencies.getShortBusinessName;
				this.openAIService = dependencies.openAIService;
				this.webScrapingService = dependencies.webScrapingService;
			}
			/**
			 * Gets the list of adverse media keywords for searching
			 * @private
			 * @returns {string[]} Array of adverse media keywords
			 */
			getAdverseMediaKeywords() {
				return [
					// High Risk Terms
					"fraud",
					"lawsuit",
					"bankruptcy",
					"scandal",
					"investigation",
					"penalty",
					"violation",
					"criminal",
					"arrest",
					"conviction"
					// Add more keywords as needed
				];
			}
			/**
			 * Gets the list of government entity keywords for identification
			 * @private
			 * @returns {string[]} Array of government keywords
			 */
			getGovernmentKeywords() {
				return ["city of", "county", "state of", "town of", "township"];
			}
			/**
			 * Constructs the search query for adverse media
			 * @private
			 * @param {string|string[]} companyNames - Core company name(s)
			 * @param {string|string[]} [contactNames] - Optional contact name(s)
			 * @returns {string} Formatted search query
			 * @throws {Error} If companyNames is empty or null
			 */
			buildAdverseMediaQuery(companyNames, contactNames = []) {
				const companies = Array.isArray(companyNames) ? companyNames : [companyNames];
				if (!companies.length) {
					throw new Error("At least one company name is required");
				}
				const contacts = Array.isArray(contactNames) ? contactNames : [contactNames];
				const validContacts = contacts.filter(name => name);
				const companyQuery = companies.map(name => `"${name}"`).join(" | ");
				const entityQuery = validContacts.length
					? `(${companyQuery} | ${validContacts.map(name => `"${name}"`).join(" | ")})`
					: `(${companyQuery})`;
				const keywordsQuery = this.getAdverseMediaKeywords().join(" | ");
				return `${entityQuery} AND (${keywordsQuery})`;
			}
			/**
			 * Compiles adverse media data for a single company
			 * @private
			 * @param {Object} result - Company data record
			 * @returns {Promise<Object>} Analyzed adverse media results
			 */
			async compileAdverseMedia(result) {
				const coreName = this.getShortBusinessName(result.company_name);
				const individuals = result.contact_name ? [result.contact_name] : [];
				const searchString = this.buildAdverseMediaQuery([coreName, result.company_name], result.contact_name);
				const searchResults = await this.serpApiService.searchNews(searchString);
				const analyzeNewsResults = await this.analyzeNewsResults(searchResults, coreName, individuals);
				return analyzeNewsResults;
			}
			/** Compiles possible name and domain matches */
			async compileCompanyNames(result) {
				const extract = await this.openAIService.extractNameFromEmail(result.email);
				const companyNames = [];
				const searchPromises = [];
				if (extract.company_domain) {
					searchPromises.push(
						this.serpApiService
							.searchGoogle(`"${extract.company_domain}"`)
							.then(results => (results && results[0]) || null)
					);
				}
				if (result.email) {
					searchPromises.push(
						this.serpApiService.searchGoogle(`"${result.email}"`).then(results => (results && results[0]) || null)
					);
				}
				if (result.phone) {
					searchPromises.push(
						this.serpApiService.searchGoogle(`"${result.phone}"`).then(results => (results && results[0]) || null)
					);
				}
				const searchResults = (await Promise.all(searchPromises)).filter(Boolean);
				if (searchResults.length > 0) {
					const extractedInfo = await this.openAIService.extractNameFromSearchResult(searchResults[0]);
					if (extractedInfo.company_name) {
						companyNames.push({ name: extractedInfo.company_name, domain: extractedInfo?.company_domain });
					}
				}
				return companyNames;
			}
			/**
			 * Compile website URLs from company name
			 */
			async compileCompanyWebsites(result) {
				const companyWebsites = [];
				const searchPromises = [];
				const isGovernment = this.getGovernmentKeywords().some(keyword =>
					result.company_name.toLowerCase().includes(keyword)
				);
				const searchString = isGovernment
					? `${result.company_name} ${result.company_state}`
					: `${result.company_name} ${result.company_city} ${result.company_state}`;
				if (result.company_city && result.company_state) {
					searchPromises.push(
						this.serpApiService.searchGoogle(searchString).then(results => (results && results[0]) || null)
					);
				}
				if (result.company_name) {
					searchPromises.push(
						this.serpApiService
							.searchGoogle(`"${result.company_name}"`)
							.then(results => (results && results[0]) || null)
					);
				}
				const searchResults = (await Promise.all(searchPromises)).filter(Boolean);
				if (searchResults.length > 0) {
					const extractedInfo = await this.openAIService.extractNameFromSearchResult(searchResults[0]);
					if (extractedInfo.is_business_registry === false && extractedInfo.company_url) {
						companyWebsites.push({ name: extractedInfo.company_name, url: extractedInfo?.company_url });
					}
				}
				return companyWebsites;
			}
			/**
			 * Compile website URLs from company name
			 */
			async searchDirectors(result) {
				const companyDirectors = [];
				const searchPromises = [];
				if (result.company_city && result.company_state) {
					const isGovernment = this.getGovernmentKeywords().some(keyword =>
						result.company_name.toLowerCase().includes(keyword)
					);
					const searchTitle = isGovernment ? "head administrator of" : "ceo or head of";
					searchPromises.push(
						this.serpApiService
							.searchGoogle(`${searchTitle} ${result.company_name} ${result.company_city} ${result.company_state}`)
							.then(results => (results && results[0]) || null)
					);
				}
				const searchResults = (await Promise.all(searchPromises)).filter(Boolean);
				if (searchResults.length > 0) {
					const extractedInfo = await this.openAIService.parseDirectorNameFromSearchResult(searchResults[0]);
					if (extractedInfo.found === true && extractedInfo.first_name) {
						companyDirectors.push({
							first_name: extractedInfo.first_name.toUpperCase(),
							last_name: extractedInfo.last_name.toUpperCase(),
							title: extractedInfo.title.toUpperCase(),
							is_potential_owner: extractedInfo.is_potential_owner,
							confidence: extractedInfo.confidence
						});
					}
				}
				return companyDirectors;
			}
			/**
			 * Performs adverse media search and appends results to the dataset
			 * @param {string} inputFilePath - Path to input CSV file
			 * @param {string} outputFolder - Path to output folder
			 * @returns {Promise<string>} Path to the output file
			 */
			async appendAdverseMedia(inputFilePath, outputFolder) {
				logger.info("[fullEnrichment] - Selected file:", inputFilePath);
				const results = await this.fileUtil.readCSV(this.fs, this.csv, inputFilePath);
				logger.info("[fullEnrichment] - File read successfully");
				const outputFile = await this.fileUtil.outputFilePath(this.path, inputFilePath, outputFolder);
				const originalHeaders = Object.keys(results[0]);
				const newHeaders = [
					"adverse_media_found",
					"adverse_media_count",
					"adverse_media_high_risk_count",
					"adverse_media_average_risk_score",
					"adverse_media_highest_risk_title",
					"adverse_media_highest_risk_score",
					"adverse_media_highest_risk_description"
				];
				const headerRow = `${[...originalHeaders, ...newHeaders].join(",")}\n`;
				this.fs.writeFileSync(outputFile, headerRow);
				let count = 0;
				for (const result of results) {
					try {
						const adverseMedia = await this.compileAdverseMedia(result);
						const highestRiskArticle = adverseMedia.articles[0] || null;
						const csvData = [
							// Include all original columns
							...Object.keys(result).map(key => this.escapeCSV(result[key])),
							// Add new adverse media data
							adverseMedia.found,
							adverseMedia.count,
							adverseMedia.highRiskCount,
							adverseMedia.averageRiskScore,
							this.escapeCSV(highestRiskArticle?.title ?? ""),
							highestRiskArticle?.finalScore ?? 0,
							this.escapeCSV(highestRiskArticle?.riskDescription ?? "")
						].join(",");
						await new Promise((resolve, reject) => {
							this.fs.appendFile(outputFile, `${csvData}\n`, err => {
								if (err) {
									logger.info("[fullEnrichment] - Error writing adverse media data to CSV:", err);
									reject(err);
								}
								resolve();
							});
						});
						count++;
						logger.info(
							`[fullEnrichment] - ${count}: Adverse media search for`,
							result.company_name,
							` | (Found: ${adverseMedia.count} results, Avg Risk: ${adverseMedia.averageRiskScore})`
						);
					} catch (error) {
						logger.info("[fullEnrichment] - Error performing adverse media search:", error);
					}
				}
				logger.info("[fullEnrichment] - Number processed:", count);
				logger.info("[fullEnrichment] - Output file saved as:", outputFile);
				return outputFile;
			}
			/**
			 * Performs a reverse search for company name and domain
			 * @param {string} inputFilePath - Path to input CSV file
			 * @param {string} outputFolder - Path to output folder
			 * @returns {Promise<string>} Path to the output file
			 */
			async appendCompanyName(inputFilePath, outputFolder) {
				logger.info("[fullEnrichment] - Selected file:", inputFilePath);
				const results = await this.fileUtil.readCSV(this.fs, this.csv, inputFilePath);
				logger.info("[fullEnrichment] - File read successfully");
				const outputFile = await this.fileUtil.outputFilePath(this.path, inputFilePath, outputFolder);
				const originalHeaders = Object.keys(results[0]);
				const newHeaders = ["company_name", "website"];
				const headerRow = `${[...originalHeaders, ...newHeaders].join(",")}\n`;
				this.fs.writeFileSync(outputFile, headerRow);
				let count = 0;
				for (const result of results) {
					try {
						const searchResults = await this.compileCompanyNames(result);
						const highestRank = searchResults[0] || null;
						const csvData = [
							// Include all original columns
							...Object.keys(result).map(key => this.escapeCSV(result[key])),
							// Add new data
							this.escapeCSV(highestRank?.name ?? ""),
							highestRank?.domain ?? ""
						].join(",");
						await new Promise((resolve, reject) => {
							this.fs.appendFile(outputFile, `${csvData}\n`, err => {
								if (err) {
									logger.info("[fullEnrichment] - Error writing data to CSV:", err);
									reject(err);
								}
								resolve();
							});
						});
						count++;
						logger.info(
							`${count}: Reverse search: ${result.email}`,
							`${highestRank?.name ? `Found: ${highestRank.name} ${highestRank?.domain}` : ""}`
						);
					} catch (error) {
						logger.info("[fullEnrichment] - Error performing company search:", error);
					}
				}
				logger.info("[fullEnrichment] - Number processed:", count);
				logger.info("[fullEnrichment] - Output file saved as:", outputFile);
				return outputFile;
			}
			/**
			 * Performs a reverse search for company name and domain
			 * @param {string} inputFilePath - Path to input CSV file
			 * @param {string} outputFolder - Path to output folder
			 * @returns {Promise<string>} Path to the output file
			 */
			async appendWebsite(inputFilePath, outputFolder) {
				logger.info("[fullEnrichment] - Selected file:", inputFilePath);
				const results = await this.fileUtil.readCSV(this.fs, this.csv, inputFilePath);
				logger.info("[fullEnrichment] - File read successfully");
				const outputFile = await this.fileUtil.outputFilePath(this.path, inputFilePath, outputFolder);
				const originalHeaders = Object.keys(results[0]);
				const newHeaders = ["company_dba", "website"];
				const headerRow = `${[...originalHeaders, ...newHeaders].join(",")}\n`;
				this.fs.writeFileSync(outputFile, headerRow);
				let count = 0;
				for (const result of results) {
					try {
						const searchResults = await this.compileCompanyWebsites(result);
						const highestRank = searchResults[0] || null;
						const csvData = [
							// Include all original columns
							...Object.keys(result).map(key => this.escapeCSV(result[key])),
							// Add new data
							this.escapeCSV(highestRank?.name ?? ""),
							this.escapeCSV(
								highestRank?.url ?? result.website_url ?? result.website ?? result.append_online_website ?? ""
							)
						].join(",");
						await new Promise((resolve, reject) => {
							this.fs.appendFile(outputFile, `${csvData}\n`, err => {
								if (err) {
									logger.info("[fullEnrichment] - Error writing data to CSV:", err);
									reject(err);
								}
								resolve();
							});
						});
						count++;
						logger.info(
							`${count}: ${result.company_name} - `,
							`${highestRank?.name ? `Found: ${highestRank.name} ${highestRank?.url}` : "Not found"}`
						);
					} catch (error) {
						logger.info("[fullEnrichment] - Error performing company search:", error);
					}
				}
				logger.info("[fullEnrichment] - Number processed:", count);
				logger.info("[fullEnrichment] - Output file saved as:", outputFile);
				return outputFile;
			}
			/**
			 * Performs a reverse search for company officer/director
			 * @param {string} inputFilePath - Path to input CSV file
			 * @param {string} outputFolder - Path to output folder
			 * @returns {Promise<string>} Path to the output file
			 */
			async appendDirectors(inputFilePath, outputFolder) {
				logger.info("[fullEnrichment] - Selected file:", inputFilePath);
				const results = await this.fileUtil.readCSV(this.fs, this.csv, inputFilePath);
				logger.info("[fullEnrichment] - File read successfully");
				const outputFile = await this.fileUtil.outputFilePath(this.path, inputFilePath, outputFolder);
				const originalHeaders = Object.keys(results[0]);
				const newHeaders = ["enriched_officer_1_name", "enriched_officer_1_title"];
				const headerRow = `${[...originalHeaders, ...newHeaders].join(",")}\n`;
				this.fs.writeFileSync(outputFile, headerRow);
				let count = 0;
				const startTime = Date.now();
				const totalRecords = results.length;
				for (const result of results) {
					try {
						const searchResults = await this.searchDirectors(result);
						const highestRank = searchResults[0] || null;
						const csvData = [
							// Include all original columns
							...Object.keys(result).map(key => this.escapeCSV(result[key])),
							// Add new data
							this.escapeCSV(
								`${highestRank?.first_name ?? ""} ${highestRank?.last_name ?? ""}` ?? result.officer_1_name ?? ""
							),
							this.escapeCSV(highestRank?.title ?? result.officer_1_title ?? "")
						].join(",");
						await new Promise((resolve, reject) => {
							this.fs.appendFile(outputFile, `${csvData}\n`, err => {
								if (err) {
									logger.info("[fullEnrichment] - Error writing data to CSV:", err);
									reject(err);
								}
								resolve();
							});
						});
						count++;
						const elapsedTime = Date.now() - startTime;
						const avgTimePerRecord = elapsedTime / count;
						const remainingRecords = totalRecords - count;
						const estimatedSecondsRemaining = Math.round((avgTimePerRecord * remainingRecords) / 1e3);
						logger.info(
							`${count}/${totalRecords}: ${result.company_name} - `,
							`${
								highestRank?.first_name
									? `Found: ${highestRank.first_name} ${highestRank?.last_name ?? ""} ${highestRank?.title ?? ""}`
									: "Not found"
							}`,
							`(ETA: ${estimatedSecondsRemaining} seconds remaining)`
						);
					} catch (error) {
						logger.info("[fullEnrichment] - Error performing company search:", error);
					}
				}
				const totalTimeSeconds = Math.round((Date.now() - startTime) / 1e3);
				logger.info(`[fullEnrichment] - Number processed: ${count} (Total time: ${totalTimeSeconds} seconds)`);
				logger.info("[fullEnrichment] - Output file saved as:", outputFile);
				return outputFile;
			}
			/**
			 * Analyzes search results for adverse media
			 * @private
			 * @param {Object} searchResults - Results from SerpAPI news search
			 * @param {string} companyName - Name of the company being searched
			 * @param {string[]} individuals - Array of related individual names
			 * @returns {Object} Analyzed adverse media data with risk scores
			 */
			async analyzeNewsResults(searchResults, companyName, individuals = []) {
				const newsResults = searchResults?.news_results ?? [];
				const scoredResults = await Promise.all(
					newsResults.map(async result => {
						const riskScore = await this.openAIService.scoreAdverseMedia(result.title, [companyName], individuals);
						return {
							title: result.title || "",
							link: result.link || "",
							date: result.date || "",
							source: result.source.name || "",
							// Add risk assessment scores
							keywordsScore: riskScore?.keywordsScore ?? 0,
							negativeSentimentScore: riskScore?.negativeSentimentScore ?? 0,
							entityFocusScore: riskScore?.entityFocusScore ?? 0,
							finalScore: riskScore?.finalScore ?? 0,
							riskLevel: riskScore?.riskLevel ?? "LOW",
							riskDescription: riskScore?.description ?? ""
						};
					})
				);
				scoredResults.sort((a, b) => b.finalScore - a.finalScore);
				return {
					found: scoredResults.length > 0,
					count: scoredResults.length,
					// Add detailed results with scores
					articles: scoredResults,
					// Add summary statistics
					highRiskCount: scoredResults.filter(r => r.riskLevel === "HIGH").length,
					mediumRiskCount: scoredResults.filter(r => r.riskLevel === "MEDIUM").length,
					lowRiskCount: scoredResults.filter(r => r.riskLevel === "LOW").length,
					averageRiskScore:
						scoredResults.length > 0
							? (scoredResults.reduce((sum, r) => sum + r.finalScore, 0) / scoredResults.length).toFixed(2)
							: 0
				};
			}
			/**
			 * Compiles comprehensive SerpAPI data including industry prediction
			 * @private
			 * @param {Object} result - Company data record
			 * @returns {Promise<Object>} Enhanced data from SerpAPI with NAICS prediction
			 */
			async compileSerpData(result) {
				const city = result?.company_city ?? result?.owner_city ?? "";
				const state = result?.company_state ?? result?.owner_state ?? "";
				const postalCode = result?.company_postalcode ?? result?.owner_postalcode ?? "";
				const address = result?.company_address ?? "";
				const dba = result?.dba ?? "";
				const isGovernment = this.getGovernmentKeywords().some(keyword =>
					result.company_name.toLowerCase().includes(keyword)
				);
				const govModifier = isGovernment ? " government office" : "";
				const searchString = `${result.company_name}${govModifier} ${dba} ${address} ${city} ${state} ${postalCode}`;
				try {
					const details = await this.serpApiService.search(searchString);
					const serpAddress = this.splitAddress(details?.place_results?.address ?? "");
					const industryPrediction = await this.openAIService.predictNaicsCode(
						result.company_name,
						details?.place_results?.type_ids?.[0] ?? "",
						details?.place_results?.website_url,
						result?.primary_naics_code,
						result?.email,
						result?.company_dba
					);
					const naicsCodeInference = industryPrediction?.naics_code;
					const naicsService = this.naics;
					const industry = (await naicsService(naicsCodeInference))
						? await naicsService(naicsCodeInference)
						: await naicsService(result?.primary_naics_code);
					let naicsCode;
					if (await naicsService(naicsCodeInference)) {
						naicsCode = naicsCodeInference;
					} else if (result === null) {
						naicsCode = undefined;
					} else {
						naicsCode = result.primary_naics_code;
					}
					const confidence = industryPrediction === null ? undefined : industryPrediction.confidence;
					let status = "";
					if (details?.place_results?.open_state) {
						status = details.place_results.open_state === "Permanently closed" ? "Inactive" : "Active";
					}
					return {
						title: details?.place_results?.title ?? "",
						address: serpAddress.address || "",
						city: serpAddress.city || "",
						state: serpAddress.state || "",
						postal: serpAddress.postalCode || "",
						phone: details?.place_results?.phone ?? "",
						type: details?.place_results?.type_ids?.[0] ?? "",
						website: details?.place_results?.website || result?.website_url || result?.website || "",
						status,
						latitude: details?.place_results?.gps_coordinates?.latitude ?? "",
						longitude: details?.place_results?.gps_coordinates?.longitude ?? "",
						rating: details?.place_results?.rating ?? result?.average_rating ?? "0",
						reviews: details?.place_results?.reviews ?? result?.total_review_count ?? "0",
						naics: result?.primary_naics_code ?? naicsCode ?? "",
						industry: (industry ?? result?.primary_naics_description ?? "").toUpperCase(),
						industryConfidence: confidence || ""
					};
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error in compileSerpData");
					return {
						title: "",
						address: result?.company_address ?? "",
						city: result?.company_city ?? "",
						state: result?.company_state ?? "",
						postal: result?.company_postalcode ?? "",
						phone: result?.phone_number ?? "",
						type: "",
						website: result?.website_url ?? result?.website ?? "",
						status: "",
						latitude: "",
						longitude: "",
						rating: result?.average_rating ?? "0",
						reviews: result?.total_review_count ?? "0",
						naics: result?.primary_naics_code ?? "",
						industry: (result?.primary_naics_description ?? "").toUpperCase(),
						industryConfidence: ""
					};
				}
			}
			/**
			 * Utility method to split address - wrapper for the utility function
			 * @private
			 * @param {string} addressString - The full address string to split
			 * @returns {Object} Object containing address, city, state, and postalCode
			 */
			splitAddress(addressString) {
				const { splitAddress } = _stringFormat().exports;
				return splitAddress(addressString);
			}
			/**
			 * Performs SerpAPI search with industry prediction and appends results to the dataset
			 * @param {string} inputFilePath - Path to input CSV file
			 * @param {string} outputFolder - Path to output folder
			 * @returns {Promise<string>} Path to the output file
			 */
			async appendSerpData(inputFilePath, outputFolder) {
				logger.info("[fullEnrichment] - Selected file:", inputFilePath);
				const startTime = Date.now();
				const results = await this.fileUtil.readCSV(this.fs, this.csv, inputFilePath);
				logger.info("[fullEnrichment] - File read successfully");
				const totalRecords = results.length;
				const outputFile = await this.fileUtil.outputFilePath(this.path, inputFilePath, outputFolder);
				const originalHeaders = Object.keys(results[0]);
				const newHeaders = [
					"append_title",
					"append_address",
					"append_city",
					"append_state",
					"append_postal",
					"append_phone",
					"append_type",
					"append_website",
					"append_status",
					"append_latitude",
					"append_longitude",
					"append_rating",
					"append_reviews",
					"append_naics",
					"append_industry",
					"append_industry_confidence"
				];
				const headerRow = `${[...originalHeaders, ...newHeaders].join(",")}\n`;
				this.fs.writeFileSync(outputFile, headerRow);
				let count = 0;
				for (const result of results) {
					try {
						const serpData = await this.compileSerpData(result);
						const csvData = [
							// Include all original columns
							...Object.keys(result).map(key => this.escapeCSV(result[key])),
							// Add SerpAPI enrichment data
							this.escapeCSV(serpData.title),
							this.escapeCSV(serpData.address),
							this.escapeCSV(serpData.city),
							this.escapeCSV(serpData.state),
							this.escapeCSV(serpData.postal),
							this.escapeCSV(serpData.phone),
							this.escapeCSV(serpData.type),
							this.escapeCSV(serpData.website),
							this.escapeCSV(serpData.status),
							serpData.latitude,
							serpData.longitude,
							serpData.rating,
							serpData.reviews,
							serpData.naics,
							this.escapeCSV(serpData.industry),
							serpData.industryConfidence
						].join(",");
						await new Promise((resolve, reject) => {
							this.fs.appendFile(outputFile, `${csvData}\n`, err => {
								if (err) {
									logger.info("[fullEnrichment] - Error writing SerpAPI data to CSV:", err);
									reject(err);
								}
								resolve();
							});
						});
						count++;
						const elapsedTime = Date.now() - startTime;
						const avgTimePerRecord = elapsedTime / count;
						const remainingRecords = totalRecords - count;
						const estimatedSecondsRemaining = Math.round((avgTimePerRecord * remainingRecords) / 1e3);
						logger.info(
							`${count}/${totalRecords}: SerpAPI data for`,
							result.company_name || result.dba,
							`| Found: ${serpData.title || "No title"}`,
							`| Rating: ${serpData.rating}`,
							`| Reviews: ${serpData.reviews}`,
							`| ETA: ${estimatedSecondsRemaining}s`
						);
					} catch (error) {
						logger.info("[fullEnrichment] - Error performing SerpAPI search:", error);
					}
				}
				const totalTimeSeconds = Math.round((Date.now() - startTime) / 1e3);
				logger.info(
					`[fullEnrichment] - SerpAPI enrichment completed: ${count}/${totalRecords} records processed (Total time: ${totalTimeSeconds} seconds)`
				);
				logger.info("[fullEnrichment] - Output file saved as:", outputFile);
				return outputFile;
			}
			/**
			 * Compile and validate company address information using Google search
			 * @param {Object} result - Company data record
			 * @returns {Promise<Array>} Array of validated address information
			 */
			async compileCompanyAddress(result) {
				const companyAddresses = [];
				const searchPromises = [];
				const isGovernment = this.getGovernmentKeywords().some(keyword =>
					result.company_name.toLowerCase().includes(keyword)
				);
				if (result.company_name && result.company_city && result.company_state) {
					const searchQuery = isGovernment
						? `"${result.company_name}" full address ${result.company_state}`
						: `"${result.company_name}" full address ${result.company_city} ${result.company_state}`;
					searchPromises.push(
						this.serpApiService.searchGoogle(searchQuery).then(results => (results && results[0]) || null)
					);
				}
				const searchResults = (await Promise.all(searchPromises)).filter(Boolean);
				if (searchResults.length > 0) {
					const extractedInfo = await this.openAIService.extractAddress(searchResults[0]);
					if (extractedInfo.found && extractedInfo.company_name && extractedInfo.company_address) {
						companyAddresses.push({
							name: extractedInfo.company_name,
							address: extractedInfo.company_address,
							street_address: extractedInfo.street_address,
							city: extractedInfo.city,
							state: extractedInfo.state,
							zip_code: extractedInfo.zip_code,
							confidence: extractedInfo.confidence,
							validated: true,
							source: "google_search",
							source_url: extractedInfo.source_url
						});
					}
				}
				return companyAddresses;
			}
			/**
			 * Performs company address validation and appends results to the dataset
			 * @param {string} inputFilePath - Path to input CSV file
			 * @param {string} outputFolder - Path to output folder
			 * @returns {Promise<string>} Path to the output file
			 */
			async appendCompanyAddress(inputFilePath, outputFolder) {
				logger.info("[fullEnrichment] - Selected file:", inputFilePath);
				const startTime = Date.now();
				const results = await this.fileUtil.readCSV(this.fs, this.csv, inputFilePath);
				logger.info("[fullEnrichment] - File read successfully");
				const totalRecords = results.length;
				const outputFile = await this.fileUtil.outputFilePath(this.path, inputFilePath, outputFolder);
				const originalHeaders = Object.keys(results[0]);
				const newHeaders = ["validated_company_name", "validated_company_address", "address_validation_source"];
				const headerRow = `${[...originalHeaders, ...newHeaders].join(",")}\n`;
				this.fs.writeFileSync(outputFile, headerRow);
				let count = 0;
				for (const result of results) {
					try {
						const addressResults = await this.compileCompanyAddress(result);
						const topAddressResult = addressResults[0] || null;
						const csvData = [
							// Include all original columns
							...Object.keys(result).map(key => this.escapeCSV(result[key])),
							// Add address validation data
							this.escapeCSV(topAddressResult?.name ?? ""),
							this.escapeCSV(topAddressResult?.address ?? ""),
							this.escapeCSV(topAddressResult?.source ?? "")
						].join(",");
						await new Promise((resolve, reject) => {
							this.fs.appendFile(outputFile, `${csvData}\n`, err => {
								if (err) {
									logger.info("[fullEnrichment] - Error writing address validation data to CSV:", err);
									reject(err);
								}
								resolve();
							});
						});
						count++;
						const elapsedTime = Date.now() - startTime;
						const avgTimePerRecord = elapsedTime / count;
						const remainingRecords = totalRecords - count;
						const estimatedSecondsRemaining = Math.round((avgTimePerRecord * remainingRecords) / 1e3);
						logger.info(
							`${count}/${totalRecords}: Address validation for`,
							result.company_name,
							`| Found: ${topAddressResult?.name ?? "Not found"}`,
							`| ETA: ${estimatedSecondsRemaining}s`
						);
					} catch (error) {
						logger.info("[fullEnrichment] - Error performing address validation:", error);
					}
				}
				const totalTimeSeconds = Math.round((Date.now() - startTime) / 1e3);
				logger.info(
					`[fullEnrichment] - Address validation completed: ${count}/${totalRecords} records processed (Total time: ${totalTimeSeconds} seconds)`
				);
				logger.info("[fullEnrichment] - Output file saved as:", outputFile);
				return outputFile;
			}
			/**
			 * Compile and validate company phone number information using Google search
			 * @param {Object} result - Company data record
			 * @returns {Promise<Array>} Array of validated phone information
			 */
			async compilePhone(result) {
				const companyPhones = [];
				const searchPromises = [];
				const isGovernment = this.getGovernmentKeywords().some(keyword =>
					result.company_name.toLowerCase().includes(keyword)
				);
				if (result.company_name && result.company_city && result.company_state) {
					const searchQuery = isGovernment
						? `"${result.company_name}" phone number ${result.company_state}`
						: `"${result.company_name}" phone number ${result.company_city} ${result.company_state}`;
					searchPromises.push(
						this.serpApiService.searchGoogle(searchQuery).then(results => (results && results[0]) || null)
					);
				}
				const searchResults = (await Promise.all(searchPromises)).filter(Boolean);
				if (searchResults.length > 0) {
					const extractedInfo = await this.openAIService.extractPhone(searchResults[0]);
					if (extractedInfo.found && extractedInfo.company_name && extractedInfo.phone_number) {
						companyPhones.push({
							name: extractedInfo.company_name,
							phone_number: extractedInfo.phone_number,
							phone_type: extractedInfo.phone_type,
							confidence: extractedInfo.confidence,
							validated: true,
							source: "google_search",
							source_url: extractedInfo.source_url
						});
					}
				}
				return companyPhones;
			}
			/**
			 * Compile WHOIS domain registration data
			 * @param {Object} result - Company data record
			 * @returns {Promise<Array>} Array of WHOIS information
			 */
			async compileWhoisData(result) {
				const whoisResults = [];
				const potentialDomains = [
					// From existing website fields
					result.website_url,
					result.website,
					// From email domain extraction
					result.email ? result.email.split("@")[1] : null
				].filter(Boolean);
				const { extractDomain } = _stringFormat().exports;
				const cleanDomains = [...new Set(potentialDomains.map(extractDomain).filter(Boolean))];
				if (cleanDomains.length === 0) {
					return whoisResults;
				}
				logger.info(`[fullEnrichment] - \u{1F50D} Compiled domains for WHOIS lookup: ${cleanDomains.join(", ")}`);
				const primaryDomain = cleanDomains[0];
				logger.info(`[fullEnrichment] - \u{1F50D} Primary domain for WHOIS lookup: ${primaryDomain}`);
				try {
					const whoisService = this.whois;
					const whoisData = await whoisService(primaryDomain);
					if (whoisData && Object.keys(whoisData).length > 0) {
						logger.info(
							`[fullEnrichment] - \u{1F50D} raw WHOIS data for ${primaryDomain}: ${JSON.stringify(whoisData, null, 2)}`
						);
					}
					const { parseWhoisData } = _stringFormat().exports;
					const parsedWhois = parseWhoisData(whoisData, primaryDomain);
					whoisResults.push({
						domain: primaryDomain,
						found: parsedWhois.found || false,
						registrar: parsedWhois.registrar || "",
						creation_date: parsedWhois.creation_date || "",
						expiration_date: parsedWhois.expiration_date || "",
						updated_date: parsedWhois.updated_date || "",
						domain_age_days: parsedWhois.domain_age_days || 0,
						name_servers: parsedWhois.name_servers || [],
						domain_status: parsedWhois.domain_status || [],
						confidence: parsedWhois.confidence || 0,
						source: "whois_lookup"
					});
				} catch (error) {
					logger.info(`[fullEnrichment] - WHOIS lookup failed for ${primaryDomain}:`, error.message);
					whoisResults.push({
						domain: primaryDomain,
						found: false,
						registrar: "",
						creation_date: "",
						expiration_date: "",
						updated_date: "",
						domain_age_days: 0,
						name_servers: [],
						domain_status: [],
						confidence: 0,
						source: "whois_lookup_failed"
					});
				}
				return whoisResults;
			}
		};
		module2.exports = WebAnalysisService2;
	}
});

// services/webScrapingService.js
const _webScrapingService = __commonJS({
	"services/webScrapingService.js"(exports2, module2) {
		const tls = require("tls");
		tls.DEFAULT_CIPHERS = "DEFAULT:@SECLEVEL=0";
		// const originalCreateSecureContext = tls.createSecureContext;
		// tls.createSecureContext = function (options = {}) {
		//     const enhancedOptions = {
		//         ...options,
		//         // Only set ciphers if not already specified
		//         ciphers:
		//             options.ciphers ||
		//             "ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA",
		//         // Remove conflicting TLS version settings to maintain API compatibility
		//         // Let the system/API choose appropriate TLS versions
		//         honorCipherOrder: options.honorCipherOrder !== undefined ? options.honorCipherOrder : true,
		//         sessionIdContext: options.sessionIdContext || crypto.randomBytes(16).toString("hex")
		//     };
		//     return originalCreateSecureContext.call(this, enhancedOptions);
		// };
		const WebScrapingService2 = class {
			constructor(dependencies = {}) {
				this.playwright = dependencies.playwright;
				this.playwrightExtra = dependencies.playwrightExtra;
				this.stealthPlugin = dependencies.stealthPlugin;
				this.fs = dependencies.fs;
				this.path = dependencies.path;
				this.crypto = dependencies.crypto;
				this.escapeCSV = dependencies.escapeCSV;
				this.S3Client = dependencies.S3Client;
				this.PutObjectCommand = dependencies.PutObjectCommand;
				if (this.playwrightExtra && this.stealthPlugin) {
					this.playwrightExtra.use(this.stealthPlugin());
				}
			}
			/**
			 * Gets comprehensive and realistic browser headers for anti-detection
			 * Enhanced for better JA3 resistance and modern browser simulation
			 * @private
			 * @returns {Object} Realistic browser headers
			 */
			getRealisticHeaders() {
				const headers = {
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
					"Accept-Language": "en-US,en;q=0.9",
					"Accept-Encoding": "gzip, deflate, br, zstd",
					"Cache-Control": "max-age=0",
					"Sec-Ch-Ua": '"Chromium";v="121", "Google Chrome";v="121", "Not.A/Brand";v="99"',
					"Sec-Ch-Ua-Mobile": "?0",
					"Sec-Ch-Ua-Platform": '"macOS"',
					"Sec-Ch-Ua-Platform-Version": '"14.0.0"',
					"Sec-Ch-Ua-Arch": '"x86"',
					"Sec-Ch-Ua-Bitness": '"64"',
					"Sec-Ch-Ua-Model": '""',
					"Sec-Ch-Ua-Full-Version-List":
						'"Chromium";v="121.0.6167.85", "Google Chrome";v="121.0.6167.85", "Not.A/Brand";v="99.0.0.0"',
					"Sec-Fetch-Dest": "document",
					"Sec-Fetch-Mode": "navigate",
					"Sec-Fetch-Site": "none",
					"Sec-Fetch-User": "?1",
					"Upgrade-Insecure-Requests": "1",
					"User-Agent": this.getRandomUserAgent(),
					Dnt: "1",
					Connection: "keep-alive",
					"Accept-Charset": "utf-8, iso-8859-1;q=0.5",
					"X-Requested-With": undefined
					// Explicitly remove this automation indicator
				};
				return headers;
			}
			/**
			 * Gets randomized user agents for anti-detection
			 * Updated with current Chrome versions for better JA3 resistance
			 * @private
			 * @returns {string} Random user agent string
			 */
			getRandomUserAgent() {
				const userAgents = [
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0"
				];
				return userAgents[Math.floor(Math.random() * userAgents.length)];
			}
			/**
			 * Gets random viewport dimensions for anti-detection
			 * @private
			 * @returns {Object} Random viewport dimensions
			 */
			getRandomViewport() {
				const viewports = [
					{ width: 1920, height: 1080 },
					{ width: 1366, height: 768 },
					{ width: 1440, height: 900 },
					{ width: 1536, height: 864 },
					{ width: 1280, height: 720 }
				];
				return viewports[Math.floor(Math.random() * viewports.length)];
			}
			/**
			 * Creates a human-like delay between actions
			 * @private
			 * @param {number} min - Minimum delay in milliseconds
			 * @param {number} max - Maximum delay in milliseconds
			 * @returns {Promise} Promise that resolves after the delay
			 */
			humanDelay(min = 2 * 1000, max = 5 * 1000) {
				const delay = Math.floor(Math.random() * (max - min + 1)) + min;
				return new Promise(resolve => {
					setTimeout(resolve, delay);
				});
			}
			/**
			 * Generates a unique filename for screenshots and HTML content
			 * @private
			 * @param {Object} result - Company data record
			 * @param {string} type - Type of file (full, fold, html)
			 * @returns {string} Generated filename
			 */
			generateFilename(result, type) {
				const hash = this.crypto
					.createHash("md5")
					.update(result.website_url + Date.now())
					.digest("hex")
					.substring(0, 8);
				const timestamp = Date.now();
				let page = "page";
				try {
					let url = result.website_url;
					if (!url.startsWith("http://") && !url.startsWith("https://")) {
						url = `https://${url}`;
					}
					const urlObj = new URL(url);
					page = urlObj.pathname.replace(/\//gu, "-"); // Replace slashes with dashes to create a valid filename
					if (page === "-") {
						page = "homepage";
					}
					if (page.startsWith("-")) {
						page = page.substring(1);
					}
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error in WebScrapingService2");
					// Do nothing
				}
				const fileNamePrefix = `${result.businessId}/${hash}_${page}`;
				switch (type) {
					case "full":
						return `${fileNamePrefix}_full_${timestamp}.png`;
					case "fold":
						return `${fileNamePrefix}_fold_${timestamp}.png`;
					case "html":
						return `${fileNamePrefix}_html_${timestamp}.html`;
					default:
						return `${fileNamePrefix}_${type}_${timestamp}`;
				}
			}
			/**
			 * Compiles website screenshots and content for a single company using Playwright
			 * @param {Object} result - Company data record
			 * @returns {Promise<Object>} Screenshot and content results including rendered HTML and plain text
			 */
			async compileWebsiteScreenshots(result) {
				const screenshotResult = {
					homepage_full_path: "",
					homepage_fold_path: "",
					html_content_path: "",
					html_content: "",
					text_content: "",
					website_title_scraped: "",
					website_meta_description: "",
					success: false,
					error_message: "",
					timestamp: /* @__PURE__ */ new Date().toISOString()
				};
				const websiteUrl =
					result.website_url || result.website || result.merged_website || result.discovered_website || "";
				if (!websiteUrl) {
					screenshotResult.error_message = "No website URL available";
					return screenshotResult;
				}
				let fullUrl = websiteUrl;
				if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
					fullUrl = `https://${fullUrl}`;
				}
				try {
					const parsedUrl = new URL(fullUrl);
					parsedUrl.search = ""; // Setting the search property to an empty string removes all query parameters
					fullUrl = parsedUrl.toString();

					const pathname = parsedUrl.pathname.toLowerCase();
					const hasFileExtension = pathname.includes(".") && !pathname.endsWith("/");

					if (hasFileExtension) {
						const htmlExtensions = [".htm", ".html", ".asp", ".aspx", ".php", ".cgi", ".jsp", ".do", ".action"];
						const hasHtmlExtension = htmlExtensions.some(ext => pathname.endsWith(ext));
						if (!hasHtmlExtension) {
							const fileType = pathname.split(".").pop() || "unknown";
							logger.info(`[fullEnrichment] - ⚠️ Skipping non-HTML content: ${fullUrl} (file type: ${fileType})`);
							screenshotResult.error_message = `Skipped non-HTML content: ${fileType} file`;
							return screenshotResult;
						}
					}

					const suspiciousPatterns = ["/download/", "/files/", "/data/", "/api/", "/export/"];
					const isSuspicious = suspiciousPatterns.some(pattern => pathname.includes(pattern));

					// Make HEAD request for suspicious patterns or URLs without file extensions
					if (isSuspicious || !hasFileExtension) {
						const headResponse = await axios.head(fullUrl, {
							timeout: 2 * 1000, // 2 seconds
							validateStatus: () => true,
							maxRedirects: 1
						});
						const contentType = headResponse?.headers["content-type"]?.toLowerCase() || "";

						// Skip if content-type indicates non-HTML content
						if (
							contentType.includes("text/csv") ||
							contentType.includes("application/pdf") ||
							contentType.includes("application/json") ||
							contentType.includes("application/xml") ||
							contentType.includes("text/plain") ||
							contentType.includes("application/octet-stream") ||
							contentType.includes("image/") ||
							contentType.includes("video/") ||
							contentType.includes("audio/")
						) {
							logger.info(`[fullEnrichment] - ⚠️ Skipping non-HTML content: ${fullUrl} (content-type: ${contentType})`);
							screenshotResult.error_message = `Skipped non-HTML content: ${contentType}`;
							return screenshotResult;
						}
					}
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error in parseUrlsFromHtml");
				}
				let browser = null;
				let context = null;
				let page = null;
				try {
					const playwrightInstance = this.playwrightExtra || this.playwright.chromium;
					browser = await playwrightInstance.launch({
						headless: true,
						args: [
							"--no-sandbox",
							"--disable-setuid-sandbox",
							"--disable-dev-shm-usage",
							"--disable-accelerated-2d-canvas",
							"--no-first-run",
							"--no-zygote",
							"--disable-gpu",
							"--disable-web-security",
							"--disable-features=VizDisplayCompositor",
							"--disable-blink-features=AutomationControlled",
							"--disable-extensions",
							"--disable-plugins",
							"--disable-default-apps",
							"--disable-background-timer-throttling",
							"--disable-backgrounding-occluded-windows",
							"--disable-renderer-backgrounding",
							"--disable-field-trial-config",
							"--disable-back-forward-cache",
							"--disable-ipc-flooding-protection",
							"--enable-features=NetworkService,NetworkServiceInProcess",
							"--force-color-profile=srgb",
							"--metrics-recording-only",
							"--no-default-browser-check",
							"--no-pings",
							"--password-store=basic",
							"--use-mock-keychain",
							// Enhanced TLS and HTTP settings for better JA3 resistance
							"--enable-quic",
							"--enable-http2",
							"--disable-http2-server-push",
							"--ssl-version-fallback-min=tls1.2",
							"--ssl-version-min=tls1.2",
							"--tls13-variant=final",
							"--cipher-suite-blacklist=0x0004,0x0005,0x000A,0x002F,0x0035,0x003C,0x009C,0x009D",
							"--disable-features=VizDisplayCompositor,TranslateUI",
							"--disable-component-extensions-with-background-pages",
							"--disable-default-apps",
							"--disable-extensions-file-access-check",
							"--disable-extensions-http-throttling",
							"--disable-client-side-phishing-detection",
							"--disable-sync",
							"--disable-background-networking",
							"--disable-background-timer-throttling",
							"--disable-renderer-backgrounding",
							"--disable-backgrounding-occluded-windows",
							"--disable-hang-monitor",
							"--disable-prompt-on-repost",
							"--disable-domain-reliability",
							"--disable-features=TranslateUI,BlinkGenPropertyTrees",
							"--aggressive-cache-discard",
							"--enable-tcp-fast-open",
							"--max_old_space_size=4096"
						],
						ignoreDefaultArgs: [
							"--enable-automation",
							"--enable-blink-features=IdleDetection",
							"--disable-component-update"
						],
						ignoreHTTPSErrors: true,
						// Enhanced browser configuration for better stealth
						env: {
							// ...process.env,
							TZ: "America/New_York",
							LANG: "en_US.UTF-8",
							LC_ALL: "en_US.UTF-8"
						}
					});
					context = await browser.newContext({
						viewport: this.getRandomViewport(),
						userAgent: this.getRandomUserAgent(),
						extraHTTPHeaders: this.getRealisticHeaders(),
						locale: "en-US",
						timezoneId: "America/New_York",
						permissions: ["geolocation", "notifications"],
						colorScheme: "light",
						reducedMotion: "no-preference",
						forcedColors: "none",
						// Enhanced HTTP/TLS settings for better JA3 resistance
						httpCredentials: undefined,
						ignoreHTTPSErrors: true,
						acceptDownloads: false,
						// Add realistic browser features
						hasTouch: false,
						isMobile: false,
						javaScriptEnabled: true,
						offline: false,
						// Enhanced stealth settings
						deviceScaleFactor: 1,
						screen: { width: 1920, height: 1080 }
					});
					page = await context.newPage();

					await page.addInitScript(() => {
						Object.defineProperty("navigator", "webdriver", { get: () => undefined });
						Object.defineProperty("navigator", "plugins", {
							get: () => [
								{
									0: {
										type: "application/x-google-chrome-pdf",
										suffixes: "pdf",
										description: "Portable Document Format",
										enabledPlugin: "Plugin"
									},
									description: "Portable Document Format",
									filename: "internal-pdf-viewer",
									length: 1,
									name: "Chrome PDF Plugin"
								},
								{
									0: { type: "application/pdf", suffixes: "pdf", description: "", enabledPlugin: "Plugin" },
									description: "",
									filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
									length: 1,
									name: "Chrome PDF Viewer"
								}
							]
						});
						Object.defineProperty("navigator", "languages", { get: () => ["en-US", "en"] });
						const originalQuery = window.navigator.permissions.query;
						window.navigator.permissions.query = parameters =>
							parameters.name === "notifications"
								? Promise.resolve({ state: Notification.permission })
								: originalQuery(parameters);
						const { getContext } = HTMLCanvasElement.prototype;
						HTMLCanvasElement.prototype.getContext = function (type) {
							if (type === "2d") {
								const context2 = getContext.call(this, type);
								const originalFillText = context2.fillText;
								context2.fillText = function () {
									const args = Array.prototype.slice.call(arguments);
									if (args[1]) {
										args[1] += Math.random() * 1e-4;
									}
									if (args[2]) {
										args[2] += Math.random() * 1e-4;
									}
									return originalFillText.apply(this, args);
								};
								return context2;
							}
							return getContext.call(this, type);
						};
						const { getParameter } = WebGLRenderingContext.prototype;
						WebGLRenderingContext.prototype.getParameter = function (parameter) {
							if (parameter === 37445) {
								return "Intel Inc.";
							}
							if (parameter === 37446) {
								return "Intel Iris OpenGL Engine";
							}
							return getParameter.call(this, parameter);
						};
						delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
						delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
						delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
						Object.defineProperty(window.history, "length", { get: () => Math.floor(Math.random() * 50) + 1 });
						window.chrome = {
							runtime: {},
							loadTimes() {
								return {
									requestTime: Date.now() / 1e3 - Math.random() * 1e3,
									startLoadTime: Date.now() / 1e3 - Math.random() * 100,
									commitLoadTime: Date.now() / 1e3 - Math.random() * 10,
									finishDocumentLoadTime: Date.now() / 1e3 - Math.random(),
									finishLoadTime: Date.now() / 1e3,
									firstPaintTime: Date.now() / 1e3 - Math.random(),
									firstPaintAfterLoadTime: 0,
									navigationType: "Other",
									wasFetchedViaSpdy: true,
									// Enable HTTP/2 indication
									wasNpnNegotiated: true,
									npnNegotiatedProtocol: "h2",
									// HTTP/2 protocol
									wasAlternateProtocolAvailable: true,
									connectionInfo: "h2"
									// HTTP/2 connection
								};
							},
							csi() {
								return {};
							},
							// Add more realistic chrome APIs
							app: {
								isInstalled: false,
								InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" },
								RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" }
							},
							webstore: { onInstallStageChanged: {}, onDownloadProgress: {} }
						};
						Object.defineProperty("navigator", "connection", {
							get: () => ({
								effectiveType: "4g",
								rtt: 50 + Math.random() * 50,
								downlink: 10 + Math.random() * 5,
								saveData: false,
								type: "wifi"
							})
						});
						Object.defineProperty("navigator", "hardwareConcurrency", { get: () => 8 });
						Object.defineProperty("navigator", "deviceMemory", { get: () => 8 });
						if (window.performance && window.performance.timing) {
							const { timing } = window.performance;
							const now = Date.now();
							Object.defineProperty(timing, "connectStart", { get: () => now - Math.random() * 100 });
							Object.defineProperty(timing, "secureConnectionStart", { get: () => now - Math.random() * 50 });
						}
					});

					await this.humanDelay(2 * 1000, 5 * 1000);
					logger.info(`[fullEnrichment] - \u{1F310} Navigating to: ${fullUrl}`);

					let pageLoaded = false;
					const loadingStrategies = [
						{ name: "networkidle", waitUntil: "networkidle", timeout: 8 * 1000 },
						{ name: "domcontentloaded", waitUntil: "domcontentloaded", timeout: 6 * 1000 },
						{ name: "load", waitUntil: "load", timeout: 4 * 1000 },
						{ name: "commit", waitUntil: "commit", timeout: 2 * 1000 }
					];

					for (const strategy of loadingStrategies) {
						try {
							await page.goto(fullUrl, {
								waitUntil: strategy.waitUntil,
								timeout: strategy.timeout
							});
							pageLoaded = true;
							break;
						} catch (error) {
							logger.debug(`[fullEnrichment] - \u26A0\uFE0F ${strategy.name} failed: ${error.message}`);

							// If it's a navigation timeout, try to continue anyway
							if (error.message.includes("Navigation timeout") && strategy.name !== "commit") {
								continue;
							}
						}
					}

					if (!pageLoaded) {
						logger.info(
							`[fullEnrichment] - ⚠️ Failed to load page with any strategy: ${fullUrl}, skipping to next page`
						);
						screenshotResult.error_message = `Failed to load page with any strategy: ${fullUrl}`;
						return screenshotResult;
					}
					const viewport = this.getRandomViewport();
					await page.mouse.move(Math.random() * viewport.width, Math.random() * viewport.height);
					await this.humanDelay(3 * 1000, 7 * 1000);
					await page.evaluate(() => {
						window.scrollTo(0, 0);
					});
					await this.humanDelay(1 * 1000, 2 * 1000);
					try {
						await page.waitForSelector("body", { timeout: 15 * 1000 });
					} catch (e) {
						logger.info({ error: e }, "Body selector timeout, continuing...");
					}
					try {
						logger.info(`[fullEnrichment] - \u23F3 Waiting for content to load...`);
						await Promise.race([
							page.waitForSelector("main", { timeout: 10 * 1000 }).catch(() => null),
							page.waitForSelector("article", { timeout: 10 * 1000 }).catch(() => null),
							page.waitForSelector(".content", { timeout: 10 * 1000 }).catch(() => null),
							page.waitForSelector("#content", { timeout: 10 * 1000 }).catch(() => null),
							page.waitForSelector("h1", { timeout: 10 * 1000 }).catch(() => null),
							page.waitForSelector("p", { timeout: 10 * 1000 }).catch(() => null),
							// Fallback: just wait for any text content
							page
								.waitForFunction(() => document.body && document.body.innerText.length > 50, { timeout: 10 * 1000 })
								.catch(() => null)
						]);
						logger.info(`[fullEnrichment] - \u2705 Content appears to be loaded`);
					} catch (e) {
						logger.info(`[fullEnrichment] - \u26A0\uFE0F Content waiting timeout, proceeding anyway: ${e.message}`);
					}
					await this.humanDelay(2 * 1000, 4 * 1000);
					const pageData = await page.evaluate(() => {
						let _a, _b;
						try {
							return {
								title: document.title || "",
								metaDescription:
									((_a = document.querySelector('meta[name="description"]')) === null ? undefined : _a.content) ||
									((_b = document.querySelector('meta[property="og:description"]')) === null
										? undefined
										: _b.content) ||
									"",
								url: window.location.href,
								userAgent: navigator.userAgent,
								hasContent: document.body ? document.body.innerText.length > 100 : false,
								isBlocked: document.body
									? document.body.innerText.toLowerCase().includes("blocked") ||
										document.body.innerText.toLowerCase().includes("access denied") ||
										document.body.innerText.toLowerCase().includes("incapsula") ||
										document.body.innerText.toLowerCase().includes("cloudflare") ||
										document.body.innerHTML.includes("/_Incapsula_Resource")
									: false
							};
						} catch (e) {
							logger.error({ error: e }, "[fullEnrichment] - Error in compileWebsiteScreenshots");
							return { title: "", metaDescription: "", url: "", userAgent: "", hasContent: false, isBlocked: false };
						}
					});
					logger.info(
						`[fullEnrichment] - \u{1F4C4} Page loaded: ${pageData.title} | Content: ${pageData.hasContent ? "Yes" : "No"} | Blocked: ${pageData.isBlocked ? "Yes" : "No"}`
					);
					if (pageData.isBlocked) {
						screenshotResult.error_message = "Bot detection - page appears to be blocked";
						logger.info(`[fullEnrichment] - \u{1F6AB} Bot detection detected for ${fullUrl}`);
					}
					screenshotResult.website_title_scraped = pageData.title;
					screenshotResult.website_meta_description = pageData.metaDescription;
					const fullScreenshotFilename = this.generateFilename(result, "full");
					const foldScreenshotFilename = this.generateFilename(result, "fold");
					const htmlContentFilename = this.generateFilename(result, "html");
					try {
						let foldPageByteBuffer = await page.screenshot({
							// path: foldScreenshotPath,
							fullPage: false,
							type: "png"
						});
						const s3 = new this.S3Client({
							region: envConfig.AWS_REGION,
							credentials: {
								accessKeyId: envConfig.AWS_ACCESS_KEY_ID,
								secretAccessKey: envConfig.AWS_ACCESS_KEY_SECRET
							}
						});
						const uploadFoldPageParams = {
							Bucket: envConfig.AWS_WEBSITE_SCREENSHOT_BUCKET,
							Key: foldScreenshotFilename,
							Body: foldPageByteBuffer,
							ContentType: "image/png"
						};
						let command = new this.PutObjectCommand(uploadFoldPageParams);
						await s3.send(command);
						foldPageByteBuffer = null;

						await this.humanDelay(1 * 1000, 2 * 1000);
						// Cap full-page screenshot height to prevent massive PNG buffers (max 10,000px height)
						// Set a reasonable viewport height limit before taking full-page screenshot
						await page.setViewportSize({ width: 1920, height: 10000 });
						let fullPageByteBuffer = await page.screenshot({
							// path: fullScreenshotPath,
							fullPage: true,
							type: "png"
						});

						const uploadFullPageParams = {
							Bucket: envConfig.AWS_WEBSITE_SCREENSHOT_BUCKET,
							Key: fullScreenshotFilename,
							Body: fullPageByteBuffer,
							ContentType: "image/png"
						};
						command = new this.PutObjectCommand(uploadFullPageParams);
						await s3.send(command);
						fullPageByteBuffer = null;
					} catch (screenshotError) {
						logger.info(`[fullEnrichment] - Screenshot error for ${fullUrl}: ${screenshotError?.message}`);
					}
					let htmlContent = "";
					let textContent = "";
					let htmlContentPath = "";
					try {
						// Upload HTML content to S3
						htmlContent = await page.content();
						// Limit HTML content to 1MB
						if (htmlContent.length > 1024 * 1024) {
							htmlContent = htmlContent.substring(0, 1024 * 1024) + "... [truncated]";
						}

						const s3 = new this.S3Client({
							region: envConfig.AWS_REGION,
							credentials: {
								accessKeyId: envConfig.AWS_ACCESS_KEY_ID,
								secretAccessKey: envConfig.AWS_ACCESS_KEY_SECRET
							}
						});
						const uploadHtmlParams = {
							Bucket: envConfig.AWS_WEBSITE_SCREENSHOT_BUCKET,
							Key: htmlContentFilename,
							Body: htmlContent,
							ContentType: "text/html; charset=utf-8"
						};
						const htmlCommand = new this.PutObjectCommand(uploadHtmlParams);
						await s3.send(htmlCommand);
						htmlContentPath = `https://${envConfig.AWS_WEBSITE_SCREENSHOT_BUCKET}.s3.${envConfig.AWS_REGION}.amazonaws.com/${htmlContentFilename}`;

						textContent = await page.evaluate(() => {
							const bodyText = document.body ? document.body.innerText || document.body.textContent || "" : "";
							return bodyText
								.replace(/\s+/gu, " ")
								.replace(/\n\s*\n/gu, "\n")
								.trim();
						});
						// Limit text content to 100KB
						if (textContent.length > 100 * 1024) {
							textContent = textContent.substring(0, 100 * 1024) + "... [truncated]";
						}
						screenshotResult.html_content = htmlContent;
						screenshotResult.html_content_path = htmlContentPath;
						screenshotResult.text_content = textContent;
						if (
							htmlContent.length < 1e3 ||
							textContent.length < 100 ||
							htmlContent.includes("/_Incapsula_Resource") ||
							htmlContent.includes("blocked")
						) {
							if (!screenshotResult.error_message) {
								screenshotResult.error_message = "Possible bot detection - minimal or blocked content received";
							}
						}
					} catch (contentError) {
						logger.info(`[fullEnrichment] - Content extraction error for ${fullUrl}:`, contentError.message);
					}
					screenshotResult.homepage_full_path = `https://${envConfig.AWS_WEBSITE_SCREENSHOT_BUCKET}.s3.${envConfig.AWS_REGION}.amazonaws.com/${fullScreenshotFilename}`;
					screenshotResult.homepage_fold_path = `https://${envConfig.AWS_WEBSITE_SCREENSHOT_BUCKET}.s3.${envConfig.AWS_REGION}.amazonaws.com/${foldScreenshotFilename}`;
					// screenshotResult.html_content_path = this.path.resolve(htmlContentPath);
					screenshotResult.success = !pageData.isBlocked;
				} catch (error) {
					screenshotResult.error_message = error.message;
					logger.info(`[fullEnrichment] - \u274C Error scraping website ${fullUrl}:`);
					logger.info(screenshotResult.error_message);
					if (error.message.includes("net::ERR_BLOCKED_BY_CLIENT")) {
						screenshotResult.error_message = "Blocked by client-side protection";
					} else if (error.message.includes("net::ERR_ACCESS_DENIED")) {
						screenshotResult.error_message = "Access denied by server";
					} else if (error.message.includes("Navigation timeout")) {
						screenshotResult.error_message = "Page load timeout";
					} else if (error.message.includes("net::ERR_ABORTED")) {
						screenshotResult.error_message = "Request aborted - possible bot detection";
					}
				} finally {
					try {
						if (page) {
							await page.close();
						}
						if (context) {
							await context.close();
						}
						if (browser) {
							await browser.close();
						}
					} catch (cleanupError) {
						logger.info("[fullEnrichment] - Browser cleanup error:", cleanupError.message);
					}
				}
				return screenshotResult;
			}
			/**
			 * Compiles website screenshots from multiple URLs including HTML URL parsing
			 * @param {Object} result - Company data record
			 * @returns {Promise<Object>} Collection of screenshot results from main site and parsed URLs
			 */
			async compileMultipleWebsiteScreenshots(result, maxAdditionalScreenshotUrls) {
				logger.info(`[fullEnrichment] - \u{1F50D} Starting multi-URL screenshot collection...`);
				const mainScreenshots = await this.compileWebsiteScreenshots(result);
				const screenshotCollection = {
					main_website: mainScreenshots,
					additional_screenshots: [],
					total_screenshots: mainScreenshots?.success ? 1 : 0,
					urls_parsed: mainScreenshots?.success ? 1 : 0,
					success: mainScreenshots?.success || false
				};

				if (!mainScreenshots?.success || !mainScreenshots?.html_content) {
					logger.info(
						`[fullEnrichment] - \u26A0\uFE0F Main screenshot failed or no HTML content available for additional URL parsing`
					);
					return screenshotCollection;
				}
				const websiteUrl =
					result.website_url || result.website || result.merged_website || result.discovered_website || "";
				const { parseUrlsFromHtml } = _stringFormat().exports;
				const parsedUrls = parseUrlsFromHtml(mainScreenshots.html_content, websiteUrl);
				// Check if non-existing or invalid URLs were parsed
				const results = await Promise.allSettled(parsedUrls.map(url => this.isValidContentType(url, 3, 2500)));
				const cleanedUrls = parsedUrls
					.map((url, i) => ({ url, res: results[i] })) // pair each result with its URL
					.filter(({ res }) => res.status !== "rejected" && res.value === true) // keep only valid ones
					.map(({ url }) => {
						try {
							const parsedUrl = new URL(url);
							parsedUrl.search = ""; // strip query params
							return parsedUrl.toString();
						} catch (error) {
							logger.error(error, `[fullEnrichment] - Error in URL parsing for ${url}`);
							return null;
						}
					})
					.filter(url => {
						if (!url) return false; // remove nulls
						if (url === result.website_url) return false; // remove main URL
						return true;
					});
				screenshotCollection.urls_parsed += cleanedUrls.length;
				logger.info(`[fullEnrichment] - \u{1F4CB} Found ${cleanedUrls.length} URLs in HTML content`);
				if (cleanedUrls.length === 0) {
					logger.info(`[fullEnrichment] - \u{1F4DD} No additional URLs found for screenshot capture`);
					return screenshotCollection;
				}
				const urlsToCapture = cleanedUrls.slice(0, maxAdditionalScreenshotUrls);
				logger.info(
					`[fullEnrichment] - \u{1F4F8} Capturing screenshots sequentially for ${urlsToCapture.length} additional URLs (max: ${maxAdditionalScreenshotUrls}):`,
					urlsToCapture
				);
				logger.info(`[fullEnrichment] - \u23F3 Waiting before starting additional screenshots (anti-bot behavior)...`);
				await this.humanDelay(3 * 1000, 6 * 1000);
				for (let i = 0; i < urlsToCapture.length; i++) {
					const url = urlsToCapture[i];
					const index = i + 1;
					try {
						logger.info(`[fullEnrichment] - \u{1F310} Processing additional URL ${index}: ${url}`);
						const delayMs = Math.floor(Math.random() * 8 * 1000) + 2 * 1000;
						logger.info(
							`[fullEnrichment] - \u23F3 Waiting ${Math.round(delayMs / 1e3)}s before next screenshot (human-like behavior)...`
						);
						await this.humanDelay(delayMs, delayMs);
						const additionalResult = await this.compileWebsiteScreenshots({
							website_url: url,
							company_name: result.company_name || `additional_${index}`,
							businessId: result.businessId
						});
						screenshotCollection.additional_screenshots.push({ url, index, ...additionalResult });
						logger.info(
							`[fullEnrichment] - \u2705 Screenshot ${index}/${urlsToCapture.length} completed: ${additionalResult.success ? "Success" : "Failed"}`
						);
					} catch (error) {
						logger.info(`[fullEnrichment] - \u274C Error capturing screenshot for URL ${url}:`, error.message);
						screenshotCollection.additional_screenshots.push({
							url,
							index,
							success: false,
							error_message: error.message,
							homepage_full_path: "",
							homepage_fold_path: "",
							html_content_path: "",
							html_content: "",
							website_title_scraped: "",
							website_meta_description: "",
							timestamp: /* @__PURE__ */ new Date().toISOString()
						});
					}
				}
				screenshotCollection.total_screenshots += screenshotCollection.additional_screenshots.length;
				const successfulAdditional = screenshotCollection.additional_screenshots.filter(s => s.success).length;
				logger.info(
					`[fullEnrichment] - \u2705 Sequential multi-URL screenshot collection completed: 1 main + ${successfulAdditional}/${screenshotCollection.additional_screenshots.length} additional screenshots`
				);
				return screenshotCollection;
			}
			/**
			 * Test method to verify URL parsing functionality (can be removed in production)
			 * @param {string} htmlContent - Sample HTML content
			 * @param {string} baseUrl - Base URL for testing
			 * @returns {string[]} Parsed URLs for verification
			 */
			testUrlParsing(htmlContent, baseUrl) {
				logger.info(`[fullEnrichment] - \u{1F9EA} Testing URL parsing with base URL: ${baseUrl}`);
				const { parseUrlsFromHtml } = _stringFormat().exports;
				const urls = parseUrlsFromHtml(htmlContent, baseUrl);
				logger.info(`[fullEnrichment] - \u{1F50D} Found ${urls.length} URLs:`, urls);
				return urls;
			}
			/**
			 * Retry checking if valid content type.
			 * @param {string} url - URL to fetch
			 * @param {number} retries - Max number of retries
			 * @param {number} delay - Delay in ms between retries
			 * @returns {Promise<boolean>} True if URL is an HTML page
			 */
			async isValidContentType(url, retries = 3, delay = 1000, requestTimeout = 5000) {
				const invalidContentTypePatterns = [
					"text/csv",
					"application/pdf",
					"application/json",
					"application/xml",
					"text/plain",
					"application/octet-stream",
					"image/",
					"video/",
					"audio/"
				];
				try {
					// Try HEAD first
					const headResponse = await axios.head(url, {
						timeout: requestTimeout,
						validateStatus: () => true
					});
					const contentType = headResponse?.headers["content-type"]?.toLowerCase() || "";
					logger.info(`HEAD request for ${url} Status: ${headResponse.status} Content-Type: ${contentType}`);
					return !invalidContentTypePatterns.some(pattern => contentType.includes(pattern));
				} catch (err) {
					// If HEAD not allowed or fails, fall back to GET with stream
					logger.warn(`HEAD request failed for ${url} ${err.message}`);
					try {
						const res = await axios.get(url, {
							timeout: requestTimeout,
							responseType: "stream"
						});
						// Immediately stop the stream to avoid downloading the body.
						// We only need the response headers (Content-Type) here.
						res.data.destroy();
						const contentType = res?.headers["content-type"]?.toLowerCase() || "";
						return !invalidContentTypePatterns.some(pattern => contentType.includes(pattern));
					} catch (err2) {
						// Retry logic (network/HTTP errors only)
						if (retries > 0) {
							logger.error(`Retrying ${url}... attempts left: ${retries}, reason: ${err2.message}`);
							await new Promise(r => setTimeout(r, delay));
							return this.isValidContentType(url, retries - 1, delay, requestTimeout);
						}
						throw err2;
					}
				}
			}
		};
		module2.exports = WebScrapingService2;
	}
});

// services/openaiService.js
const _openaiService = __commonJS({
	"services/openaiService.js"(exports2, module2) {
		const { createOpenAIWithLogging } = require("../../src/utils/loggerAttach");
		const OpenAIService = class {
			constructor() {
				this._client = null;
			}
			get client() {
				if (!this._client) {
					this._client = createOpenAIWithLogging(
						{
							apiKey: envConfig.OPEN_AI_KEY
						},
						logger
					);
				}
				return this._client;
			}
			/**
			 * Gets NAICS code prediction from OpenAI
			 * @param {string} companyName - Company name
			 * @param {string} businessType - Business type identifier
			 * @param {string} website - Company website
			 * @returns {Promise<string|null>} NAICS code or null if invalid
			 */
			async predictNaicsCode(
				companyName = "",
				businessType = "",
				website = "",
				naics = "",
				email = "",
				companyDba = ""
			) {
				try {
					const prompt = `
      START DATA RESEARCH MODE

      COMMON NAICS CODES:
      236115 \u2013 New Single-Family Housing Construction (except For-Sale Builders)
      236118 \u2013 Residential Remodelers
      238160 \u2013 Roofing Contractors
      238210 \u2013 Electrical Contractors and Other Wiring Installation Contractors
      238220 \u2013 Plumbing, Heating, and Air-Conditioning Contractors
      238990 \u2013 All Other Specialty Trade Contractors
      323113 \u2013 Commercial Screen Printing
      488510 \u2013 Freight Transportation Arrangement
      493110 \u2013 General Warehousing and Storage
      531130 \u2013 Lessors of Miniwarehouses and Self-Storage Units
      531210 \u2013 Offices of Real Estate Agents and Brokers
      541110 \u2013 Offices of Lawyers
      541310 \u2013 Architectural Services
      541410 \u2013 Interior Design Services
      541921 \u2013 Photography Studios, Portrait
      541990 \u2013 All Other Professional, Scientific, and Technical Services
      561499 \u2013 All Other Business Support Services
      561710 \u2013 Exterminating and Pest Control Services
      561990 \u2013 All Other Support Services
      611110 \u2013 Elementary and Secondary Schools
      611310 \u2013 Colleges, Universities, and Professional Schools
      621111 \u2013 Offices of Physicians (except Mental Health Specialists)
      624410 \u2013 Child Care Services
      711390 \u2013 All Other Amusement and Recreation Industries
      722320 \u2013 Caterers
      722410 \u2013 Drinking Places (Alcoholic Beverages)
      722511 \u2013 Full-Service Restaurants
      722513 \u2013 Limited-Service Restaurants
      713940 \u2013 Fitness and Recreational Sports Centers
      713990 \u2013 All Other Amusement and Recreation Industries
      811111 \u2013 General Automotive Repair
      812112 \u2013 Beauty Salons
      813110 \u2013 Religious Organizations

      Business Details: ${companyName} ${companyDba} ${email} ${businessType} ${website} ${naics}
      
      Determine the business industry type based on the business details.
      Common NAICS codes are above as a guide however select the most appropriate code even if it is not listed.
      Respond only with the 6 digit NAICS 2022 edition code.
      If the company already has a NAICS code, please correct it if it does not match the business details.
      Return confidence level of the prediction as HIGH, MED, or LOW based on notes.
      In the absence of any evidence, return 561499 as a last resort.

      Return JSON in this format:
      {
        reasoning: "enter notes about evidence as to the business industry type"
        naics_code: "123456",
        confidence: "HIGH"
      }`;
					const chatCompletion = await this.client.chat.completions.create({
						messages: [{ role: "user", content: prompt }],
						model: OPENAI_MODEL_VERSION,
						temperature: 0.1,
						response_format: { type: "json_object" }
					});
					const response = chatCompletion.choices[0].message.content;
					if (response.includes("```json")) {
						const jsonStart = response.indexOf("```json") + 7;
						const jsonEnd = response.indexOf("```", jsonStart);
						const json = response.substring(jsonStart, jsonEnd);
						return JSON.parse(json);
					}
					return JSON.parse(response);
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error predicting NAICS code");
					return null;
				}
			}
			/**
			 * Determines confidence level for NAICS code prediction
			 * @param {string} businessDetails - Combined business details
			 * @param {string} naicsCode - Predicted NAICS code
			 * @returns {Promise<number>} Confidence score between 0 and 1
			 */
			async determineIndustryConfidence(businessDetails, naicsCode) {
				if (!naicsCode || naicsCode.trim() === "") {
					return "";
				}
				try {
					const prompt = `Given the following business details and predicted NAICS code, respond with confidence in the prediction.

Business Details: ${businessDetails}
Predicted NAICS Code: ${naicsCode}

Only respond with the HIGH, MED, or LOW (e.g., HIGH).

HIGH = NAICS code could be correct, NOTE: most codes will be correct
MED = NAICS code might be incorrect
LOW = NAICS code definitely not correct`;
					const chatCompletion = await this.client.chat.completions.create({
						messages: [{ role: "user", content: prompt }],
						model: OPENAI_MODEL_VERSION,
						temperature: 0.1
					});
					const confidence = chatCompletion.choices[0].message.content;
					return confidence;
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error determining industry confidence");
					return 0;
				}
			}
			/**
			 * Scores adverse media titles for risk assessment
			 * @param {string} title - The adverse media title to analyze
			 * @param {string[]} entityNames - Array of business entity names
			 * @param {string[]} individuals - Array of related individual names
			 * @returns {Promise<Object>} Risk assessment scores and details
			 */
			async scoreAdverseMedia(title, entityNames = [], individuals = []) {
				try {
					const prompt = `Analyze this adverse media title for risk: "${title}"
Business entity names: ${JSON.stringify(entityNames)}
Individual names: ${JSON.stringify(individuals)}

Score the title (1-10) for:
1. Keywords (HIGH 8-10: fraud/arrested/convicted/corruption/lawsuit/investigation/bankruptcy/violation, MED 5-7: audit/review/criticism, LOW 1-4: no related keywords)
2. Negative sentiment (tone and urgency)
3. Entity focus (direct mention of business entity/industry vs potentially unrelated common names)

Return JSON matching this example format:
{
  "keywordsScore": 9,
  "negativeSentimentScore": 8,
  "entityFocusScore": 10,
  "finalScore": 9,
  "riskLevel": "HIGH",
  "description": "Significant adverse risk. Direct mention of fraud involving entity."
}`;
					const chatCompletion = await this.client.chat.completions.create({
						messages: [{ role: "user", content: prompt }],
						model: OPENAI_MODEL_VERSION,
						temperature: 0.1,
						response_format: { type: "json_object" }
					});
					return JSON.parse(chatCompletion.choices[0].message.content);
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error scoring adverse media");
					return null;
				}
			}
			/**
			 * Extract name from email
			 * @param {string} email - The email to extract the name from
			 * @returns {Promise<string>} The name extracted from the email
			 */
			async extractNameFromEmail(email) {
				try {
					const prompt = `You are a data researcher. 

We are attempting to extract information from this email.
${email}

For example johndoe@gmail.com = "john doe" and tyconstructionrc@gmail.com = "ty construction".  
If it looks like the email is a company email, then extrapolate the domain name, but if it is a free email provider then do ignore it. 
Do your best to separate the components in the email. 
If the email suggests a personal name, separate it into distinct components.
Do not add unnecessary spaces for example in a possessive name Sam's (sams) or between acronyms RGS (rgs)

JSON Format:
{
email_split_name: "",
company_domain: "",
}`;
					const chatCompletion = await this.client.chat.completions.create({
						messages: [{ role: "user", content: prompt }],
						model: OPENAI_MODEL_VERSION,
						temperature: 0.1,
						response_format: { type: "json_object" }
					});
					const response = chatCompletion.choices[0].message.content;
					if (response.includes("```json")) {
						const jsonStart = response.indexOf("```json") + 7;
						const jsonEnd = response.indexOf("```", jsonStart);
						const json = response.substring(jsonStart, jsonEnd);
						return JSON.parse(json);
					}
					return JSON.parse(response);
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error extracting name from email");
					return null;
				}
			}
			/**
			 * Extract name from search result
			 * @param {string} searchResult - The search result to extract the name from
			 * @returns {Promise<string>} The name extracted from the search result
			 */
			async extractNameFromSearchResult(searchResult) {
				try {
					const JSONstring = JSON.stringify(searchResult);
					const prompt = `START DATA RESEARCH MODE
  
      We are attempting to extract information from this search result.
      ${JSONstring}
      
      Free background, public records check website set is_background_check to true i.e. peekyou, instant checkmate, white pages, simple contacts.
      Inventory pages related to a sku code like a book result or inventory item set is_inventory_listing to true.
      Government or secretary of state website and business search profile aggregators (bbb, sba, business directory, npi, mapquest, edgar, bankruptcy, liens) set is_business_registry to true.
      Business social media (not personal), or business owned website, then set is_business_website to true.
      Business review sites like yelp (profile not search), google places, facebook, tripadvisor then set is_business_review_site to true.
      Extrapolate full company_name when is_business_review_site or is_business_website is true.
      Extrapolate the company domain only when is_business_website is true. 
      
      JSON Format:
      {
      is_inventory_listing: false,
      is_background_check: false,
      is_business_registry: false,
      is_business_website: true,
      is_business_review_site: false,
      company_name: "",
      company_domain: "",
      }`;
					const chatCompletion = await this.client.chat.completions.create({
						messages: [{ role: "user", content: prompt }],
						model: OPENAI_MODEL_VERSION,
						temperature: 0.1,
						response_format: { type: "json_object" }
					});
					const response = chatCompletion.choices[0].message.content;
					let jsonPayload = {};
					if (response.includes("```json")) {
						const jsonStart = response.indexOf("```json") + 7;
						const jsonEnd = response.indexOf("```", jsonStart);
						const json = response.substring(jsonStart, jsonEnd);
						jsonPayload = JSON.parse(json);
					} else {
						jsonPayload = JSON.parse(response);
					}
					jsonPayload.company_url = searchResult.link;
					return jsonPayload;
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error extracting name from email");
					return null;
				}
			}
			/**
			 * Extract director name from search result
			 * @param {string} searchResult - The search result to extract the name from
			 * @returns {Promise<string>} The name extracted from the search result
			 */
			async parseDirectorNameFromSearchResult(searchResult) {
				try {
					const JSONstring = JSON.stringify(searchResult);
					const prompt = `START DATA RESEARCH MODE
    
        We are attempting to extract information from this search result.
        Set found to true if a person name is detected.
        Confidence level that the name is a current legitimate organizational contact is HIGH, MED, or LOW.
        ${JSONstring}
        
        JSON Format:
        {
        found: true,
        is_potential_owner: false,
        title: "",
        first_name: "",
        last_name: "",
        confidence: "HIGH",
        }`;
					const chatCompletion = await this.client.chat.completions.create({
						messages: [{ role: "user", content: prompt }],
						model: OPENAI_MODEL_VERSION,
						temperature: 0.1,
						response_format: { type: "json_object" }
					});
					const response = chatCompletion.choices[0].message.content;
					let jsonPayload = {};
					if (response.includes("```json")) {
						const jsonStart = response.indexOf("```json") + 7;
						const jsonEnd = response.indexOf("```", jsonStart);
						const json = response.substring(jsonStart, jsonEnd);
						jsonPayload = JSON.parse(json);
					} else {
						jsonPayload = JSON.parse(response);
					}
					return jsonPayload;
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error extracting name from email");
					return null;
				}
			}
			/**
			 * Extract address information from search result
			 * @param {Object} searchResult - The search result to extract address from
			 * @returns {Promise<Object>} The address information extracted from the search result
			 */
			async extractAddress(searchResult) {
				try {
					const JSONstring = JSON.stringify(searchResult);
					const prompt = `START DATA RESEARCH MODE

We are attempting to extract company name and address information from this search result.
${JSONstring}

Extract the company name and full address if available. Focus on:
- Complete company name (including legal suffixes like LLC, Inc, etc.)
- Full street address with number and street name
- City, State, ZIP code if available
- Ignore personal addresses or residential listings
- Only extract if it appears to be a legitimate business address

Set found to true if both company name and address are detected.
Set confidence to HIGH if address is complete with street/city/state, MED if partially complete, LOW if questionable.

JSON Format:
{
  "found": true,
  "company_name": "",
  "company_address": "",
  "street_address": "",
  "city": "",
  "state": "",
  "zip_code": "",
  "confidence": "HIGH"
}`;
					const chatCompletion = await this.client.chat.completions.create({
						messages: [{ role: "user", content: prompt }],
						model: OPENAI_MODEL_VERSION,
						temperature: 0.1,
						response_format: { type: "json_object" }
					});
					const response = chatCompletion.choices[0].message.content;
					let jsonPayload = {};
					if (response.includes("```json")) {
						const jsonStart = response.indexOf("```json") + 7;
						const jsonEnd = response.indexOf("```", jsonStart);
						const json = response.substring(jsonStart, jsonEnd);
						jsonPayload = JSON.parse(json);
					} else {
						jsonPayload = JSON.parse(response);
					}
					jsonPayload.source_url = searchResult.link;
					return jsonPayload;
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error extracting address from search result");
					return {
						found: false,
						company_name: "",
						company_address: "",
						street_address: "",
						city: "",
						state: "",
						zip_code: "",
						confidence: "LOW",
						source_url: ""
					};
				}
			}
			/**
			 * Extract phone number information from search result
			 * @param {Object} searchResult - The search result to extract phone from
			 * @returns {Promise<Object>} The phone information extracted from the search result
			 */
			async extractPhone(searchResult) {
				try {
					const JSONstring = JSON.stringify(searchResult);
					const prompt = `START DATA RESEARCH MODE

We are attempting to extract company name and phone number information from this search result.
${JSONstring}

Extract the company name and phone number if available. Focus on:
- Complete company name (including legal suffixes like LLC, Inc, etc.)
- Format phone numbers consistently (e.g., (555) 123-4567)
- Only extract if it appears to be a legitimate complete phone number

Set found to true if both company name and phone number are detected.
Set confidence to HIGH if phone is clearly a business line, MED if uncertain, LOW if questionable.

JSON Format:
{
  "found": true,
  "company_name": "",
  "phone_number": "",
  "phone_type": "",
  "confidence": "HIGH"
}`;
					const chatCompletion = await this.client.chat.completions.create({
						messages: [{ role: "user", content: prompt }],
						model: OPENAI_MODEL_VERSION,
						temperature: 0.1,
						response_format: { type: "json_object" }
					});
					const response = chatCompletion.choices[0].message.content;
					let jsonPayload = {};
					if (response.includes("```json")) {
						const jsonStart = response.indexOf("```json") + 7;
						const jsonEnd = response.indexOf("```", jsonStart);
						const json = response.substring(jsonStart, jsonEnd);
						jsonPayload = JSON.parse(json);
					} else {
						jsonPayload = JSON.parse(response);
					}
					jsonPayload.source_url = searchResult.link;
					return jsonPayload;
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error extracting phone from search result");
					return {
						found: false,
						company_name: "",
						phone_number: "",
						phone_type: "",
						confidence: "LOW",
						source_url: ""
					};
				}
			}
		};
		module2.exports = new OpenAIService();
	}
});

// services/serpApiService.js
const _serpApiService = __commonJS({
	"services/serpApiService.js"(exports2, module2) {
		// Custom HTTPS agent for secure requests
		const customAgent = new https.Agent({
			ciphers:
				"ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA",
			honorCipherOrder: true
			// Add other custom TLS options as needed
		});
		const SerpAPIService = class {
			constructor() {
				this.apiKey = envConfig.SERP_API_KEY;
			}
			/**
			 * Searches for Google Maps data using SerpAPI.
			 * @param {string} searchString - The search string.
			 * @returns {Promise<Object|null>} A promise that resolves with the place details if results are found, or null if no results are found.
			 */
			async search(searchString) {
				try {
					const url = `https://serpapi.com/search?api_key=${this.apiKey}&engine=google_maps&type=search&google_domain=google.com&q=${encodeURIComponent(
						searchString
					)}&hl=en&ll=@40.7455096,-74.0083012,14z`;
					const response = await axios.get(url, {
						httpsAgent: customAgent,
						timeout: envConfig.SYNCHRONOUS_API_TIMEOUT_SECONDS * 1000
					});
					const data = response.data;
					if (data === null ? undefined : data.place_results) {
						return { place_results: data.place_results };
					} else if (
						(data === null ? undefined : data.local_results) &&
						data.local_results.length > 0 && // check if fuzzy matches returned
						data.local_results[0].type_id && // type_id is required
						data.local_results[0].type_id !== "compound_building" && // compound_building is a building with multiple businesses
						data.local_results[0].title &&
						this.normalizeTitle(data.local_results[0].title)[0] === this.normalizeTitle(searchString)[0]
					) {
						return { place_results: data.local_results[0] };
					}
					if ((data === null ? undefined : data.local_results) && data.local_results.length > 0) {
						logger.error(`[fullEnrichment] - Fuzzy match failed: ${JSON.stringify(data.local_results[0])}`);
					}
					return null;
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error in SerpAPI search");
					return null;
				}
			}
			/**
			 * Searches for news articles using SerpAPI's Google News engine
			 * @param {string} searchQuery - The search query string
			 * @returns {Promise<Object|null>} A promise that resolves with news results if found, or null if error
			 */
			async searchNews(searchQuery) {
				try {
					const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(searchQuery)}&gl=us&hl=en&api_key=${this.apiKey}`;
					const response = await axios.get(url, {
						httpsAgent: customAgent,
						timeout: envConfig.SYNCHRONOUS_API_TIMEOUT_SECONDS * 1000
					});
					const data = response.data;
					if (data === null ? undefined : data.news_results) {
						const processedResults = data.news_results.map(article => ({
							...article,
							// Parse date string and convert to Date object
							// Input format example: "09/04/2024, 07:00 AM, +0000 UTC"
							date: new Date(article.date.split(", +0000 UTC")[0])
						}));
						return { news_results: processedResults, search_metadata: data.search_metadata };
					}
					return null;
				} catch (error) {
					logger.error({ error }, "[fullEnrichment] - Error in SerpAPI news search");
					return null;
				}
			}
			/**
			 * Searches google search engine
			 * @param {string} searchQuery - The search query string
			 * @returns {Promise<Object|null>} A promise that resolves with search results if found, or null if error
			 */
			async searchGoogle(searchQuery) {
				const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}+%2Dfiletype%3Apdf+%2Dfiletype%3Adoc&gl=us&hl=en&api_key=${this.apiKey}`;
				const response = await axios.get(url, {
					httpsAgent: customAgent,
					timeout: envConfig.SYNCHRONOUS_API_TIMEOUT_SECONDS * 1000
				});
				const data = response.data;
				const organicResults = data.organic_results;
				return organicResults;
			}
			/**
			 * Normalizes a title by removing leading "The " if present
			 * @param {string} title - The title to normalize
			 * @returns {string} The normalized title
			 */
			normalizeTitle(title) {
				return title.replace(/^the\s+/iu, "");
			}
		};
		module2.exports = new SerpAPIService();
	}
});

// utils/fileUtil.js
const _fileUtil = __commonJS({
	"utils/fileUtil.js"(exports2, module2) {
		function outputFilePath2(pathLibrary, sourceFilePath, outputPath) {
			const timestamp = /* @__PURE__ */ new Date().toISOString().replace(/[:.]/gu, "-");
			const inputFileName = pathLibrary.basename(sourceFilePath, pathLibrary.extname(sourceFilePath));
			const extension = pathLibrary.extname(sourceFilePath);
			const outputFileName = `${inputFileName}_${timestamp}${extension}`;
			const outputFullPath = pathLibrary.join(outputPath, outputFileName);
			return outputFullPath;
		}
		function readCSV2(fs, csvParser, filePath) {
			return new Promise((resolve, reject) => {
				const results = [];
				fs.createReadStream(filePath)
					.pipe(csvParser())
					.on("data", data => results.push(data))
					.on("end", () => {
						resolve(results);
					})
					.on("error", error => {
						reject(error);
					});
			});
		}
		module2.exports = { outputFilePath: outputFilePath2, readCSV: readCSV2 };
	}
});

// examples/fullEnrichment/index.js
const WebAnalysisService = _webAnalysisService();
const WebScrapingService = _webScrapingService();
const openAIService = _openaiService();
const serpApiService = _serpApiService();
const { outputFilePath, readCSV } = _fileUtil();
const { getShortBusinessName, escapeCSV } = _stringFormat();
async function simplifiedFullEnrichment(dependencies, businessData, maxAdditionalScreenshotUrls = 8) {
	const {
		fs,
		csv,
		path,
		crypto,
		playwright,
		playwrightExtra,
		stealthPlugin,
		whois,
		naics,
		S3Client,
		PutObjectCommand
	} = dependencies;
	logger.info("[fullEnrichment] - \u{1F680} Starting simplified full enrichment...");
	const startTime = Date.now();
	logger.info(`[fullEnrichment] - \u{1F4CA} Processing business: ${businessData.company_name}`);
	const webScrapingService = new WebScrapingService({
		playwright,
		playwrightExtra,
		stealthPlugin,
		fs,
		path,
		crypto,
		escapeCSV,
		S3Client,
		PutObjectCommand
	});
	const webAnalysisService = new WebAnalysisService({
		fs,
		csv,
		path,
		escapeCSV,
		fileUtil: { readCSV, outputFilePath },
		whois,
		naics,
		serpApiService,
		getShortBusinessName,
		openAIService,
		webScrapingService
	});
	try {
		logger.info("[fullEnrichment] - \u26A1 Executing enrichment steps in parallel...");
		const [serpData, websiteResults] = await Promise.all([
			webAnalysisService.compileSerpData(businessData),
			// Step 1: SerpAPI data
			webAnalysisService.compileCompanyWebsites(businessData)
			// Step 2: Website discovery
		]);
		const topWebsiteResult = websiteResults?.[0] ?? null;
		logger.info("[fullEnrichment] - \u{1F50D} Compiling WHOIS data...");
		const whoisData = await webAnalysisService.compileWhoisData({
			email: businessData.email,
			website_url: businessData.website_url ?? serpData.website ?? topWebsiteResult?.url ?? ""
		});
		const topWhoisResult = whoisData?.[0] ?? null;
		logger.info("[fullEnrichment] - \u{1F4F8} Capturing website screenshots...");
		const websiteScreenshots = await webScrapingService.compileMultipleWebsiteScreenshots(
			{
				website_url: businessData.website_url ?? serpData.website ?? topWebsiteResult?.url ?? "",
				businessId: businessData.id
			},
			maxAdditionalScreenshotUrls
		);
		const totalTimeSeconds = Math.round((Date.now() - startTime) / 1e3);
		const enrichedData = {
			// Original business data
			original: businessData,
			// SerpAPI enrichment data
			serpApi: {
				title: serpData.title || businessData.company_name || "",
				address: serpData.address || businessData.company_address || "",
				city: serpData.city || businessData.company_city || "",
				state: serpData.state || businessData.company_state || "",
				postal: serpData.postal || businessData.company_postalcode || "",
				phone: serpData.phone || businessData.phone_number || "",
				website: businessData.website_url ?? serpData.website ?? topWebsiteResult?.url ?? "",
				type: serpData.type || "",
				status: serpData.status || "",
				latitude: serpData.latitude || "",
				longitude: serpData.longitude || "",
				rating: serpData.rating || "",
				reviews: serpData.reviews || "",
				naics: serpData.naics || "",
				industry: serpData.industry || "",
				industryConfidence: serpData.industryConfidence || ""
			},
			// Website discovery data
			websiteDiscovery: {
				companyDba: serpData.title ?? topWebsiteResult?.name ?? "",
				discoveredWebsite: serpData.website ?? topWebsiteResult?.url ?? ""
			},
			// WHOIS domain data
			whois: {
				domain: topWhoisResult?.domain ?? "",
				found: topWhoisResult?.found ?? false,
				registrar: topWhoisResult?.registrar ?? "",
				creationDate: topWhoisResult?.creation_date ?? "",
				expirationDate: topWhoisResult?.expiration_date ?? "",
				updatedDate: topWhoisResult?.updated_date ?? "",
				domainAgeDays: topWhoisResult?.domain_age_days ?? 0,
				nameServers: topWhoisResult?.name_servers ?? [],
				domainStatus: topWhoisResult?.domain_status ?? []
			},
			// Web scraping data - Enhanced with multiple screenshots
			webScraping: {
				// Main website data
				mainWebsite: {
					url: websiteScreenshots?.main_website?.url ?? "",
					index: 0,
					homepageFullPath: websiteScreenshots?.main_website?.homepage_full_path ?? "",
					homepageFoldPath: websiteScreenshots?.main_website?.homepage_fold_path ?? "",
					htmlContentPath: websiteScreenshots?.main_website?.html_content_path ?? "",
					htmlContent: websiteScreenshots?.main_website?.html_content ?? "",
					textContent: websiteScreenshots?.main_website?.text_content ?? "",
					websiteTitleScraped: websiteScreenshots?.main_website?.website_title_scraped ?? "",
					websiteMetaDescription: websiteScreenshots?.main_website?.website_meta_description ?? "",
					success: websiteScreenshots?.main_website?.success ?? false,
					errorMessage: websiteScreenshots?.main_website?.error_message ?? "",
					timestamp: websiteScreenshots?.main_website?.timestamp ?? ""
				},
				// Additional screenshots from parsed URLs (with absolute paths)
				additionalScreenshots: (websiteScreenshots?.additional_screenshots ?? []).map(screenshot => ({
					url: screenshot.url,
					index: screenshot.index,
					homepageFullPath: screenshot.homepage_full_path,
					homepageFoldPath: screenshot.homepage_fold_path,
					htmlContentPath: screenshot.html_content_path || "",
					htmlContent: screenshot.html_content || "",
					textContent: screenshot.text_content || "",
					websiteTitleScraped: screenshot.website_title_scraped || "",
					websiteMetaDescription: screenshot.website_meta_description || "",
					success: screenshot.success || false,
					errorMessage: screenshot.error_message || "",
					timestamp: screenshot.timestamp || ""
				})),
				// Summary statistics
				totalScreenshots: websiteScreenshots?.total_screenshots ?? 0,
				urlsParsed: websiteScreenshots?.urls_parsed ?? 0,
				overallSuccess: websiteScreenshots?.success ?? false
			},
			// Processing metadata
			metadata: {
				processedAt: /* @__PURE__ */ new Date().toISOString(),
				processingTimeSeconds: totalTimeSeconds,
				enrichmentSteps: [
					"SerpAPI Data Collection",
					"Website Discovery",
					"WHOIS Domain Intelligence",
					"Multiple Website Screenshots & Content Parsing"
				]
			}
		};
		logger.info("[fullEnrichment] - \u2705 Simplified enrichment completed successfully!");
		logger.info(`[fullEnrichment] -    \u2022 Total time: ${totalTimeSeconds} seconds`);
		return enrichedData;
	} catch (error) {
		logger.error(error, `[fullEnrichment] - \u274C Error during enrichment:`);
		throw error;
	}
}
module.exports = { simplifiedFullEnrichment };
