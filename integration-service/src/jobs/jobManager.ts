import { logger } from "#helpers/logger";
import { redis, redisConnect, redisConfig, isHealthy } from "#helpers/redis";
import { IJobManager, JobRequest, JobResponse, JobConfig, JobProvider } from "./types";
import { LocalJobProvider } from "./providers/local";
import { JOB_STATUS } from "#workers/types";

export class JobManager implements IJobManager {
  private provider: IJobManager;
  private config: JobConfig;
  private redisInitialized: boolean = false;

  constructor(config?: JobConfig) {
    const defaultConfig: JobConfig = {
      provider: JobProvider.KUBERNETES
    };

    this.config = config ? config : defaultConfig;

    const isLocalDevelopment = process.env.NODE_ENV === "development";
    
    if (isLocalDevelopment) {
      this.config = {
        ...this.config,
        provider: JobProvider.LOCAL
      };
    }

    this.provider = this.createProvider();
  }

  private createProvider(): IJobManager {
    switch (this.config.provider) {
      case JobProvider.KUBERNETES:
        const { KubernetesJobProvider } = require("./providers/kubernetes");
        return new KubernetesJobProvider(this.config);
      case JobProvider.LOCAL:
        return new LocalJobProvider(this.config);
      default:
        throw new Error(`Unsupported job provider: ${this.config.provider}`);
    }
  }

  async runJob(request: JobRequest): Promise<JobResponse | null> {
    const response = await this.provider.runJob(request);

    if (!response) {
      logger.error(`❌ Failed to create job: ${request.jobType}`);
      return null;
    }

    if (this.config.provider !== JobProvider.LOCAL) {
      await this.updateJobStatus(response.jobId, JOB_STATUS.PENDING);
      
      logger.info({
        jobId: response.jobId,
        jobName: response.jobName,
        provider: response.provider
      }, `✅ Job started successfully: ${response.jobName}`);
    }

    return response;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    if (!this.provider.cancelJob) {
      throw new Error(`Job cancellation not supported by ${this.config.provider} provider`);
    }
    
    const response = await this.provider.cancelJob(jobId);
    await this.updateJobStatus(jobId, JOB_STATUS.CANCELLED);
    return response;
  }

  async updateJobStatus(jobId: string, status: string): Promise<void> {
    const redisKey = `job-${jobId}`;
    try {
      const redisAvailable = await this.ensureRedisInitialized();
      if (!redisAvailable) {
        return;
      }
      
      await redis.set(redisKey, status);
      logger.info(`📝 ${redisKey} status updated to: ${status}`);
    } catch (error) {
      logger.error(`❌ Failed to update job ${redisKey} status ${error}`);
      // Don't throw - job status update failure shouldn't fail the job
    }
  }

  async getJobStatus(jobId: string): Promise<string | undefined> {
    const redisKey = `job-${jobId}`;
    try {
      const redisAvailable = await this.ensureRedisInitialized();
      if (!redisAvailable) {
        return undefined;
      }
      
      const status = await redis.get(redisKey);
      return status?.toString();
    } catch (error) {
      logger.error(`❌ Failed to get ${redisKey} status ${error}`);
      return undefined;
    }
  }

  async monitorJob(
    jobId: string, 
    options: {
      maxWaitTime?: number; // in milliseconds, default 15 minutes
      pollInterval?: number; // in milliseconds, default 5 seconds
      onStatusUpdate?: (status: string) => void;
    } = {}
  ): Promise<string | undefined> {
    if(this.config.provider === JobProvider.LOCAL) {
      // Local provider does not support monitoring since it just runs the job in the current process
      return;
    }

    const {
      maxWaitTime = 15 * 60 * 1000, // 15 minutes default
      pollInterval = 5000, // 5 seconds default
      onStatusUpdate
    } = options;

    const startTime = Date.now();
    let jobStatus: string | undefined;

    logger.info({
      maxWaitTime,
      pollInterval
    }, `🔍 Starting to monitor job: ${jobId}`);

    while ((Date.now() - startTime) < maxWaitTime) {
      jobStatus = await this.getJobStatus(jobId);

      if (!jobStatus) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      if (onStatusUpdate) {
        onStatusUpdate(jobStatus);
      }

      if (jobStatus !== JOB_STATUS.PENDING && jobStatus !== JOB_STATUS.RUNNING) {
        return jobStatus;
      } else {
        // Job is still running or pending, wait and check again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    const errorMessage = `Job ${jobId} timed out after ${maxWaitTime}ms`;
    logger.error(`⏰ ${errorMessage}`);
    throw new Error(errorMessage);
  }

  private async ensureRedisInitialized(): Promise<boolean> {
    if (this.redisInitialized) {
      return true;
    }

    try {
      await isHealthy();
      this.redisInitialized = true;
      return true;
    } catch (error) {
      try {
        redisConnect(redisConfig, logger);
        this.redisInitialized = true;
        return true;
      } catch (initError) {
        logger.warn(`⚠️ Failed to initialize Redis for JobManager: ${initError}`);
        return false;
      }
    }
  }
}

export function createJobManager(config?: JobConfig): JobManager {
  return new JobManager(config);
}

export const jobManager = new JobManager();
