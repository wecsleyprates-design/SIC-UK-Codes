import { extractWatchlistResultsFromTruliooResponse } from "../utils";
import type { TruliooWatchlistHit } from "../types";

describe("extractWatchlistResultsFromTruliooResponse", () => {
	describe("Priority 1: Extract detailed hits from fullServiceDetails", () => {
		it("should extract detailed WL_results hits from fullServiceDetails", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											{
												DatasourceName: "Advanced Watchlist",
												AppendedFields: [
													{
														FieldName: "WatchlistHitDetails",
														Data: {
															WL_results: [
																{
																	score: 1,
																	subjectMatched: "Jacqueline Martin",
																	sourceListType: "Register of Insolvencies",
																	sourceRegion: "Europe",
																	sourceAgencyName: "Accountant in Bankruptcy",
																	URL: "https://example.com/hit1"
																},
																{
																	score: 0.98,
																	subjectMatched: "Martin Jacqueline",
																	sourceListType: "Employment Tribunal Decisions",
																	sourceRegion: "Europe",
																	sourceAgencyName: "Employment Tribunal",
																	URL: "https://example.com/hit2"
																}
															]
														}
													}
												]
											}
										]
									}
								}
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeDefined();
			expect(results?.length).toBe(2);
			expect(results?.[0]).toMatchObject({
				listType: "SANCTIONS",
				listName: "Register of Insolvencies",
				confidence: 1,
				matchDetails: "Jacqueline Martin",
				url: "https://example.com/hit1",
				sourceAgencyName: "Accountant in Bankruptcy",
				sourceRegion: "Europe",
				sourceListType: "Register of Insolvencies",
				listCountry: "Europe"
			});
			expect(results?.[1]).toMatchObject({
				listType: "SANCTIONS",
				listName: "Employment Tribunal Decisions",
				confidence: 0.98,
				matchDetails: "Martin Jacqueline",
				url: "https://example.com/hit2",
				sourceAgencyName: "Employment Tribunal",
				sourceRegion: "Europe",
				sourceListType: "Employment Tribunal Decisions",
				listCountry: "Europe"
			});
		});

		it("should extract AM_results (Adverse Media) hits", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											{
												DatasourceName: "Advanced Watchlist",
												AppendedFields: [
													{
														FieldName: "WatchlistHitDetails",
														Data: {
															AM_results: [
																{
																	score: 0.95,
																	subjectMatched: "John Doe",
																	sourceListType: "Press Releases",
																	sourceRegion: "North America",
																	sourceAgencyName: "FBI"
																}
															]
														}
													}
												]
											}
										]
									}
								}
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeDefined();
			expect(results?.length).toBe(1);
			expect(results?.[0]).toMatchObject({
				listType: "ADVERSE_MEDIA",
				listName: "Press Releases",
				confidence: 0.95,
				matchDetails: "John Doe",
				sourceAgencyName: "FBI",
				sourceRegion: "North America"
			});
		});

		it("should extract PEP_results hits", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											{
												DatasourceName: "Advanced Watchlist",
												AppendedFields: [
													{
														FieldName: "WatchlistHitDetails",
														Data: {
															PEP_results: [
																{
																	score: 1,
																	subjectMatched: "Jane Smith",
																	sourceListType: "PEP Database",
																	sourceRegion: "Asia"
																}
															]
														}
													}
												]
											}
										]
									}
								}
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeDefined();
			expect(results?.length).toBe(1);
			expect(results?.[0]).toMatchObject({
				listType: "PEP",
				listName: "PEP Database",
				confidence: 1,
				matchDetails: "Jane Smith",
				sourceRegion: "Asia"
			});
		});

		it("should extract all three types (WL, AM, PEP) when present", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											{
												DatasourceName: "Advanced Watchlist",
												AppendedFields: [
													{
														FieldName: "WatchlistHitDetails",
														Data: {
															WL_results: [{ score: 1, subjectMatched: "Hit 1" }],
															AM_results: [{ score: 0.9, subjectMatched: "Hit 2" }],
															PEP_results: [{ score: 0.8, subjectMatched: "Hit 3" }]
														}
													}
												]
											}
										]
									}
								}
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeDefined();
			expect(results?.length).toBe(3);
			expect(results?.[0].listType).toBe("SANCTIONS");
			expect(results?.[1].listType).toBe("ADVERSE_MEDIA");
			expect(results?.[2].listType).toBe("PEP");
		});

		it("should prioritize detailed hits over summary format", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								watchlistResults: {
									"Advanced Watchlist": {
										watchlistHitDetails: {
											num_WL_hits: 5
										}
									}
								},
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											{
												DatasourceName: "Advanced Watchlist",
												AppendedFields: [
													{
														FieldName: "WatchlistHitDetails",
														Data: {
															WL_results: [
																{
																	score: 1,
																	subjectMatched: "Detailed Hit",
																	sourceListType: "Test List"
																}
															]
														}
													}
												]
											}
										]
									}
								}
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeDefined();
			expect(results?.length).toBe(1);
			expect(results?.[0].matchDetails).toBe("Detailed Hit");
			expect(results?.[0].listName).toBe("Test List");
		});
	});

	describe("Priority 2: Fallback to summary format", () => {
		it("should extract from summary format when detailed hits are not available", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								watchlistResults: {
									"Advanced Watchlist": {
										watchlistHitDetails: {
											num_WL_hits: 3,
											num_AM_hits: 2,
											num_PEP_hits: 1
										}
									}
								}
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeDefined();
			expect(results?.length).toBe(6); // 3 WL + 2 AM + 1 PEP
			expect(results?.filter((h) => h.listType === "SANCTIONS").length).toBe(3);
			expect(results?.filter((h) => h.listType === "ADVERSE_MEDIA").length).toBe(2);
			expect(results?.filter((h) => h.listType === "PEP").length).toBe(1);
			expect(results?.[0].matchDetails).toBe("Watchlist hit 1 of 3");
		});

		it("should handle direct summary format", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								watchlistResults: {
									watchlistStatus: "Potential Hit",
									wlHitsNumber: 2,
									amHitsNumber: 1,
									pepHitsNumber: 0
								}
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeDefined();
			expect(results?.length).toBe(3); // 2 WL + 1 AM
		});

		it("should extract from summary format when hits are under WatchlistData (not watchlistHitDetails)", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								watchlistResults: {
									"PEP Database": {
										WatchlistData: {
											num_WL_hits: 0,
											num_AM_hits: 0,
											num_PEP_hits: 2
										}
									}
								}
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeDefined();
			expect(results?.length).toBe(2);
			expect(results?.filter((h) => h.listType === "PEP").length).toBe(2);
			expect(results?.[0].listName).toBe("PEP Database");
			expect(results?.[0].matchDetails).toBe("PEP hit 1 of 2");
		});
	});

	describe("Edge cases", () => {
		it("should return pre-processed array if watchlistResults is already an array", () => {
			const preProcessedHits: TruliooWatchlistHit[] = [
				{
					listType: "SANCTIONS",
					listName: "Test",
					confidence: 1,
					matchDetails: "Pre-processed"
				}
			];

			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								watchlistResults: preProcessedHits
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBe(preProcessedHits);
		});

		it("should return undefined when no watchlist data is found", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "other_node_type"
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeUndefined();
		});

		it("should return undefined when flowData is empty", () => {
			const rawClientData = {
				flowData: {}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeUndefined();
		});

		it("should handle missing subjectMatched by using entityName or remarks", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											{
												DatasourceName: "Advanced Watchlist",
												AppendedFields: [
													{
														FieldName: "WatchlistHitDetails",
														Data: {
															WL_results: [
																{
																	score: 1,
																	entityName: "Entity Name",
																	sourceListType: "Test"
																},
																{
																	score: 1,
																	remarks: "Remarks text",
																	sourceListType: "Test"
																}
															]
														}
													}
												]
											}
										]
									}
								}
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeDefined();
			expect(results?.length).toBe(2);
			expect(results?.[0].matchDetails).toBe("Entity Name");
			expect(results?.[1].matchDetails).toBe("Remarks text");
		});

		it("should handle empty arrays in detailed hits", () => {
			const rawClientData = {
				flowData: {
					flow1: {
						serviceData: [
							{
								nodeType: "trulioo_person_wl",
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											{
												DatasourceName: "Advanced Watchlist",
												AppendedFields: [
													{
														FieldName: "WatchlistHitDetails",
														Data: {
															WL_results: [],
															AM_results: [],
															PEP_results: []
														}
													}
												]
											}
										]
									}
								}
							}
						]
					}
				}
			};

			const results = extractWatchlistResultsFromTruliooResponse(rawClientData);

			expect(results).toBeUndefined();
		});
	});
});
