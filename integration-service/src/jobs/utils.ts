import { logger } from "#helpers/logger";

export const getJobName = (jobType: string, jobId: string) => {
    const jobName = `${jobType}-${jobId}`;
    return `${sanitizeK8sName(jobName)}`;
};

// Kuberneters-specific utils
// Convert a string to a valid Kubernetes name
// https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-label-names
export const sanitizeK8sName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/_/g, '-')           // Replace underscores with hyphens
      .replace(/[^a-z0-9-]/g, '-')  // Replace any other invalid chars with hyphens
      .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
      .replace(/-+/g, '-');         // Replace multiple consecutive hyphens with single hyphen
  };

export async function getCurrentPodImage(): Promise<string | undefined> {
  try {
    // Check if we're running in a pod
    if (!process.env.KUBERNETES_SERVICE_HOST) {
      logger.debug("Not running in Kubernetes, skipping pod image detection");
      return undefined;
    }
    
    // Use wrapper to handle ES module loading
    const { loadKubernetesClient } = require("./providers/kubernetesClientWrapper");
    const k8sClient = await loadKubernetesClient();
    const { KubeConfig, CoreV1Api } = k8sClient;
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromCluster();
    const coreV1Api = kubeConfig.makeApiClient(CoreV1Api);

    const podName = process.env.POD_NAME;
    const namespace = "services";

    if (!podName) {
      logger.warn("Pod name not found in environment variables, cannot determine current pod image");
      return undefined;
    }
    
    const pod = await coreV1Api.readNamespacedPod({ name: podName, namespace });
    const container = pod.spec?.containers?.[0];
    if (container?.image) {
      return container.image;
    }

    logger.warn("Could not determine current pod image");
    return undefined;
  } catch (error: any) {
    logger.error(`Failed to get current pod image: ${JSON.stringify({
      error: error.message,
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
      body: error.body,
      stack: error.stack
    })}`);
    return undefined;
  }
}
