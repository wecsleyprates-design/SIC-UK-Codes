import { ERROR_CODES } from "#constants/index";
import { StatusCodes } from "http-status-codes";


class EsignApiError extends Error {
    status: StatusCodes;
    errorCode: ERROR_CODES;

    constructor(message: string, httpCode: StatusCodes, errorCode: ERROR_CODES) {
        super(message);
        this.name = "EsignApiError";
        this.status = httpCode;
        this.errorCode = errorCode;
    }
};

export { EsignApiError };
