import { ICreditReportRequest } from "./types";

/**
Returns the base request payload for the Equifax API. Meant to be extended/mutated for specific requests
*/
export function getBasePayload(): Partial<ICreditReportRequest> &
	Required<Pick<ICreditReportRequest, "customerConfiguration">> {
	return {
		consumers: {},
		customerConfiguration: {
			equifaxUSConsumerCreditReport: {
				pdfComboIndicator: "Y",
				memberNumber: "999XX12345",
				securityCode: "@U2",
				customerCode: "IAPI",
				ECOAInquiryType: "Individual",
				optionalFeatureCode: [],
				multipleReportIndicator: "F",
				productCodes: [],
				fileSelectionLevel: "B",
				rawReportRequired: false,
				codeDescriptionRequired: true,
				models: [{ identifier: "05402" }],
				endUserInformation: {
					endUsersName: "Worth AI",
					permissiblePurposeCode: "01"
				}
			}
		}
	};
}
