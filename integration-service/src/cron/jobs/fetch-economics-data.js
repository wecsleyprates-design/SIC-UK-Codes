import Fred from "node-fred";
import { sqlTransaction, sqlQuery, logger } from "#helpers/index";
import { uploadEconomicsDataToS3 } from "#common/common";
import { DIRECTORIES } from "#constants";
import { envConfig } from "#configs/index";
import { buildInsertQuery } from "#utils/queryBuilder";
import { fetchEconomicsParams, requiredParams } from "#utils/fredParams";

/**
 * Fetches economics data from the FRED API.
 * @returns {Promise<void>} A promise that resolves when the data is fetched.
 */
export const fetchEconomicsData = async () => {
	try {
		logger.info("=============== Executing Cron Job to Fetch Economics Data ===============");

		// Checking for db data if present then we will not fetch data from start date
		const countQuery = `SELECT count(*) AS totalcount FROM integration_data.economics_data`;
		const countResult = await sqlQuery({
			sql: countQuery,
			values: []
		});
		let observationStartDate = envConfig.ECONOMICS_OBSERVATION_START_DATE;

		// Checking for db data if present then we will from present day
		if (countResult.rows[0].totalcount > 0) {
			const today = new Date();
			const month = `0${today.getMonth() + 1}`.slice(-2);
			const year = today.getFullYear();
			observationStartDate = `${year}-${month}-01`;
		}
		logger.info({ observationStartDate });

		// parameters for the FRED API
		const frequency = "q";
		const aggregationMethod = "eop";

		// fetching parameters for the function after mapping
		const fredData = fetchEconomicsParams(observationStartDate, frequency, aggregationMethod);
		const dataArray = [];

		const fred = new Fred(envConfig.FRED_API_KEY);

		// fetching data from FRED API for each parameter object request
		for (let i = 0; i < fredData.length; i++) {
			const param = fredData[i];
			try {
				const data = await fred.series.getObservationsForSeries(param.request.series_id, param.request);
				for (let index = 0; index < data.observations.length; index++) {
					const observObjects = data.observations[index];
					let row = dataArray.find(obj => obj.date === observObjects.date);
					if (row) {
						row[param.index] = observObjects.value;
					} else {
						row = {};
						row.date = observObjects.date;
						row[param.index] = observObjects.value;
						dataArray.push(row);
					}
				}
			} catch (error) {
				logger.error(error);
			}
		}
		const table = "integration_data.economics_data";
		const columns = [
			"date_time",
			"gdp_pch",
			"gdp_pc1",
			"t10y2y",
			"t10y2y_chg",
			"t10y2y_ch1",
			"t10y",
			"t10y_chg",
			"t10y_ch1",
			"t2y",
			"t2y_chg",
			"t2y_ch1",
			"brent_pch",
			"brent_pc1",
			"wtispot_pch",
			"wtispot_pc1",
			"vix",
			"vix_chg",
			"vix_ch1",
			"csentiment",
			"csentiment_chg_x",
			"csentiment_chg_y",
			"dolindx",
			"dolindx_chg",
			"dolindx_ch1",
			"unemp",
			"unemp_chg",
			"unemp_ch1",
			"cpi",
			"cpi_chg",
			"cpi_ch1",
			"cpicore",
			"cpicore_chg",
			"cpicore_ch1",
			"ccdelinq",
			"ccdelinq_chg",
			"ccdelinq_ch1",
			"cloandelinq",
			"cloandelinq_chg",
			"cloandelinq_ch1",
			"busloandelinq",
			"busloandelinq_chg",
			"busloandelinq_ch1",
			"wagegrowth",
			"wagegrowth_chg",
			"usdeur",
			"usdeur_chg",
			"usdeur_ch1",
			"usdpeso",
			"usdpeso_chg",
			"usdpeso_ch1",
			"usdcan",
			"usdcan_chg",
			"usdcan_ch1",
			"ppi_chg",
			"ppi_ch1"
		];
		let lastObj = dataArray[dataArray.length - 1];

		// Checking if the last object has some data
		if (
			lastObj &&
			Object.keys(lastObj).every(x => {
				return lastObj[x] === "" || lastObj[x] === null || lastObj[x] === "." || lastObj[x] === `${lastObj.date}`;
			}) === false
		) {
			logger.info("Object has some data");
			const reqArray = requiredParams();
			reqArray.forEach(element => {
				if (!lastObj[element]) {
					lastObj[element] = "0";
				}
			});
		} else {
			logger.info("Object has nothing");
			lastObj = undefined;
		}

		// Uploading the latest data to S3
		if (lastObj) {
			try {
				await uploadEconomicsDataToS3(lastObj, "latest", DIRECTORIES.ECONOMICS);
			} catch (error) {
				logger.error(error);
			}
		}

		// Inserting the data into the database
		const rows = [];
		for await (const item of dataArray) {
			rows.push([
				item.date,
				!isNaN(item.gdp_pch) ? Math.round(item.gdp_pch) : 0,
				!isNaN(item.gdp_pc1) ? Math.round(item.gdp_pc1) : 0,
				!isNaN(item.t10y2y) ? Math.round(item.t10y2y) : 0,
				!isNaN(item.t10y2y_chg) ? Math.round(item.t10y2y_chg) : 0,
				!isNaN(item.t10y2y_ch1) ? Math.round(item.t10y2y_ch1) : 0,
				!isNaN(item.t10y) ? Math.round(item.t10y) : 0,
				!isNaN(item.t10y_chg) ? Math.round(item.t10y_chg) : 0,
				!isNaN(item.t10y_ch1) ? Math.round(item.t10y_ch1) : 0,
				!isNaN(item.t2y) ? Math.round(item.t2y) : 0,
				!isNaN(item.t2y_chg) ? Math.round(item.t2y_chg) : 0,
				!isNaN(item.t2y_ch1) ? Math.round(item.t2y_ch1) : 0,
				!isNaN(item.brent_pch) ? Math.round(item.brent_pch) : 0,
				!isNaN(item.brent_pc1) ? Math.round(item.brent_pc1) : 0,
				!isNaN(item.wtispot_pch) ? Math.round(item.wtispot_pch) : 0,
				!isNaN(item.wtispot_pc1) ? Math.round(item.wtispot_pc1) : 0,
				!isNaN(item.vix) ? Math.round(item.vix) : 0,
				!isNaN(item.vix_chg) ? Math.round(item.vix_chg) : 0,
				!isNaN(item.vix_ch1) ? Math.round(item.vix_ch1) : 0,
				!isNaN(item.csentiment) ? Math.round(item.csentiment) : 0,
				!isNaN(item.csentiment_chg_x) ? Math.round(item.csentiment_chg_x) : 0,
				!isNaN(item.csentiment_chg_y) ? Math.round(item.csentiment_chg_y) : 0,
				!isNaN(item.dolindx) ? Math.round(item.dolindx) : 0,
				!isNaN(item.dolindx_chg) ? Math.round(item.dolindx_chg) : 0,
				!isNaN(item.dolindx_ch1) ? Math.round(item.dolindx_ch1) : 0,
				!isNaN(item.unemp) ? Math.round(item.unemp) : 0,
				!isNaN(item.unemp_chg) ? Math.round(item.unemp_chg) : 0,
				!isNaN(item.unemp_ch1) ? Math.round(item.unemp_ch1) : 0,
				!isNaN(item.cpi) ? Math.round(item.cpi) : 0,
				!isNaN(item.cpi_chg) ? Math.round(item.cpi_chg) : 0,
				!isNaN(item.cpi_ch1) ? Math.round(item.cpi_ch1) : 0,
				!isNaN(item.cpicore) ? Math.round(item.cpicore) : 0,
				!isNaN(item.cpicore_chg) ? Math.round(item.cpicore_chg) : 0,
				!isNaN(item.cpicore_ch1) ? Math.round(item.cpicore_ch1) : 0,
				!isNaN(item.ccdelinq) ? Math.round(item.ccdelinq) : 0,
				!isNaN(item.ccdelinq_chg) ? Math.round(item.ccdelinq_chg) : 0,
				!isNaN(item.ccdelinq_ch1) ? Math.round(item.ccdelinq_ch1) : 0,
				!isNaN(item.cloandelinq) ? Math.round(item.cloandelinq) : 0,
				!isNaN(item.cloandelinq_chg) ? Math.round(item.cloandelinq_chg) : 0,
				!isNaN(item.cloandelinq_ch1) ? Math.round(item.cloandelinq_ch1) : 0,
				!isNaN(item.busloandelinq) ? Math.round(item.busloandelinq) : 0,
				!isNaN(item.busloandelinq_chg) ? Math.round(item.busloandelinq_chg) : 0,
				!isNaN(item.busloandelinq_ch1) ? Math.round(item.busloandelinq_ch1) : 0,
				!isNaN(item.wagegrowth) ? Math.round(item.wagegrowth) : 0,
				!isNaN(item.wagegrowth_chg) ? Math.round(item.wagegrowth_chg) : 0,
				!isNaN(item.usdeur) ? Math.round(item.usdeur) : 0,
				!isNaN(item.usdeur_chg) ? Math.round(item.usdeur_chg) : 0,
				!isNaN(item.usdeur_ch1) ? Math.round(item.usdeur_ch1) : 0,
				!isNaN(item.usdpeso) ? Math.round(item.usdpeso) : 0,
				!isNaN(item.usdpeso_chg) ? Math.round(item.usdpeso_chg) : 0,
				!isNaN(item.usdpeso_ch1) ? Math.round(item.usdpeso_ch1) : 0,
				!isNaN(item.usdcan) ? Math.round(item.usdcan) : 0,
				!isNaN(item.usdcan_chg) ? Math.round(item.usdcan_chg) : 0,
				!isNaN(item.usdcan_ch1) ? Math.round(item.usdcan_ch1) : 0,
				!isNaN(item.ppi_chg) ? Math.round(item.ppi_chg) : 0,
				!isNaN(item.ppi_ch1) ? Math.round(item.ppi_ch1) : 0
			]);
		}
		const insertTaxFilingQuery = buildInsertQuery(table, columns, rows);
		await sqlTransaction([insertTaxFilingQuery], [rows.flat()]);
		logger.info("=============== Cron Job to Fetch Economics Data has been executed. ===============");
	} catch (error) {
		logger.error(error);
	}
};
