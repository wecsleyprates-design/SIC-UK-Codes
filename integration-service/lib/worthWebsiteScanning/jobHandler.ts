import { logger } from "#helpers/logger";
import { JobTask } from "#workers/types";
import { getWorthWebsiteScanningService } from "./worthWebsiteScanning";

export async function handleWebsiteScan(job: JobTask): Promise<void> {
  logger.info(`🌐 Starting website scanning job ${job.id} for business ${job.businessId} and task ${job.taskId}`);
  
  const { websiteUrl } = job.payload;
  
  if (!websiteUrl) {
    throw new Error("websiteUrl is required for website scanning");
  }

  if (!job.businessId) {
    throw new Error("businessId is required for website scanning");
  }
  
  const websiteScanService = await getWorthWebsiteScanningService(job.businessId as any);
  
  const websiteDetails = await websiteScanService.scanBusinessWebsite(websiteUrl);

  if(job.taskId) {
    await websiteScanService.saveWebsiteDetails(job.taskId, websiteDetails);
  }
  
  logger.info(`✅ Website scanning completed successfully for job ${job.id} for business ${job.businessId} and task ${job.taskId}`);
}
