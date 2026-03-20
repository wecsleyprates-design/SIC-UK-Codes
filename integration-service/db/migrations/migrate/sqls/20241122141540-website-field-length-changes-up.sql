/* drop field lengths by setting to text */
alter table integration_data.business_entity_website_data
    alter column url set data type text,
    alter column category_url set data type text,
    alter column category_text set data type text ,
    alter column category_image_link set data type text ;