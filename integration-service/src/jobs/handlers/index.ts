/**
 * Central registry for all job handlers.
 * This allows the job worker to dynamically import handlers from their respective modules.
 */

export { handleWebsiteScan } from "#lib/worthWebsiteScanning/jobHandler";

export const jobHandlers = {
  WEBSITE_SCAN: "handleWebsiteScan",
} as const;

export type JobHandlerName = keyof typeof jobHandlers;
