import { db, logger } from "#helpers";
import type { MapperField } from "#types";
import { businesses } from "../../businesses";
import type { Mapper } from "../../mapper";

export function getCustomFields(): MapperField[] {
	return [
		{
			column: /^custom:.*/,
			description: "The customer's custom fields data for the business",
			table: "data_business_custom_fields",
			dataType: "json",
			concat: true
		}
	];
}

export async function processCustomFields(mapper: Mapper, fields: MapperField[], dataCasesIsArray = true) {
	const metadata = mapper.getAdditionalMetadata();
	const businessID = metadata.data_businesses?.id;
	const customerID = metadata.customerID;
	// the POST payload can contain multiple businesses, so data_cases is an array
	// the PATCH payload can only contain one business, so data_cases is an object
	// the rest of the process is identical for both scenarios
	const caseID = dataCasesIsArray
		? metadata.data_cases?.[0]?.id
		: metadata.data_cases?.id;

	if (!businessID || !customerID) {
		return;
	}

	const customFields = fields.filter(field => field.column?.startsWith("custom:"));
	if (customFields.length === 0) {
		return; // No custom fields to process
	}

	const templateResult = await db("onboarding_schema.data_custom_templates")
		.select("id")
		.where({ customer_id: customerID, is_enabled: true })
		.orderBy("version", "desc")
		.first();

	if (!templateResult) {
		throw new Error(`No custom template found for customer ID: ${customerID}`);
	}
	const templateID = templateResult.id;

	// Fetch all fields related to the template
	const allFields = await db("onboarding_schema.data_custom_fields as dcf")
		.select("dcf.id as field_id", "dcf.code", "dcf.property", "dcf.rules", "cfp.code as type")
		.leftJoin("onboarding_schema.core_field_properties as cfp", "dcf.property", "cfp.id")
		.where({ "dcf.template_id": templateID });

	if (!allFields.length) {
		throw new Error(`No fields found for template ID: ${templateID}`);
	}

	// drop-down/checkbox field options for validation purposes
	const ddcbFieldOptions = await db("onboarding_schema.data_custom_fields as dcf")
		.select(
			"dcf.label as field_name",
			"dcf.code as field_id",
			db.raw("STRING_AGG(TRIM(dfo.label), ',') AS item_label"),
			db.raw("STRING_AGG(TRIM(dfo.value), ',') AS item_value")
		)
		.leftJoin("onboarding_schema.data_field_options as dfo", "dcf.id", "dfo.field_id")
		.where("dcf.template_id", templateID)
		.whereNotNull("dfo.label")
		.groupBy("dcf.label", "dcf.code");

	const fieldMap = new Map(allFields.map(f => [f.code?.trim(), f]));
	const optionsMap = new Map(ddcbFieldOptions.map(o => [o.field_id, o]));
	const fieldsToValidate: any[] = [];
	const filteredOutFields: any[] = [];

	fields.forEach(f => {
		if (!f.column?.startsWith("custom:")) return;

		const fieldCode = f.column.replace("custom:", "").trim();
		const details = fieldMap.get(fieldCode);

		if (!details) {
			filteredOutFields.push({ code: fieldCode, field_id: "field does not exist" });
			return;
		}

		let value = f.value ?? "";
		let { type } = details;

		const processRules = rules => {
			if (!rules || typeof rules !== "object") return [];
			const mergedRules: any[] = [];
			if (rules.required) mergedRules.push({ rule: "required" });

			if (rules.properties && typeof rules.properties === "object") {
				Object.entries(rules.properties).forEach(([key, val]) => {
					const ruleMap = {
						minimum: parseInt,
						maximum: parseInt,
						minLength: parseInt,
						maxLength: parseInt,
						decimalPlaces: parseInt,
						sum: v => v,
						equal: v => v,
						description: v => v,
						fileType: v => v,
						maxFileSize: v => v
					};
					if (ruleMap[key]) {
						mergedRules.push({ rule: key, value: ruleMap[key](val) });
					}
				});
			}
			return mergedRules;
		};

		// Ensure rules are properly processed
		const processedRules = processRules(details.rules);

		const isNumberType = ["integer", "decimal"].includes(type);
		const isDropdownType = type === "dropdown";
		const isCheckboxType = type === "checkbox";

		let parsedValue: any = isNumberType ? parseFloat(String(value)) : value;

		// Validation for dropdown type
		if (isDropdownType) {
			try {
				// Submitted values can include JSON objects, stringified JSON objects, and a string representing the selected value.
				let dropdownValue: any =
					typeof value === "string" && value.trim() !== "" && value.includes("{") ? JSON.parse(value) : value;
				const isValidDropdownObject =
					dropdownValue && typeof dropdownValue === "object" && "label" in dropdownValue && "value" in dropdownValue;

				const singleOption = optionsMap.get(fieldCode);
				if (!singleOption) {
					filteredOutFields.push({ fieldCode, value, error: "Unable to find a valid optionsMap." });
					return;
				}

				const labelValidOptions = singleOption.item_label?.includes(",")
					? singleOption.item_label.toLowerCase().split(",")
					: singleOption.item_label.toLowerCase();
				const valueValidOptions = singleOption.item_value?.includes(",")
					? singleOption.item_value.toLowerCase().split(",")
					: singleOption.item_value.toLowerCase();

				// When checking a valid object from the request, both properties - label and value - must
				// match the template versions.
				if (isValidDropdownObject) {
					if (!labelValidOptions.includes(dropdownValue.label.toLowerCase())) {
						filteredOutFields.push({
							fieldCode,
							value,
							error: "Provided dropdown label does not match corresponding template label."
						});
						return;
					}

					if (!valueValidOptions.includes(dropdownValue.value.toLowerCase())) {
						filteredOutFields.push({
							fieldCode,
							value,
							error: "Provided dropdown value does not match corresponding template value."
						});
						return;
					}
				} else {
					if (!valueValidOptions.includes(dropdownValue.toLowerCase())) {
						filteredOutFields.push({ fieldCode, value, error: "Invalid dropdown format or value." });
						return;
					}

					const valueIndex =
						typeof valueValidOptions === "string" ? -1 : valueValidOptions.indexOf(dropdownValue.toLowerCase());

					if (valueIndex === -1) {
						dropdownValue = {
							label: singleOption.item_label,
							value: singleOption.item_value
						};
					} else {
						dropdownValue = {
							label: singleOption.item_label.split(",")[valueIndex],
							value: singleOption.item_value.split(",")[valueIndex]
						};
					}
				}

				parsedValue = dropdownValue;
			} catch (_ex) {
				filteredOutFields.push({ fieldCode, value, error: "Invalid JSON for dropdown." });
				return;
			}
		}

		// Checkbox Validation
		if (isCheckboxType) {
			try {
				const jsonValue = typeof value === "string" ? JSON.parse(value) : value;

				if (!Array.isArray(jsonValue)) {
					throw new Error("Checkbox value must be an array.");
				}

				const isValidCheckbox = jsonValue.every(
					item =>
						typeof item === "object" &&
						item !== null &&
						"label" in item &&
						"value" in item &&
						"checkbox_type" in item &&
						"checked" in item &&
						typeof item.label === "string" &&
						typeof item.value === "string" &&
						typeof item.checkbox_type === "string" &&
						typeof item.checked === "boolean"
				);

				if (!isValidCheckbox) {
					filteredOutFields.push({ fieldCode, value, error: "Invalid checkbox format." });
					return;
				}

				const singleOption = optionsMap.get(fieldCode);
				const labelValidOptions = singleOption.item_label?.includes(",")
					? singleOption.item_label.toLowerCase().split(",")
					: singleOption.item_label.toLowerCase();
				const valueValidOptions = singleOption.item_value?.includes(",")
					? singleOption.item_value.toLowerCase().split(",")
					: singleOption.item_value.toLowerCase();
				const finalJson = jsonValue.filter(val => {
					return (
						labelValidOptions.includes(val.label.toLowerCase()) &&
						valueValidOptions.includes(val.value.toLowerCase()) &&
						val.checked === true
					);
				});

				if (finalJson.length === 0) {
					filteredOutFields.push({ fieldCode, value, error: "Provided checkbox data has no valid options." });
					return;
				}

				parsedValue = finalJson;
			} catch (_ex) {
				filteredOutFields.push({ fieldCode, value, error: "Invalid JSON for checkbox." });
				return;
			}
		}

		// Validation for integer and decimal fields
		const targetArray = isNumberType && isNaN(parsedValue) ? filteredOutFields : fieldsToValidate;

		// If we are passed a number type we want to pass that along to the database, otherwise we
		// need to convert the parsed JSON object/array back to a string for the database.
		if (isNaN(parsedValue) && typeof parsedValue === "object") {
			parsedValue = JSON.stringify(parsedValue);
		} else {
			parsedValue = value;
		}

		targetArray.push({
			field_id: details.field_id,
			code: details.code,
			type: type,
			value: parsedValue,
			rules: processedRules
		});
	});

	logger.info(`filteredOutFields: ${JSON.stringify(filteredOutFields)}`);

	const formattedFields = fieldsToValidate.map(field => ({
		customer_field_id: field.field_id,
		value: field.value,
		type: field.type,
		rules: field.rules || [],
		value_id: field.value_id || null // value_id is mainly needed for upload fields
	}));

	// Prepare parameters
	const params = { caseID };
	const body = {
		businessId: businessID,
		templateId: templateID,
		fields: formattedFields
	};

	const userInfo = { user_id: metadata.userID };
	await businesses.addOrUpdateCustomFields(params, body, [], userInfo);

	// Attach processed custom fields to mapper metadata
	mapper.addAdditionalMetadata({
		custom_fields: fieldsToValidate.map(field => ({
			name: field.code,
			value: field.value
		}))
	});
}
