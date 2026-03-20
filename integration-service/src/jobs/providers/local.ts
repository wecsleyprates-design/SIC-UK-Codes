/**
 * Local Development Job Provider
 * 
 * This provider runs jobs directly in the current process for local development.
 */

import { logger } from "#helpers/logger";
import { randomUUID } from "crypto";
import { IJobManager, JobRequest, JobResponse, JobStatus, JobProvider, JobConfig } from "../types";
import { getJobName } from "../utils";

export class LocalJobProvider implements IJobManager {
  private config: JobConfig;

  constructor(config: JobConfig) {
    this.config = config;
  }

  async runJob(request: JobRequest): Promise<JobResponse | null> {
    const jobId = randomUUID();
    const jobName = getJobName(request.jobType, jobId);

    const success = await this.executeJobAsync(jobId, jobName, request);
    if (!success) {
      return null;
    }

    return {
      jobId,
      jobName,
      createdAt: new Date(),
      provider: JobProvider.LOCAL
    };
  }

  private async executeJobAsync(jobId: string, jobName: string, request: JobRequest): Promise<boolean> {
    try {
      const { executeJob } = await import("#workers/jobWorker");
      
      // Pass job configuration directly (no environment variable conflicts)
      const jobConfig = {
        jobType: request.jobType,
        payload: request.payload || {},
        customerId: request.customerId || "",
        businessId: request.businessId || "",
        requestId: request.requestId || jobId,
        taskId: request.taskId || ""
      };

      await executeJob(jobConfig);

      logger.info(`✅ Local job completed: ${jobName}`);
      return true;
    } catch (error: any) {
      logger.error(`❌ Local job failed ${jobName} ${error.message}`);
      return false;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    // We can't really cancel local jobs once they're running
    // since they're running in the current process
    logger.info(`🛑 Local job cancelled: ${jobId}`);
    return true;
  }
}
