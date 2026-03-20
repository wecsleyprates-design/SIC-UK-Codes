/* Replace with your SQL commands */
/* Replace with your SQL commands */
UPDATE onboarding_schema.core_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Upload Statements",
      "status": true,
      "sub_fields": [
        {
          "name": "Enable OCR",
          "status": true,
          "description": "Auto-calculate and pre-fill the fields below when a statement uploaded.",
          "status_data_type": "Checkbox"
        }
      ],
      "description": "Allow applicants to upload a past payment processing statement. Please note: if the applicant is a new business, we’ll ask for estimates of all enabled fields below.",
      "section_name": "How do you want applicants to provide their processing history?",
      "status_data_type": "Toggle"
    },
    {
      "name": "Manually Provide Processing History",
      "status": true,
      "description": "Allow applicants to manually type details from recent processing statements or provide estimates if they are a new business.",
      "section_name": "How do you want applicants to provide their processing history?",
      "status_data_type": "Toggle"
    },
    {
      "name": "Monthly Volume",
      "status": "Optional",
      "description": "The summation of volume for Visa, Mastercard, and Discover cards during a given month.",
      "section_name": "What Visa, Mastercard, and Discover data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Average Ticket Size",
      "status": "Optional",
      "description": "The average transaction amount across Visa, Mastercard, and Discover in total.",
      "section_name": "What Visa, Mastercard, and Discover data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "High Ticket Size",
      "status": "Optional",
      "description": "The highest ticket size among Visa, Mastercard, and Discover.",
      "section_name": "What Visa, Mastercard, and Discover data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Desired Limit",
      "status": "Optional",
      "description": "When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).",
      "section_name": "What Visa, Mastercard, and Discover data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Monthly Volume",
      "status": "Optional",
      "description": "The summation of volume for all American Express transactions.",
      "section_name": "What American Express data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Average Ticket Size",
      "status": "Optional",
      "description": "The average transaction amount for all American Express transactions.",
      "section_name": "What American Express data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "High Ticket Size",
      "status": "Optional",
      "description": "The highest ticket size for American Express transactions.",
      "section_name": "What American Express data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Desired Limit",
      "status": "Optional",
      "description": "When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).",
      "section_name": "What American Express data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Card (Swiped)",
      "status": "Optional",
      "description": "Percent of point of sale volume via credit card swiping.",
      "section_name": "What Point of Sale data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Card (Keyed)",
      "status": "Optional",
      "description": "Percent of point of sale volume via credit card typed manually.",
      "section_name": "What Point of Sale data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "eCommerce",
      "status": "Optional",
      "description": "Percent of point of sale volume via eCommerce.",
      "section_name": "What Point of Sale data would you like to collect?",
      "status_data_type": "Dropdown"
    }
  ],
  "integrations": [],
  "additional_settings": []
}'
WHERE stage_id = 9;

UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(field)
        FROM (
            SELECT field
            FROM jsonb_array_elements(config->'fields') AS elem(field)
            WHERE (field->>'name', field->>'section_name') NOT IN (
                ('Monthly Volume', 'What general processing history data would you like to collect?'),
                ('Annual Volume', 'What general processing history data would you like to collect?'),
                ('Average Ticket Size', 'What general processing history data would you like to collect?'),
                ('High Ticket Size', 'What general processing history data would you like to collect?'),
                ('Monthly Occurrence of High Ticket', 'What general processing history data would you like to collect?'),
                ('Explanation of High Ticket', 'What general processing history data would you like to collect?'),
                ('Desired Limit', 'What general processing history data would you like to collect?'),
                ('Define Seasonal Business', 'What seasonal information would you like to collect?'),
                ('High Volume Months', 'What seasonal information would you like to collect?'),
                ('Explanation of High Volume Months', 'What seasonal information would you like to collect?'),
                ('Annual Volume', 'What Visa, Mastercard, and Discover data would you like to collect?'),
                ('Annual Volume', 'What American Express data would you like to collect?'),
                ('Mail & Telephone', 'What Point of Sale data would you like to collect?')
            )
        ) AS filtered_fields
    )
)
WHERE customer_stage_id IN (
    SELECT id FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'processing_history'
);