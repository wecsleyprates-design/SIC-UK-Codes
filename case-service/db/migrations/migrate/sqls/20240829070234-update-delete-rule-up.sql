/* From subscriptions schema */

ALTER TABLE IF EXISTS "subscriptions"."data_subscriptions_history" DROP CONSTRAINT IF EXISTS fk_subscriptions_id;

ALTER TABLE IF EXISTS "subscriptions"."data_subscriptions_history" ADD CONSTRAINT fk_subscriptions_id FOREIGN KEY (subscription_id) REFERENCES subscriptions.data_businesses_subscriptions(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS "subscriptions"."data_businesses_subscriptions" DROP CONSTRAINT IF EXISTS fk_business_id;

ALTER TABLE IF EXISTS "subscriptions"."data_businesses_subscriptions" ADD CONSTRAINT fk_business_id FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS "subscriptions"."data_customers" DROP CONSTRAINT IF EXISTS fk_business_id;

ALTER TABLE IF EXISTS "subscriptions"."data_customers" ADD CONSTRAINT fk_business_id FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE ON UPDATE RESTRICT;


/* From public schema */

ALTER TABLE IF EXISTS data_invites_history DROP CONSTRAINT IF EXISTS fk_invitation_id_data_invites_history;

ALTER TABLE IF EXISTS data_invites_history ADD CONSTRAINT fk_invitation_id_data_invites_history FOREIGN KEY (invitation_id) REFERENCES data_invites(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS data_invites DROP CONSTRAINT IF EXISTS fk_business_id_data_invites;

ALTER TABLE IF EXISTS data_invites ADD CONSTRAINT fk_business_id_data_invites FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE IF EXISTS data_invites DROP CONSTRAINT IF EXISTS fk_data_invites_data_cases_case_id;

ALTER TABLE IF EXISTS data_invites ADD CONSTRAINT fk_data_invites_data_cases_case_id FOREIGN KEY (case_id) REFERENCES data_cases(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS data_business_scores ADD CONSTRAINT fk_business_id_data_businesses FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS rel_business_customer_monitoring DROP CONSTRAINT IF EXISTS business_id_fk;

ALTER TABLE IF EXISTS rel_business_customer_monitoring ADD CONSTRAINT business_id_fk FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE IF EXISTS rel_business_customer_monitoring DROP CONSTRAINT IF EXISTS rel_business_customer_monitoring_business_id_fkey;

ALTER TABLE IF EXISTS rel_business_customer_monitoring ADD CONSTRAINT rel_business_customer_monitoring_business_id_fkey FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS rel_business_owners DROP CONSTRAINT IF EXISTS business_id_fk;

ALTER TABLE IF EXISTS rel_business_owners ADD CONSTRAINT business_id_fk FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE IF EXISTS rel_business_owners DROP CONSTRAINT IF EXISTS rel_business_owners_business_id_fkey;

ALTER TABLE IF EXISTS rel_business_owners ADD CONSTRAINT rel_business_owners_business_id_fkey FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS rel_invite_applicants DROP CONSTRAINT IF EXISTS fk_invitation_id;

ALTER TABLE IF EXISTS rel_invite_applicants ADD CONSTRAINT fk_invitation_id FOREIGN KEY (invitation_id) REFERENCES data_invites(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS data_case_status_history DROP CONSTRAINT IF EXISTS case_id_fk;

ALTER TABLE IF EXISTS data_case_status_history ADD CONSTRAINT case_id_fk FOREIGN KEY (case_id) REFERENCES data_cases(id) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE IF EXISTS data_case_status_history DROP CONSTRAINT IF EXISTS data_case_status_history_case_id_fkey;

ALTER TABLE IF EXISTS data_case_status_history ADD CONSTRAINT data_case_status_history_case_id_fkey FOREIGN KEY (case_id) REFERENCES data_cases(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS rel_risk_cases DROP CONSTRAINT IF EXISTS case_id_fk;

ALTER TABLE IF EXISTS rel_risk_cases ADD CONSTRAINT case_id_fk FOREIGN KEY (case_id) REFERENCES data_cases(id) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE IF EXISTS rel_risk_cases DROP CONSTRAINT IF EXISTS rel_risk_cases_case_id_fkey;

ALTER TABLE IF EXISTS rel_risk_cases ADD CONSTRAINT rel_risk_cases_case_id_fkey FOREIGN KEY (case_id) REFERENCES data_cases(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS data_cases DROP CONSTRAINT IF EXISTS business_id_fk;

ALTER TABLE IF EXISTS data_cases ADD CONSTRAINT business_id_fk FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE ON UPDATE RESTRICT;
