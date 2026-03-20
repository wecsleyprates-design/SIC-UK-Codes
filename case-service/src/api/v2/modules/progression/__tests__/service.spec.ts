import { ProgressionService } from "../service";
import { Progression } from "@joinworth/types/dist/types/cases";

describe("ProgressionService.getProgression", () => {
  const businessID = "11111111-1111-1111-1111-111111111111";
  const query = { invitation_id: "22222222-2222-2222-2222-222222222222", stages_to_skip: [], updated_stages: [] };

  it("returns 200 when businessID is a valid GUID and auth header provided", async () => {
    const result = await ProgressionService.getProgression(
      { business_id: businessID },
      query as Progression.QueryParams,
      { authorization: "Bearer token" }
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data?.business_id).toBe(businessID);
  });

  it("returns 401 when auth header is missing", async () => {
    const result = await ProgressionService.getProgression(
      { business_id: businessID },
      query as Progression.QueryParams,
      {}
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
  });
});
