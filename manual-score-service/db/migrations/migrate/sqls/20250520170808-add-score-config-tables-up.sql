/* Replace with your SQL commands */
CREATE TABLE IF NOT EXISTS core_configs (
    id SERIAL PRIMARY KEY NOT NULL,
    code VARCHAR(255) NOT NULL,
    config JSONB NOT NULL
);

INSERT INTO core_configs (code, config) VALUES
('score_config', '{
  "categories": {
    "accounting": {
      "required": false,
      "minPlatforms": 0,
      "platforms": [
        { "name": "quickbooks", "required": false },
        { "name": "rutter_quickbooks", "required": false },
        { "name": "rutter_freshbooks", "required": false },
        { "name": "rutter_netsuite", "required": false },
        { "name": "rutter_wave", "required": false },
        { "name": "rutter_xero", "required": false },
        { "name": "rutter_zoho", "required": false },
        { "name": "rutter_quickbooksdesktop", "required": false }
      ]
    },
    "banking": {
      "required": true,
      "minPlatforms": 1,
      "platforms": [
        { "name": "giact", "required": false },
        { "name": "plaid", "required": false }
      ]
    },
    "business_entity_verification": {
      "required": false,
      "minPlatforms": 0,
      "platforms": [
        { "name": "middesk", "required": false },
        { "name": "npi", "required": false },
        { "name": "opencorporates", "required": false },
        { "name": "serp_scrape", "required": false },
        { "name": "zoominfo", "required": false },
        { "name": "entity_matching", "required": false }
      ]
    },
    "commerce": {
      "required": false,
      "minPlatforms": 0,
      "platforms": [
        { "name": "rutter_paypal", "required": false },
        { "name": "rutter_square", "required": false },
        { "name": "rutter_stripe", "required": false }
      ]
    },
    "bureau": {
      "required": false,
      "minPlatforms": 0,
      "platforms": [
        { "name": "equifax", "required": false }
      ]
    },
    "identity_verification": {
      "required": false,
      "minPlatforms": 0,
      "platforms": [
        { "name": "persona", "required": false },
        { "name": "plaid_idv", "required": false }
      ]
    },
    "manual": {
      "required": false,
      "minPlatforms": 0,
      "platforms": [
        { "name": "manual", "required": false }
      ]
    },
    "public_records": {
      "required": true,
      "minPlatforms": 1,
      "platforms": [
        { "name": "adverse_media", "required": false },
        { "name": "google_business_reviews", "required": false },
        { "name": "google_places_reviews", "required": false },
        { "name": "verdata", "required": false }
      ]
    },
    "taxation": {
      "required": false,
      "minPlatforms": 0,
      "platforms": [
        { "name": "taxation", "required": false },
        { "name": "electronic_signature", "required": false }
      ]
    }
  },
  "metaCondition": {
    "type": "and",
    "conditions": [
      {
        "type": "and",
        "conditions": [
          {
            "type": "and",
            "conditions": [
              {
                "type": "field",
                "name": "revenue",
                "valueType": "number",
                "operator": "notEqual",
                "value": 0,
                "required": true
              },
              {
                "type": "or",
                "conditions": [
                  {
                    "type": "field",
                    "name": "formation_date",
                    "valueType": "string",
                    "operator": "isNotNull",
                    "value": "",
                    "required": true
                  },
                  {
                    "type": "field",
                    "name": "naics_code",
                    "valueType": "string",
                    "operator": "isNotNull",
                    "value": "",
                    "required": true
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
'
);

CREATE TABLE IF NOT EXISTS data_customer_configs(
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    config_id INT NOT NULL,
    customer_id uuid NOT NULL,
    config JSONB NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_customer_configs_config FOREIGN KEY (config_id) REFERENCES core_configs (id) ON DELETE CASCADE,
    CONSTRAINT unique_customer_config UNIQUE (customer_id, config_id)
);