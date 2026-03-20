import { logger } from "#helpers/logger";
import { randomUUID } from "crypto";
import { JobConfig, JobTask } from "./types";
import { jobHandlers } from "../jobs/handlers";
import { JOB_STATUS } from "./types";
import { redis, redisConfig, redisConnect } from "#helpers/index";

/**
 * Generic Job Worker
 * NOTE: This is different from the Bull Queue worker
 * This should be used when you need to execute memory/cpu intensive jobs in their own ephemeral environment
 * 
 * To add a new job type:
 * 1. Create a jobHandler.ts file in the appropriate module (e.g., lib/yourModule/jobHandler.ts)
 * 2. Implement your business logic in a handler function in corresponding module (e.g., handleFileUpload in file/ module)
 * 3. Export it in src/jobs/handlers/index.ts
 */

const hasValidRedisConfig = redisConfig.conn.url || (redisConfig.conn.host && redisConfig.conn.port);

if (!hasValidRedisConfig) {
  logger.warn("⚠️ Redis configuration is incomplete - job will continue without Redis status tracking");
} else {
  try {
    redisConnect(redisConfig, logger);
  } catch (error) {
    logger.warn(`⚠️ Failed to initialize Redis connection - job will continue without Redis status tracking: ${error}`);
  }
}

async function executeJob(jobConfig?: JobConfig): Promise<void> {
  let jobTask: JobTask | undefined;

  let config: JobConfig;
    
  if (jobConfig) {
    // Local provider passes config directly
    config = jobConfig;
  } else {
    // Other providers use environment variable
    const jobConfigStr = process.env.JOB_CONFIG;
    if (!jobConfigStr) {
      throw new Error("JOB_CONFIG environment variable is required");
    }
    config = JSON.parse(jobConfigStr);
  }

  const requestId = config.requestId || randomUUID();

  if (!config.jobType) {
    throw new Error("jobType is required in job configuration");
  }

  jobTask = {
    id: requestId,
    type: config.jobType,
    payload: config.payload || {},
    customerId: config.customerId,
    businessId: config.businessId,
    taskId: config.taskId
  };

  logger.info(`📋 Executing job: ${jobTask.type} ${JSON.stringify({ 
    jobType: jobTask.type,
    customerId: jobTask.customerId,
    taskId: jobTask.taskId
  })}`);
  
  try {
    await updateJobStatus(jobTask.id, JOB_STATUS.RUNNING);

    await routeToJobHandler(jobTask);

    await updateJobStatus(jobTask.id, JOB_STATUS.COMPLETED);

    logger.info(`✅ Job completed successfully: ${jobTask.type}`);
    
    if (!jobConfig) { // If running locally, do not shut down service
      process.exit(0);
    }
  } catch (error: any) {
    if (jobTask?.id) {
      await updateJobStatus(jobTask.id, JOB_STATUS.FAILED);
    }
    
    logger.error(error, `❌ Job ${jobTask.id} failed ${error.message}`);
    if (!jobConfig) { // If running locally, do not shut down service
      process.exit(1);
    }
  }
}

/**
 * Route to the appropriate job handler based on job type
 * 
 * This dynamically imports and calls handlers from their respective modules.
 * Add new job types in src/jobs/handlers/index.ts
 */
async function routeToJobHandler(jobTask: JobTask): Promise<void> {
  const handlerName = jobHandlers[jobTask.type as keyof typeof jobHandlers];
  
  if (!handlerName) {
    const supportedTypes = Object.keys(jobHandlers).join(", ");
    throw new Error(`Unknown job type: ${jobTask.type}. Supported types: ${supportedTypes}`);
  }
  
  // Import the specific handler function
  const handlers = await import("../jobs/handlers");
  const handler = handlers[handlerName as keyof typeof handlers];
  
  if (typeof handler !== 'function') {
    throw new Error(`Handler ${handlerName} is not a function`);
  }
  
  await handler(jobTask);
}

async function updateJobStatus(jobId: string, status: string): Promise<void> {
  if (!hasValidRedisConfig) {
    return;
  }

  const redisKey = `job-${jobId}`;
  try {
    await redis.set(redisKey, status);
    logger.info(`📝 Job ${redisKey} status updated to: ${status}`);
  } catch (error) {
    logger.warn(`⚠️ Failed to update job ${jobId} status to Redis: ${error}`);
    // Don't throw - job status update failure shouldn't fail the job
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});

// Entry point for kubernetes job execution
// This will only be true when this file is executed directly, not when imported as a module
if (require.main === module) {
  executeJob().catch((error) => {
    logger.error("💥 Unhandled error:", error);
    process.exit(1);
  });
}

export { executeJob, JobTask };
