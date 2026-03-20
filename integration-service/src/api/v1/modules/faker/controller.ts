import type { Response } from "#types/index";
import type { Request } from "express";
import { catchAsync } from "#utils/index";
import { fakerService } from "./faker";

export const controller = {
  generateAccoutingFakerData: catchAsync(async (req: Request, res: Response) => {
    const response = await fakerService.insertAccoutingData(req.params.business_id);
    res.jsend.success(response, "Fake acccounting data created successfully");
  }),

  generatePlacesFakerData: catchAsync(async (req: Request, res: Response) => {
    const response = await fakerService.insertPlacesData(req.params.business_id);
    res.jsend.success(response, "Fake google places data created successfully");
  }),

  generatePlaidFakerData: catchAsync(async (req: Request, res: Response) => {
    const response = await fakerService.insertPlaidData(req.params.business_id);
    res.jsend.success(response, "Fake plaid data created successfully");
  }),

  generateVerdataFakerData: catchAsync(async (req: Request, res: Response) => {
    const response = await fakerService.createVerdataData(req.params.business_id);
    res.jsend.success(response, "Fake Verdata record created successfully");
  }),

  generateGoogleBusinessFakerData: catchAsync(async (req: Request, res: Response) => {
    const response = await fakerService.insertFakeGoogleBusinessData(req.params.business_id);
    res.jsend.success(response, "Fake google business data created successfully");
  }),

  generateFakeTaxFilingFakerData: catchAsync(async (req: Request, res: Response) => {
    const response = await fakerService.createTaxFiling(req.params.business_id);
    res.jsend.success(response, "Fake tax filing created successfully");
  }),
};
