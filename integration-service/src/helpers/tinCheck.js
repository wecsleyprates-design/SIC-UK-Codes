import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";
import convert from "xml-js";
import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";

class TinCheckError extends Error {
	constructor(message, statusCode, httpStatusCode) {
		super(message);
		this.name = "TinCheckError";
		this.statusCode = statusCode;
		this.httpStatusCode = httpStatusCode;
	}
}

/**
 * This is TIN check helper function which checks whether the TIN entered is valid or not
 * @param {object} body
 * @returns resposne
 */
export const tinCheck = async body => {
	try {
		const data = `
		<x:Envelope
			xmlns:x="http://schemas.xmlsoap.org/soap/envelope/"
			xmlns:pvs="http://www.TinCheck.com/WebServices/PVSService/">
			<x:Header/>
			<x:Body>
				<pvs:ValidateTinNameAddressListMatch>
					<pvs:TinName>
						<pvs:TIN>${body.tin}</pvs:TIN>
						<pvs:LName>${body.companyName}</pvs:LName>
						<pvs:FName>?</pvs:FName>
						<pvs:Encryption></pvs:Encryption>
						<pvs:Giin></pvs:Giin>
					</pvs:TinName>
					<pvs:CurUser>
						<pvs:UserID></pvs:UserID>
						<pvs:UserLogin>${envConfig.TIN_LOGIN_ID}</pvs:UserLogin>
						<pvs:UserPassword>${envConfig.TIN_LOGIN_PASSWORD}</pvs:UserPassword>
						<pvs:UserEncryption>?</pvs:UserEncryption>
					</pvs:CurUser>
					<pvs:USPSAddress>
						<pvs:Address1>${body.address1}</pvs:Address1>
						<pvs:Address2>${body.address2}</pvs:Address2>
						<pvs:City>${body.city}</pvs:City>
						<pvs:State>${body.state}</pvs:State>
						<pvs:Zip5>${body.zip}</pvs:Zip5>
						<pvs:Zip4>?</pvs:Zip4>
					</pvs:USPSAddress>
				</pvs:ValidateTinNameAddressListMatch>
			</x:Body>
		</x:Envelope>
		`;

		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: "https://www.tincheck.com/pvsws/pvsservice.asmx",
			headers: {
				SOAPAction: "http://www.TinCheck.com/WebServices/PVSService/ValidateTinNameAddressListMatch",
				"Content-Type": "application/xml"
			},
			data
		};

		const xmlresponse = await axios.request(config);
		const jsonResult = convert.xml2json(xmlresponse.data, { compact: true, trim: true, spaces: 2 });

		// Parse the JSON string into a JavaScript object
		const response = JSON.parse(jsonResult);

		return response;
	} catch (error) {
		logger.error(`error: ${error.message}`);
		throw new TinCheckError("Something went wrong in the TIN check function", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
	}
};
