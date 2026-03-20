import { Router } from "express";
import businessRoutes from "./modules/businesses/routes";
import caseRoutes from "./modules/case-management/routes";
import coreRoutes from "./modules/core/routes";
import customerRoutes from "./modules/customer/routes";
import dashboardRoutes from "./modules/dashboard/routes";
import esignRoutes from "./modules/esign/routes";
import onboardingRoutes from "./modules/onboarding/routes";
import riskAlertRoutes from "./modules/risk-alerts/routes";
import riskMonitoringRoutes from "./modules/risk-monitoring/riskMonitoringRoutes";
import subscriptionRoutes from "./modules/subscriptions/routes";
import applicationEditRoutes from "./modules/application-edits/routes";
import caseDecisioningRoutes from "./modules/case-decisioning/routes";
import applicantConfigRoutes from "./modules/applicant-config/routes";

const router = new Router();

router.get("/", (req, res) => {
	res.jsend.success("Hello v1 API");
});

router.use(businessRoutes);
router.use(caseRoutes);
router.use(coreRoutes);
router.use(customerRoutes);
router.use(dashboardRoutes);
router.use(esignRoutes);
router.use(onboardingRoutes);
router.use(riskAlertRoutes);
router.use(riskMonitoringRoutes);
router.use(subscriptionRoutes);
router.use(applicationEditRoutes);
router.use(caseDecisioningRoutes);
router.use(applicantConfigRoutes);

export default router;
