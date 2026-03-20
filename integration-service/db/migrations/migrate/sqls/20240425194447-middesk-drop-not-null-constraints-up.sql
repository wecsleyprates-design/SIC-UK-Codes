alter table integration_data.business_entity_address_source
alter column address_line_1 drop not null,
alter column city drop not null,
alter column state drop not null,
alter column postal_code drop not null;

alter table integration_data.business_entity_review_task
alter column message drop not null,
alter column sublabel drop not null;

alter table integration_data.business_entity_verification
alter column tin drop not null;