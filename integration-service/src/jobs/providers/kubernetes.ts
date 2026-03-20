import { logger } from "#helpers/logger";
import { randomUUID } from "crypto";
import { IJobManager, JobRequest, JobResponse, JobProvider, JobConfig } from "../types";
import { getCurrentPodImage, getJobName, sanitizeK8sName } from "../utils";
import { envConfig } from "#configs";
import { loadKubernetesClient } from './kubernetesClientWrapper';
import type { BatchV1Api } from '@kubernetes/client-node';
import { SERVICE_MODES } from "#constants";

export class KubernetesJobProvider implements IJobManager {
	private batchV1Api: BatchV1Api | null = null;
	private namespace: string;
	private appImage: string;
	private defaultResources: {
		requests: { cpu: string; memory: string };
		limits: { cpu: string; memory: string };
	};

	constructor(config: JobConfig) {
		this.namespace = config.kubernetes?.namespace || "services";

		this.appImage = config.kubernetes?.appImage || "";

		this.defaultResources = config.kubernetes?.defaultResources || {
			requests: { cpu: "250m", memory: "1024Mi" },
			limits: { cpu: "1000m", memory: "2048Mi" }
		};

		// Initialize will be called when the client is first used
		this.batchV1Api = null;
	}

	private async initializeKubernetesClient(): Promise<BatchV1Api> {
		if (this.batchV1Api) {
			return this.batchV1Api;
		}

		try {
			const { KubeConfig, BatchV1Api } = await loadKubernetesClient();
			const kubeConfig = new KubeConfig();

			if (process.env.KUBERNETES_SERVICE_HOST) {
				kubeConfig.loadFromCluster();
			} else {
				kubeConfig.loadFromDefault();
			}

			this.batchV1Api = kubeConfig.makeApiClient(BatchV1Api);
			if (!this.batchV1Api) {
				throw new Error("Failed to create BatchV1Api client");
			}

			return this.batchV1Api;
		} catch (error: any) {
			logger.error(`❌ Failed to initialize Kubernetes client`, error);
			throw error;
		}
	}

	async runJob(request: JobRequest): Promise<JobResponse | null> {
		const batchV1Api = await this.initializeKubernetesClient();
		const jobId = randomUUID();
		const jobName = getJobName(request.jobType, jobId);
		const timestamp = new Date().toISOString();

		let jobImage = this.appImage;
		if (!jobImage) {
			const currentPodImage = await getCurrentPodImage();
			if (currentPodImage) {
				jobImage = currentPodImage;
			}
		}

		const resources = request.metadata?.resources || this.defaultResources;

		const datadogTags = {
			"tags.datadoghq.com/env": envConfig.DD_ENV || "dev",
			"tags.datadoghq.com/service": "integration-service-jobs",
			"tags.datadoghq.com/version": "1.0",
			"tags.datadoghq.com/job-id": jobId,
			"tags.datadoghq.com/job-type": request.jobType
		};

    const jobManifest = {
      apiVersion: "batch/v1",
      kind: "Job",
      metadata: {
        name: jobName,
        namespace: this.namespace,
        labels: {
          "app": "integration-service-jobs",
          "component": "k8s-job",
          "job-type": sanitizeK8sName(request.jobType),
          "job-id": sanitizeK8sName(jobId),
          ...datadogTags
        },
        annotations: {
          "integration-service/created-at": timestamp,
          "integration-service/job-type": request.jobType,
          "integration-service/request-id": request.requestId || jobId,
          "integration-service/task-id": request.taskId || "",
        }
      },
      spec: {
        ttlSecondsAfterFinished: 3600, // Clean up after 1 hour
        backoffLimit: 1,
        activeDeadlineSeconds: 900, // 15 minutes default
        completions: 1, // Single completion job
        parallelism: 1, // Run one pod at a time
        template: {
          metadata: {
            labels: {
              "app": "integration-service-jobs",
              "component": "k8s-job",
              "job-type": sanitizeK8sName(request.jobType),
              "job-id": sanitizeK8sName(jobId),
              ...datadogTags,
              "admission.datadoghq.com/enabled": "true"
            },
            annotations: {
              "admission.datadoghq.com/js-lib.version": "v5.10.0"
            }
          },
          spec: {
            restartPolicy: "Never",
            containers: [
              {
                name: `job-${sanitizeK8sName(request.jobType)}-${jobId.slice(0, 8)}`,
                image: jobImage,
                command: ["npm"],
                args: ["run", "start-job-worker"],
                workingDir: "/usr/src/app",
                env: [
                  {
                    name: "JOB_CONFIG",
                    value: JSON.stringify({
                      jobType: request.jobType,
                      payload: request.payload || {},
                      customerId: request.customerId || "",
                      businessId: request.businessId || "",
                      requestId: request.requestId || jobId,
                      taskId: request.taskId || "",
                    })
                  },
                  // Pass-through all environment variables from the main app
                  ...Object.entries(process.env).map(([key, value]) => ({
                    name: key,
                    value: String(value || "")
                  })),
                  {
                    name: "DD_SERVICE",
                    value: "integration-service-jobs"
                  },
                  {
                    name: "CONFIG_SERVICE_MODE",
                    value: SERVICE_MODES.JOB
                  },
                ],
                resources: resources,
                terminationMessagePath: "/dev/termination-log",
                terminationMessagePolicy: "File"
              }
            ],
            terminationGracePeriodSeconds: 30
          }
        }
      }
    };

		try {
			await batchV1Api.createNamespacedJob({
				namespace: this.namespace,
				body: jobManifest
			});

			return {
				jobId,
				jobName,
				createdAt: new Date(),
				provider: JobProvider.KUBERNETES,
				metadata: {
					namespace: this.namespace,
					k8sJobName: jobName
				}
			};
		} catch (error: any) {
			logger.error(`❌ Failed to create Kubernetes job`, error);
			return null;
		}
	}

	async cancelJob(jobId: string): Promise<boolean> {
		const batchV1Api = await this.initializeKubernetesClient();

		const jobName = jobId.includes("-") ? jobId : `${jobId}`;
		await batchV1Api.deleteNamespacedJob({ name: jobName, namespace: this.namespace });
		logger.info(`🗑️ Cancelled Kubernetes job: ${jobName}`);
		return true;
	}
}
