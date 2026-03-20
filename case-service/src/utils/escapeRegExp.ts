 
export const escapeRegExp = (s: string) => {
	return s.replace(/[']/g, "''").replace(/[."*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
};
