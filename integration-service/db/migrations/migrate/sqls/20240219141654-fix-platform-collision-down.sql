/* Replace with your SQL commands */
--Update id=41 to set platform_id=17 (Equifax) for task_category=11 (Fetch Bureau Score)
update integrations.rel_tasks_integrations set platform_id=16 where id=41;

--Set Platform=16 (Middesk) where task_category=12 (Fetch Business Verification)
update integrations.rel_tasks_integrations set platform_id=null where id=42;

delete from integrations.core_integrations_platforms where id=17;
