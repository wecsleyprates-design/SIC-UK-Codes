/* put field lengths back to original */
alter table integration_data.business_entity_website_data
    alter column url set data type varchar(255),
    alter column category_url set data type varchar(255),
    alter column category_text set data type varchar(512) ,
    alter column category_image_link set data type varchar(512);