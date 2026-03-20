export const containsSql = (value: string): boolean => {
	const sqlKeywords = [
		"SELECT",
		"INSERT",
		"UPDATE",
		"DELETE",
		"FROM",
		"WHERE",
		"JOIN",
		"ON",
		"GROUP BY",
		"HAVING",
		"ORDER BY",
		"LIMIT",
		"OFFSET"
	];

	return sqlKeywords.some(keyword => value.toUpperCase().includes(keyword));
};
