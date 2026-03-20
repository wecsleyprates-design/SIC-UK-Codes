export const escapeRegExp = string => {
	return string.replace(/[']/g, "''").replace(/['."*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
};
