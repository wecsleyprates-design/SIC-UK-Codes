export const evaluateCondition = (expression: string, variables: Record<string, any>): boolean => {
	// Step 1: Replace placeholders with actual values from variables
	Object.keys(variables).forEach(key => {
		let value = variables[key];

		// Ensure objects are properly converted before replacing
		if (typeof value === "object") {
			value = JSON.stringify(value); // Convert objects to strings
		}

		const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
		expression = expression.replace(regex, typeof value === "string" ? `"${value}"` : value);
	});

	// Step 2: Replace logical operators (&&, ||) and comparison operators
	expression = expression
		.replace(/&&/g, "&&") // Keep JavaScript logical AND
		.replace(/\|\|/g, "||") // Keep JavaScript logical OR
		.replace(/=/g, "===") // Convert '=' to '===' for strict comparison
		.replace(/{{\s*([\w.]+)\s*}}/g, "$1"); // convert {{new_business}}=true to new_business=true

	// Step 3: Split conditions and evaluate manually
	const conditionParts = expression.split("&&").map(cond => cond.trim());

	for (const part of conditionParts) {
		if (!evaluateSimpleCondition(part)) {
			return false; // If any part fails, the whole condition is false
		}
	}

	return true; // If all parts pass, the condition is true
};

export const evaluateSimpleCondition = (condition: string): boolean => {
	// Handle comparison like "x > y" or "x === y"
	const match = condition.match(/(["\w\s;]+)\s*(===|>|<|>=|<=)\s*(["\w\s;]+)/);

	// Check if the condition pattern is valid
	if (!match) {
		console.error(`Invalid condition format: ${condition}`);
		return false;
	}

	const [left, operator, right] = match.slice(1);

	// Parse values as numbers if applicable, otherwise keep as strings
	const parsedLeft = isNaN(Number(left)) ? left.replace(/"/g, "") : parseFloat(left);
	const parsedRight = isNaN(Number(right)) ? right.replace(/"/g, "") : parseFloat(right);

	switch (operator) {
		case "===":
			return parsedLeft === parsedRight;
		case ">":
			return parsedLeft > parsedRight;
		case "<":
			return parsedLeft < parsedRight;
		case ">=":
			return parsedLeft >= parsedRight;
		case "<=":
			return parsedLeft <= parsedRight;
		default:
			console.error(`Unsupported operator: ${operator}`);
			return false; // Unsupported operator
	}
};

export const parse = (value: string) => {
	try {
		const res = JSON.parse(value);
		return res;
	} catch (error) {
		console.error(error);
		return "";
	}
};
