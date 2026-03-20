export const fetchEconomicsParams = (observationStartDate, frequency, aggregationMethod) => {
	const fredData = [
		{
			index: "gdp_pch",
			request: {
				series_id: "GDPC1",
				observation_start: observationStartDate,
				units: "pch",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "gdp_pc1",
			request: {
				series_id: "GDPC1",
				observation_start: observationStartDate,
				units: "pc1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "t10y2y",
			request: {
				series_id: "T10Y2Y",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "t10y2y_chg",
			request: {
				series_id: "T10Y2Y",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "t10y2y_ch1",
			request: {
				series_id: "T10Y2Y",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "t10y",
			request: {
				series_id: "DGS10",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "t10y_chg",
			request: {
				series_id: "DGS10",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "t10y_ch1",
			request: {
				series_id: "DGS10",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "t2y",
			request: {
				series_id: "DGS2",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "t2y_chg",
			request: {
				series_id: "DGS2",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "t2y_ch1",
			request: {
				series_id: "DGS2",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "brent_pch",
			request: {
				series_id: "POILBREUSDM",
				observation_start: observationStartDate,
				units: "pch",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "brent_pc1",
			request: {
				series_id: "POILBREUSDM",
				observation_start: observationStartDate,
				units: "pc1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "wtispot_pch",
			request: {
				series_id: "WTISPLC",
				observation_start: observationStartDate,
				units: "pch",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "wtispot_pc1",
			request: {
				series_id: "WTISPLC",
				observation_start: observationStartDate,
				units: "pc1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "vix",
			request: {
				series_id: "VIXCLS",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "vix_chg",
			request: {
				series_id: "VIXCLS",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "vix_ch1",
			request: {
				series_id: "VIXCLS",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "csentiment",
			request: {
				series_id: "UMCSENT",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "csentiment_chg",
			request: {
				series_id: "UMCSENT",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "csentiment_ch1",
			request: {
				series_id: "UMCSENT",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "dolindx",
			request: {
				series_id: "RTWEXBGS",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "dolindx_chg",
			request: {
				series_id: "RTWEXBGS",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "dolindx_ch1",
			request: {
				series_id: "RTWEXBGS",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "unemp",
			request: {
				series_id: "UNRATE",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "unemp_chg",
			request: {
				series_id: "UNRATE",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "unemp_ch1",
			request: {
				series_id: "UNRATE",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "cpi",
			request: {
				series_id: "USACPALTT01CTGYM",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "cpi_chg",
			request: {
				series_id: "USACPALTT01CTGYM",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "cpi_ch1",
			request: {
				series_id: "USACPALTT01CTGYM",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "cpicore",
			request: {
				series_id: "CORESTICKM159SFRBATL",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "cpicore_chg",
			request: {
				series_id: "CORESTICKM159SFRBATL",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "cpicore_ch1",
			request: {
				series_id: "CORESTICKM159SFRBATL",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "ccdelinq",
			request: {
				series_id: "DRCCLACBS",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "ccdelinq_chg",
			request: {
				series_id: "DRCCLACBS",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "ccdelinq_ch1",
			request: {
				series_id: "DRCCLACBS",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "cloandelinq",
			request: {
				series_id: "DRCLACBS",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "cloandelinq_chg",
			request: {
				series_id: "DRCLACBS",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "cloandelinq_ch1",
			request: {
				series_id: "DRCLACBS",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "busloandelinq",
			request: {
				series_id: "DRBLACBS",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "busloandelinq_chg",
			request: {
				series_id: "DRBLACBS",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "busloandelinq_ch1",
			request: {
				series_id: "DRBLACBS",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "wagegrowth",
			request: {
				series_id: "FRBATLWGT3MMAUMHWGO",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "wagegrowth_chg",
			request: {
				series_id: "FRBATLWGT3MMAUMHWGO",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "usdeur",
			request: {
				series_id: "DEXUSEU",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "usdeur_chg",
			request: {
				series_id: "DEXUSEU",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "usdeur_ch1",
			request: {
				series_id: "DEXUSEU",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "usdpeso",
			request: {
				series_id: "DEXMXUS",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "usdpeso_chg",
			request: {
				series_id: "DEXMXUS",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "usdpeso_ch1",
			request: {
				series_id: "DEXMXUS",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "usdcan",
			request: {
				series_id: "DEXCAUS",
				observation_start: observationStartDate,
				units: "lin",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "usdcan_chg",
			request: {
				series_id: "DEXCAUS",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "usdcan_ch1",
			request: {
				series_id: "DEXCAUS",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "ppi_chg",
			request: {
				series_id: "PPIACO",
				observation_start: observationStartDate,
				units: "chg",
				frequency,
				aggregationMethod
			}
		},
		{
			index: "ppi_ch1",
			request: {
				series_id: "PPIACO",
				observation_start: observationStartDate,
				units: "ch1",
				frequency,
				aggregationMethod
			}
		}
	];
	return fredData;
};

export const requiredParams = () => {
	return [
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
};
