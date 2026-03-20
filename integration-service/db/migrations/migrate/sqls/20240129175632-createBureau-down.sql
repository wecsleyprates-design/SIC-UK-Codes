/* Replace with your SQL commands */
drop table if exists integration_data.bureau_credit_score;

delete from integrations.rel_tasks_integrations where id = 41;
delete from integrations.core_integrations_platforms where code = 'equifax';
delete from integrations.core_tasks where id = 11;
delete from integrations.core_categories where code = 'bureau';
