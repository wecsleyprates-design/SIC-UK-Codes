// Export the new dynamic Trulioo architecture
export { TruliooBase } from "./common/truliooBase";
export { TruliooBusiness } from "./business/truliooBusiness";
export { TruliooPerson } from "./person/truliooPerson";
export { TruliooFactory } from "./utils/truliooFactory";
// Export middleware
export { verifyTruliooWebhookSignature, errorOnInvalidTruliooSignature, truliooVerify } from "./trulioo.middleware";

// Export types
export * from "./common/types";

// For backward compatibility, export the factory as the main Trulioo class
export { TruliooFactory as Trulioo } from "./utils/truliooFactory";
