update integration_data.business_entity_address_source
set address_line_1 = '' where address_line_1 is null;
update integration_data.business_entity_address_source
set city = '' where city is null;
update integration_data.business_entity_address_source
set state = '' where state is null;
update integration_data.business_entity_address_source
set postal_code = '' where postal_code is null;

update integration_data.business_entity_review_task
set message = '' where message is null;
update integration_data.business_entity_review_task
set sublabel = '' where sublabel is null;

update integration_data.business_entity_verification
set tin = '' where tin is null;

alter table integration_data.business_entity_address_source
alter column address_line_1 set not null,
alter column city set not null,
alter column state set not null,
alter column postal_code set not null;

alter table integration_data.business_entity_review_task
alter column message set not null,
alter column sublabel set not null;

alter table integration_data.business_entity_verification
alter column tin set not null;