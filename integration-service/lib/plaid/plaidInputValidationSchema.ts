import type { PlaidInputValidation } from "./idvInputValidation";
/**
 * From https://plaid.com/schema/identity_verification_api.json
 * pulled on Aug 25 2025
 */
export const plaidInputValidationSchema: PlaidInputValidation[] = [
	{
		country: { code: "AF", name: "Afghanistan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "AL", name: "Albania" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "DZ", name: "Algeria" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "AD", name: "Andorra" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "AO", name: "Angola" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "AI", name: "Anguilla" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "AG", name: "Antigua & Barbuda" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "AR", name: "Argentina" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Documento Nacional de Identidad (DNI)",
				type: "ar_dni",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{8,10}\\z",
					min_length: 8,
					max_length: 10,
					type: "numeric"
				},
				example: "92483956"
			}
		]
	},
	{
		country: { code: "AM", name: "Armenia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "AW", name: "Aruba" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "AU", name: "Australia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Driver’s License",
				type: "au_drivers_license",
				category: "drivers_license",
				validation: {
					pattern: "\\A[A-Z0-9]{6,11}\\z",
					min_length: 6,
					max_length: 11,
					type: "alphanumeric"
				},
				example: "25230984"
			},
			{
				name: "Passport Number",
				type: "au_passport",
				category: "passport",
				validation: {
					pattern: "\\A[A-Z0-9]{7,9}\\z",
					min_length: 7,
					max_length: 9,
					type: "alphanumeric"
				},
				example: "M0993353"
			}
		]
	},
	{
		country: { code: "AT", name: "Austria" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "AZ", name: "Azerbaijan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BS", name: "Bahamas" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BH", name: "Bahrain" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BD", name: "Bangladesh" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BB", name: "Barbados" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BY", name: "Belarus" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BE", name: "Belgium" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BZ", name: "Belize" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BJ", name: "Benin" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BM", name: "Bermuda" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BT", name: "Bhutan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BO", name: "Bolivia" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BA", name: "Bosnia & Herzegovina" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BW", name: "Botswana" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BR", name: "Brazil" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Cadastro de Pessoas Físicas (CPF)",
				type: "br_cpf",
				category: "tax_id",
				validation: {
					pattern: "\\A\\d{11}\\z",
					min_length: 11,
					max_length: 11,
					type: "numeric"
				},
				example: "15872146876"
			}
		]
	},
	{
		country: { code: "VG", name: "British Virgin Islands" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BN", name: "Brunei" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BG", name: "Bulgaria" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BF", name: "Burkina Faso" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BI", name: "Burundi" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "KH", name: "Cambodia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "CM", name: "Cameroon" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "CA", name: "Canada" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "optional"
		},
		id_numbers: [
			{
				name: "Social Insurance Number (SIN)",
				type: "ca_sin",
				category: "tax_id",
				validation: {
					pattern: "\\A\\d{9}\\z",
					min_length: 9,
					max_length: 9,
					type: "numeric"
				},
				example: "432199847"
			}
		]
	},
	{
		country: { code: "CV", name: "Cape Verde" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "BQ", name: "Caribbean Netherlands" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "KY", name: "Cayman Islands" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "CF", name: "Central African Republic" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TD", name: "Chad" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "CL", name: "Chile" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Rol Único Nacional (RUN)",
				type: "cl_run",
				category: "tax_id",
				validation: {
					pattern: "\\A\\d{7,8}[0-9Kk]\\z",
					min_length: 8,
					max_length: 9,
					type: "pattern"
				},
				example: "12937893K"
			}
		]
	},
	{
		country: { code: "CN", name: "China" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Resident Identity Card Number",
				type: "cn_resident_card",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{15}|\\d{17}(?:\\d|X)\\z",
					min_length: 15,
					max_length: 18,
					type: "pattern"
				},
				example: "123456789098765436"
			}
		]
	},
	{
		country: { code: "CO", name: "Colombia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Número de Identificación Tributaria (NIT)",
				type: "co_nit",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{8,10}\\z",
					min_length: 8,
					max_length: 10,
					type: "numeric"
				},
				example: "2131234321"
			}
		]
	},
	{
		country: { code: "KM", name: "Comoros" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "CG", name: "Congo - Brazzaville" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "CK", name: "Cook Islands" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "CR", name: "Costa Rica" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "HR", name: "Croatia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "CW", name: "Curaçao" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "CY", name: "Cyprus" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "CZ", name: "Czech Republic" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "required"
		},
		id_numbers: []
	},
	{
		country: { code: "CI", name: "Côte d’Ivoire" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "DK", name: "Denmark" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Civil Personal Registration (CPR)",
				type: "dk_cpr",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{9,11}\\z",
					min_length: 9,
					max_length: 11,
					type: "numeric"
				},
				example: "1304711813"
			}
		]
	},
	{
		country: { code: "DJ", name: "Djibouti" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "DM", name: "Dominica" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "DO", name: "Dominican Republic" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "EC", name: "Ecuador" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "EG", name: "Egypt" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: [
			{
				name: "National ID Card Number",
				type: "eg_national_id",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{14}\\z",
					min_length: 14,
					max_length: 14,
					type: "numeric"
				},
				example: "24801060100831"
			}
		]
	},
	{
		country: { code: "SV", name: "El Salvador" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "ER", name: "Eritrea" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "EE", name: "Estonia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SZ", name: "Eswatini" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "ET", name: "Ethiopia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "FO", name: "Faroe Islands" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "FJ", name: "Fiji" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "FI", name: "Finland" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "required"
		},
		id_numbers: []
	},
	{
		country: { code: "FR", name: "France" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "PF", name: "French Polynesia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GA", name: "Gabon" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GM", name: "Gambia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GE", name: "Georgia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "DE", name: "Germany" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GH", name: "Ghana" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GI", name: "Gibraltar" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GR", name: "Greece" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GL", name: "Greenland" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GD", name: "Grenada" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GT", name: "Guatemala" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GG", name: "Guernsey" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GN", name: "Guinea" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GW", name: "Guinea-Bissau" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GY", name: "Guyana" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "HT", name: "Haiti" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "HN", name: "Honduras" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "HK", name: "Hong Kong" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Hong Kong Identity (HKID)",
				type: "hk_hkid",
				category: "personal_identification",
				validation: {
					pattern: "\\A[A-Z0-9]{8,9}\\z",
					min_length: 8,
					max_length: 9,
					type: "alphanumeric"
				},
				example: "A1063528"
			}
		]
	},
	{
		country: { code: "HU", name: "Hungary" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "IS", name: "Iceland" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "IN", name: "India" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Permanent Account Number (PAN)",
				type: "in_pan",
				category: "tax_id",
				validation: {
					pattern: "\\A[A-Z]{5}\\d{4}[A-Z]\\z",
					min_length: 10,
					max_length: 10,
					type: "pattern"
				},
				example: "BAJPC4350M"
			},
			{
				name: "Voter ID (EPIC)",
				type: "in_epic",
				category: "voter_id",
				validation: {
					pattern: "\\A[A-Z]{3}\\d{7}\\z",
					min_length: 10,
					max_length: 10,
					type: "pattern"
				},
				example: "ABC0000000"
			}
		]
	},
	{
		country: { code: "ID", name: "Indonesia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "IQ", name: "Iraq" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "IE", name: "Ireland" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "IM", name: "Isle of Man" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "IL", name: "Israel" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "IT", name: "Italy" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "optional"
		},
		id_numbers: [
			{
				name: "Codice Fiscale (CF)",
				type: "it_cf",
				category: "tax_id",
				validation: {
					pattern: "\\A[A-Z]{6}\\d{2}[A-Z]\\d{2}[A-Z]\\d{3}[A-Z]\\z",
					min_length: 16,
					max_length: 16,
					type: "pattern"
				},
				example: "MWTMWT91D09F205Z"
			}
		]
	},
	{
		country: { code: "JM", name: "Jamaica" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "JP", name: "Japan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "optional"
		},
		id_numbers: [
			{
				name: '"My Number" Resident Record Code',
				type: "jp_my_number",
				category: "tax_id",
				validation: {
					pattern: "\\A\\d{12}\\z",
					min_length: 12,
					max_length: 12,
					type: "numeric"
				},
				example: "377991361023"
			}
		]
	},
	{
		country: { code: "JE", name: "Jersey" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "JO", name: "Jordan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: [
			{
				name: "Civil Identification Number",
				type: "jo_civil_id",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{10,14}\\z",
					min_length: 10,
					max_length: 14,
					type: "numeric"
				},
				example: "9592861351"
			}
		]
	},
	{
		country: { code: "KZ", name: "Kazakhstan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "KE", name: "Kenya" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Huduma Namba",
				type: "ke_huduma_namba",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{10}\\z",
					min_length: 10,
					max_length: 10,
					type: "numeric"
				},
				example: "0123456789"
			}
		]
	},
	{
		country: { code: "KI", name: "Kiribati" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "XK", name: "Kosovo" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "KW", name: "Kuwait" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: [
			{
				name: "Civil ID Card Number",
				type: "kw_civil_id",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{12}\\z",
					min_length: 12,
					max_length: 12,
					type: "numeric"
				},
				example: "273032401586"
			}
		]
	},
	{
		country: { code: "KG", name: "Kyrgyzstan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "LA", name: "Laos" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "LV", name: "Latvia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "LB", name: "Lebanon" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "LS", name: "Lesotho" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "LR", name: "Liberia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "LI", name: "Liechtenstein" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "LT", name: "Lithuania" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "LU", name: "Luxembourg" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MO", name: "Macao SAR China" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MG", name: "Madagascar" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MW", name: "Malawi" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MY", name: "Malaysia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "National Registration Identity Card Number (NRIC)",
				type: "my_nric",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{12}\\z",
					min_length: 12,
					max_length: 12,
					type: "numeric"
				},
				example: "342178945137"
			}
		]
	},
	{
		country: { code: "MV", name: "Maldives" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "ML", name: "Mali" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MT", name: "Malta" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MR", name: "Mauritania" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MU", name: "Mauritius" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MX", name: "Mexico" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Clave Única de Registro de Población (CURP)",
				type: "mx_curp",
				category: "personal_identification",
				validation: {
					pattern: "\\A[A-Z]{4}\\d{6}[A-Z]{6}[A-Z\\d]\\d\\z",
					min_length: 18,
					max_length: 18,
					type: "pattern"
				},
				example: "ZAZD801124MBSYQN13"
			},
			{
				name: "Registro Federal de Contribuyentes (RFC)",
				type: "mx_rfc",
				category: "tax_id",
				validation: {
					pattern: "\\A[A-Z]{4}\\d{6}[A-Z\\d]{3}\\z",
					min_length: 13,
					max_length: 13,
					type: "pattern"
				},
				example: "HEGJ820506M10"
			}
		]
	},
	{
		country: { code: "MD", name: "Moldova" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MC", name: "Monaco" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MN", name: "Mongolia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "ME", name: "Montenegro" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MS", name: "Montserrat" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MA", name: "Morocco" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MZ", name: "Mozambique" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MM", name: "Myanmar (Burma)" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "NA", name: "Namibia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "NR", name: "Nauru" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "NP", name: "Nepal" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "NL", name: "Netherlands" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "NZ", name: "New Zealand" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "optional"
		},
		id_numbers: [
			{
				name: "Driver’s License",
				type: "nz_drivers_license",
				category: "drivers_license",
				validation: {
					pattern: "\\A[A-Z]{2}\\d{6}\\z",
					min_length: 8,
					max_length: 8,
					type: "pattern"
				},
				example: "AB123456"
			}
		]
	},
	{
		country: { code: "NI", name: "Nicaragua" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "NE", name: "Niger" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "NG", name: "Nigeria" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "National ID Number",
				type: "ng_nin",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{11}\\z",
					min_length: 11,
					max_length: 11,
					type: "numeric"
				},
				example: "12345678901"
			}
		]
	},
	{
		country: { code: "NU", name: "Niue" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MK", name: "North Macedonia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "NO", name: "Norway" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "OM", name: "Oman" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: [
			{
				name: "Identity Card Number",
				type: "om_civil_id",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{8,9}\\z",
					min_length: 8,
					max_length: 9,
					type: "numeric"
				},
				example: "15358308"
			}
		]
	},
	{
		country: { code: "PK", name: "Pakistan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "PS", name: "Palestinian Territories" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "PA", name: "Panama" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "PG", name: "Papua New Guinea" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "PY", name: "Paraguay" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "PE", name: "Peru" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "PH", name: "Philippines" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "optional"
		},
		id_numbers: [
			{
				name: "PhilSys Number",
				type: "ph_psn",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{12}\\z",
					min_length: 12,
					max_length: 12,
					type: "numeric"
				},
				example: "123456789123"
			}
		]
	},
	{
		country: { code: "PL", name: "Poland" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "optional"
		},
		id_numbers: [
			{
				name: "PESEL Number",
				type: "pl_pesel",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{11}\\z",
					min_length: 11,
					max_length: 11,
					type: "numeric"
				},
				example: "81010200141"
			}
		]
	},
	{
		country: { code: "PT", name: "Portugal" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "QA", name: "Qatar" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "RO", name: "Romania" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: [
			{
				name: "Cod Numeric Personal (CNP)",
				type: "ro_cnp",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{13}\\z",
					min_length: 13,
					max_length: 13,
					type: "numeric"
				},
				example: "2730512054698"
			}
		]
	},
	{
		country: { code: "RU", name: "Russia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "RW", name: "Rwanda" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "WS", name: "Samoa" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SM", name: "San Marino" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SA", name: "Saudi Arabia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: [
			{
				name: "Biṭāgat Al-ʼaḥwāl",
				type: "sa_national_id",
				category: "personal_identification",
				validation: {
					pattern: "\\A[A-Z0-9]{10}\\z",
					min_length: 10,
					max_length: 10,
					type: "alphanumeric"
				},
				example: "2553451234"
			}
		]
	},
	{
		country: { code: "SN", name: "Senegal" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "RS", name: "Serbia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SC", name: "Seychelles" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SL", name: "Sierra Leone" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SG", name: "Singapore" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "National Registration Identity Card",
				type: "sg_nric",
				category: "personal_identification",
				validation: {
					pattern: "\\A[A-Z]\\d{7}[A-Z]\\z",
					min_length: 9,
					max_length: 9,
					type: "pattern"
				},
				example: "S7755666D"
			}
		]
	},
	{
		country: { code: "SK", name: "Slovakia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SI", name: "Slovenia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SB", name: "Solomon Islands" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SO", name: "Somalia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "ZA", name: "South Africa" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Smart ID Card Number",
				type: "za_smart_id",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{13}\\z",
					min_length: 13,
					max_length: 13,
					type: "numeric"
				},
				example: "8001015009087"
			}
		]
	},
	{
		country: { code: "KR", name: "South Korea" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SS", name: "South Sudan" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "ES", name: "Spain" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "optional"
		},
		id_numbers: [
			{
				name: "Documento Nacional de Identidad (DNI)",
				type: "es_dni",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{8}[A-Z]\\z",
					min_length: 9,
					max_length: 9,
					type: "pattern"
				},
				example: "12768106R"
			},
			{
				name: "Número de Identidad de Extranjero (NIE)",
				type: "es_nie",
				category: "tax_id",
				validation: {
					pattern: "\\A[A-Z]\\d{7}[A-Z]\\z",
					min_length: 9,
					max_length: 9,
					type: "pattern"
				},
				example: "A1234567D"
			}
		]
	},
	{
		country: { code: "LK", name: "Sri Lanka" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "KN", name: "St. Kitts & Nevis" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "LC", name: "St. Lucia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "MF", name: "St. Martin" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "VC", name: "St. Vincent & Grenadines" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SD", name: "Sudan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SR", name: "Suriname" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "SE", name: "Sweden" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "Personnummer (PIN)",
				type: "se_pin",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{9,12}\\z",
					min_length: 9,
					max_length: 12,
					type: "numeric"
				},
				example: "7810105333"
			}
		]
	},
	{
		country: { code: "CH", name: "Switzerland" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "ST", name: "São Tomé & Príncipe" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TW", name: "Taiwan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TJ", name: "Tajikistan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TZ", name: "Tanzania" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TH", name: "Thailand" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TL", name: "Timor-Leste" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TG", name: "Togo" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TO", name: "Tonga" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TT", name: "Trinidad & Tobago" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TN", name: "Tunisia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TR", name: "Turkey" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "required"
		},
		id_numbers: [
			{
				name: "T.C. Kimlik No.",
				type: "tr_tc_kimlik",
				category: "personal_identification",
				validation: {
					pattern: "\\A\\d{11}\\z",
					min_length: 11,
					max_length: 11,
					type: "numeric"
				},
				example: "65533318510"
			}
		]
	},
	{
		country: { code: "TM", name: "Turkmenistan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TC", name: "Turks & Caicos Islands" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "TV", name: "Tuvalu" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "UG", name: "Uganda" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "UA", name: "Ukraine" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "AE", name: "United Arab Emirates" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "required",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "GB", name: "United Kingdom" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "US", name: "United States" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "required",
			id_number: "optional"
		},
		id_numbers: [
			{
				name: "Social Security Number (SSN)",
				type: "us_ssn",
				category: "tax_id",
				validation: {
					pattern: "\\A\\d{9}\\z",
					min_length: 9,
					max_length: 9,
					type: "numeric"
				},
				example: "123456789"
			},
			{
				name: "Social Security Number (SSN) Last 4",
				type: "us_ssn_last_4",
				category: "tax_id",
				validation: {
					pattern: "\\A\\d{4}\\z",
					min_length: 4,
					max_length: 4,
					type: "numeric"
				},
				example: "6789"
			}
		]
	},
	{
		country: { code: "UY", name: "Uruguay" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "UZ", name: "Uzbekistan" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "VU", name: "Vanuatu" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "VA", name: "Vatican City" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "VE", name: "Venezuela" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "VN", name: "Vietnam" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "EH", name: "Western Sahara" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "YE", name: "Yemen" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "ZM", name: "Zambia" },
		input_validation: {
			"address.postal_code": "required",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	},
	{
		country: { code: "ZW", name: "Zimbabwe" },
		input_validation: {
			"address.postal_code": "not_supported",
			"address.subdivision": "not_supported",
			id_number: "not_supported"
		},
		id_numbers: []
	}
];
