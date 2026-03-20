import { DISPOSABLE_DOMAINS, kafkaEvents, kafkaTopics, SUBROLES } from "#constants";
import { producer } from "#helpers";
import type { ApplicantMapperEgg, MapperField } from "#types";
import { BusinessInvites } from "../../businessInvites";
import { MapperError, type Mapper } from "../../mapper";
import { assertTruthy, parseBool } from "../utils";

export async function validateApplicantFields(mapper: Mapper, mappedFields: MapperField[]): Promise<void> {
	const applicantEgg = mappedFields.reduce((acc, field) => {
		acc[field.column] = field.value;
		return acc;
	}, {} as ApplicantMapperEgg);

	if (applicantEgg.send_invitation && applicantEgg.generate_invite_link) {
		throw new MapperError("Cannot send invitation and generate invite link at the same time");
	}

	if (
		(applicantEgg.send_invitation || applicantEgg.generate_invite_link) &&
		(!applicantEgg.applicant_email || !applicantEgg.applicant_first_name || !applicantEgg.applicant_last_name)
	) {
		throw new MapperError("Applicant details not found");
	}
}

export async function processApplicantFields(mapper: Mapper, fields: MapperField[]) {
	const metadata = mapper.getAdditionalMetadata();
	const applicantEgg = fields.reduce((acc, field) => {
		if (field.table === "applicant") {
			acc[field.column] = field.value;
		}
		return acc;
	}, {} as ApplicantMapperEgg);

	if (applicantEgg.send_invitation) {
		const invitation = await BusinessInvites.create({
			business_id: metadata.data_businesses.id,
			customer_id: metadata.customerID,
			created_by: metadata.userID
		});

		const isNoLogin = await BusinessInvites.resolveIsNoLoginForCustomer(metadata.customerID);
		let kafkaMessage: any = {
			create_business: true,
			business_name: metadata.data_businesses.name,
			business_id: metadata.data_businesses.id,
			customer_id: metadata.customerID,
			customer_user_id: metadata.userID,
			invitation_id: invitation.id,
			is_no_login: isNoLogin,
			new_applicants: [
				{
					first_name: applicantEgg.applicant_first_name,
					last_name: applicantEgg.applicant_last_name,
					email: applicantEgg.applicant_email
				}
			]
		};
		const payload = {
			topic: kafkaTopics.USERS_NEW,
			messages: [{ key: metadata.data_businesses.id, value: { ...kafkaMessage, event: kafkaEvents.INVITE_APPLICANT } }]
		};

		await producer.send(payload);

		mapper.addAdditionalMetadata({ applicant: kafkaMessage });
	}

	if (applicantEgg.generate_invite_link) {
		// when given the following fields, this will create the applicant user
		// for the newly created business and case and return an invite link.
		const businessInvite = await BusinessInvites.inviteBusiness(
			metadata.customerID,
			{
				existing_business_id: metadata.data_businesses.id,
				case_id: metadata.data_cases[0]?.id,
				applicants: [
					{
						first_name: applicantEgg.applicant_first_name,
						last_name: applicantEgg.applicant_last_name,
						email: applicantEgg.applicant_email,
						subrole_code: applicantEgg.applicant_subrole_code
					}
				]
			},
			{
				user_id: metadata.userID
			},
			// files
			[],
			// syncBusinessInvitation
			true,
			// sendOnboardApplicantEmail
			false
		);
		mapper.addAdditionalMetadata({ applicant: businessInvite });
	}
}

export function getApplicantFields(): MapperField[] {
	return [
		{
			column: "applicant_id",
			table: "applicant",
			alternate: ["applicantid"],
			description: "Associate an existing applicant Id with this business",
			private: true
		},
		{
			column: "send_invitation",
			table: "applicant",
			description: "Send an Invitation to the applicant",
			required: false,
			sanitize: async (_, value) => parseBool(value),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "boolean" && [true, false].includes(field.value), field)
		},
		{
			column: "applicant_first_name",
			table: "applicant",
			description: "Applicant first name",
			required: false,
			sanitize: async (_, str) => (str as string).toString().substring(0, 50).trim(),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "string" && field.value.length <= 50 && field.value.length >= 0, field)
		},
		{
			column: "applicant_last_name",
			table: "applicant",
			description: "Applicant last name",
			required: false,
			sanitize: async (_, str) => (str as string).toString().substring(0, 50).trim(),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "string" && field.value.length <= 50 && field.value.length >= 0, field)
		},
		{
			column: "applicant_email",
			table: "applicant",
			description: "Applicant email",
			required: false,
			sanitize: async (_, str) => (str as string).toString().substring(0, 100).trim().toLowerCase(),
			validate: async (_, field) =>
				assertTruthy(
					typeof field.value === "string" &&
						field.value.length <= 100 &&
						field.value.length >= 0 &&
						isValidEmail(field.value)
				)
		},
		{
			column: "generate_invite_link",
			table: "applicant",
			description: "Generate and return an invite link for the applicant instead of asynchronously sending an email",
			required: false,
			sanitize: async (_, value) => parseBool(value),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "boolean" && [true, false].includes(field.value), field)
		},
		{
			column: "applicant_subrole_code",
			table: "applicant",
			description: "The subrole code of the applicant (owner or user)",
			required: false,
			sanitize: async (_, value) => value.toString().toLowerCase().trim(),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "string" && [SUBROLES.OWNER, SUBROLES.USER].includes(field.value), field)
		}
	];
}

function isValidEmail(email: string) {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const isValidStringPattern = emailRegex.test(email);
	if (!isValidStringPattern) return false;
	const domain = email.substring(email.lastIndexOf("@") + 1).toLowerCase();
	const disposableDomainsList = new Set(DISPOSABLE_DOMAINS);
	return !disposableDomainsList.has(domain);
}
