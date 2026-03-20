CREATE OR REPLACE VIEW integration_data.request_response_with_similarity_index AS
SELECT
    request_response.request_id,
    request_response.business_id,
    request_response.platform_id,
    request_response.external_id,
    (request_response.response ->> 'efx_id'::text)::bigint AS efx_id,
    COALESCE(
        (task.metadata -> 'result'::text) -> 'matches'::text ->> 'points'::text,
        (task.metadata -> 'match'::text) ->> 'index'::text,
        NULL
    ) AS similarity_index,
    (task.metadata -> 'match'::text) ->> 'zi_c_location_id'::text AS zi_c_location_id,
    (task.metadata -> 'match'::text) ->> 'zi_c_company_id'::text AS zi_c_company_id,
    (task.metadata -> 'match'::text) ->> 'zi_es_location_id'::text AS zi_es_location_id,
    (task.metadata -> 'match'::text) ->> 'company_number'::text AS oc_company_number,
    (task.metadata -> 'match'::text) ->> 'jurisdiction_code'::text AS oc_jurisdiction_code,
    request_response.request_type,
    request_response.requested_at,
    request_response.connection_id,
    request_response.request_received,
    request_response.org_id,
    request_response.request_code,
    request_response.idempotency_key,
    request_response.async_key,
    request_response.status,
    task.metadata
FROM
    integration_data.request_response
JOIN
    integrations.data_business_integrations_tasks task
    ON task.id = request_response.request_id
  WHERE (request_response.platform_id = 17 AND COALESCE(((task.metadata -> 'result'::text) -> 'matches'::text) ->> 'points'::text, '0'::text)::numeric > 30::numeric AND COALESCE(((task.metadata -> 'result'::text) -> 'matches'::text) ->> 'score'::text, '0'::text)::numeric > 30::numeric
  )OR platform_id in (23,24)
