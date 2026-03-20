import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/error-codes.constant";

class FakerApiError extends Error {
  status: StatusCodes;
  errorCode: typeof ERROR_CODES[keyof typeof ERROR_CODES];

  constructor(message: string, httpStatus: number, errorCode: typeof ERROR_CODES[keyof typeof ERROR_CODES]) {
    super(message);
    this.name = "FakerApiError";
    this.status = httpStatus;
    this.errorCode = errorCode;
  }
}

export { FakerApiError };
