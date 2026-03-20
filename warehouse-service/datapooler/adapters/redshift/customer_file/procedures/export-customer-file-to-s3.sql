CREATE OR REPLACE PROCEDURE sp_export_customer_file_to_s3(
    p_customer_id VARCHAR,
    p_s3_folder VARCHAR,
    OUT o_customer_id VARCHAR,
    OUT o_s3_path VARCHAR,
    OUT o_started_at TIMESTAMP,
    OUT o_ended_at TIMESTAMP,
    OUT o_record_count BIGINT
)
    LANGUAGE plpgsql
AS
$$
DECLARE
    v_bucket     VARCHAR(256) := 'my-fixed-bucket';
    v_iam_role   VARCHAR(512) := 'arn:aws:iam::808338307022:role/worthai-prod-redshift-s3-data-exchange-role';
    v_prefix     VARCHAR(2048);
    v_temp_table VARCHAR(128) := NULL;
BEGIN
    o_started_at := GETDATE();
    o_customer_id := p_customer_id;

    -- Build the dynamic temp table (INOUT sets v_temp_table)
    CALL sp_build_customer_export(p_customer_id, v_temp_table);

    -- Build S3 prefix (UNLOAD writes to a prefix; Redshift appends _000)
    v_prefix :=
            's3://' || v_bucket || '/'
                || TRIM(BOTH '/' FROM p_s3_folder)
                || '/customer_export_' || TO_CHAR(GETDATE(), 'YYYYMMDDHH24MISS') || '_';

    o_s3_path := v_prefix;

    -- Count rows (before unload)
    EXECUTE 'SELECT COUNT(*) FROM ' || QUOTE_IDENT(v_temp_table)
        INTO o_record_count;

    -- UNLOAD single gzipped CSV (JSON-safe CSV)
    EXECUTE
        'UNLOAD (''SELECT * FROM ' || QUOTE_IDENT(v_temp_table) || ''')
       TO ' || QUOTE_LITERAL(v_prefix) || '
       IAM_ROLE ' || QUOTE_LITERAL(v_iam_role) || '
       CSV
       HEADER
       GZIP
       ALLOWOVERWRITE
       PARALLEL OFF';

    o_ended_at := GETDATE();

    -- Optional cleanup
    EXECUTE 'DROP TABLE IF EXISTS ' || QUOTE_IDENT(v_temp_table) || ';';
END;
$$;
