/**
 * converts an Array of Objects with similar structure and distinct values to an Object
 * NOTE: if the array has duplicate values, some of the data will be lost i.e. duplicate keys will be overwritten
 * @param {Array} array
 * @param {String} key
 * @param {Array} requiredKeys (optional) - array of keys to be included in the value object: if not provided, all keys will be included
 * @return {Object}
 */
export const convertToObject = (array, objKey, requiredKeys = []) => {
	try {
		return array.reduce((obj, item) => {
			let value = {};
			if (requiredKeys.length) {
				requiredKeys.forEach(key => {
					value[key] = item[key];
				});
			} else {
				value = item;
			}
			obj[item[objKey]] = value;
			return obj;
		}, {});
	} catch (error) {
		throw error;
	}
};
