import { StatusCodes, ReasonPhrases } from "http-status-codes";
import { Progression } from "@joinworth/types/dist/types/cases";
export class ProgressionService {
  /**
   * Basic placeholder implementation.
   * Succeeds if a business_id is supplied and the caller is authenticated.
   * Throws a error otherwise.
   */
  static async getProgression(
    { business_id }: Progression.Params,
    query: Progression.QueryParams,
    headers: { authorization?: string }
  ): Promise<Progression.ProgressionResult> {
    if (!business_id) {
      return {
        success: false,
        status: StatusCodes.BAD_REQUEST,
        message: "business_id is required",
      };
    }

    if (!headers.authorization) {
      return {
        success: false,
        status: StatusCodes.UNAUTHORIZED,
        message: ReasonPhrases.UNAUTHORIZED,
      };
    }

    // Success response
    return {
      success: true,
      status: StatusCodes.OK,
      data: {
        business_id,
        query,
      },
    };
  }
}
