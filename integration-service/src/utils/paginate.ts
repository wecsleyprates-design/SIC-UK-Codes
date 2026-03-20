export const paginate = (count: number, limit: number) => {
	const pagination = {
		totalItems: count,
		totalPages: Math.ceil(count / (limit || count)) || 0
	};
	return pagination;
};

export const isValidPage = page => /^[1-9]\d*$/u.test(page);
export const isValidLimit = limit => /^(?:all|\d+)$/u.test(limit);
