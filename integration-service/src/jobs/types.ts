export interface IJobManager {
  runJob(request: JobRequest): Promise<JobResponse | null>;
  cancelJob?(jobId: string): Promise<boolean>;
}

export interface JobRequest {
  jobType: string;
  payload?: any;
  customerId?: string;
  businessId?: string;
  requestId?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

export interface JobConfig {
  provider: JobProvider;
  kubernetes?: {
    namespace: string;
    appImage: string;
    defaultResources: {
      requests: { cpu: string; memory: string };
      limits: { cpu: string; memory: string };
    };
  };
  local?: {
    maxConcurrency: number;
    defaultTimeout: number;
    logLevel: "debug" | "info" | "warn" | "error";
  };
}

export interface JobResponse {
  jobId: string;
  jobName: string;
  createdAt: Date;
  provider: JobProvider;
  metadata?: Record<string, any>;
}

export enum JobStatus {
  PENDING = "pending",
  RUNNING = "running", 
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export enum JobPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent"
}

export enum JobProvider {
  KUBERNETES = "kubernetes",
  BULL = "bull",
  DIRECT = "direct",
  LOCAL = "local"
}
