/* Replace with your SQL commands */
UPDATE
    integration_data.request_response
SET
    response = jsonb_set(
        COALESCE(response, '{}' :: jsonb),
        '{google_profile_match_result,business_match}',
        '"Potential Match"',
        true
    )
WHERE
    platform_id = 39 -- SERP_GOOGLE_PROFILE integration / platform id
    AND "status" = 1 -- Successful task
    AND -- Partial or not matched address match
    (
        response -> 'google_profile_match_result' ->> 'address_match' = 'Partial Match'
        OR response -> 'google_profile_match_result' ->> 'address_match' = 'Not Matched'
    );