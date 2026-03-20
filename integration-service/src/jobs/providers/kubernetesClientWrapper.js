// TODO: Migrate codebase to ESM
/**
 * Wrapper to load @kubernetes/client-node ESM module from CommonJS context.
 * 
 * The @kubernetes/client-node package v1.x is pure ESM and cannot be directly
 * required() from our CommonJS compiled code. This wrapper uses dynamic import()
 * to bridge the gap without requiring codebase-wide ESM migration.
 * 
 * @see https://nodejs.org/api/esm.html#interoperability-with-commonjs
 */

let k8sClient = null;

async function loadKubernetesClient() {
  if (k8sClient) {
    return k8sClient;
  }
  
  try {
    // Use eval to bypass build system and ensure dynamic import
    const importCode = 'import("@kubernetes/client-node")';
    k8sClient = await eval(importCode);
    return k8sClient;
  } catch (error) {
    throw new Error(`Failed to load Kubernetes client: ${error.message}`);
  }
}

module.exports = { loadKubernetesClient };
