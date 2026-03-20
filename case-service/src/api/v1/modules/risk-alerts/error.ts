import { ERROR_CODES } from "#constants/index";
import { StatusCodes } from "http-status-codes";


class RiskAlertApiError extends Error {
    status: StatusCodes;
    errorCode: ERROR_CODES;

    constructor(message: string, httpCode: StatusCodes, errorCode: ERROR_CODES) {
        super(message);
        this.name = "RiskAlertApiError";
        this.status = httpCode;
        this.errorCode = errorCode;
    }
};

export { RiskAlertApiError };
