CREATE OR REPLACE PROCEDURE public.sp_create_equifax_latest_tables()
    LANGUAGE plpgsql
AS
$$
BEGIN
    DROP TABLE IF EXISTS warehouse.equifax_us_latest;
    CREATE TABLE warehouse.equifax_us_latest AS
    WITH
        latest_efx AS (SELECT
                           efx_id,
                           MAX(CAST(yr AS INT))  AS yr,
                           MAX(CAST(mon AS INT)) AS mon
                       FROM warehouse.equifax_us_raw
                       GROUP BY
                           efx_id

        )
    SELECT
        *
    FROM warehouse.equifax_us_raw
        INNER JOIN latest_efx
                USING (efx_id, yr, mon)
    WHERE efx_id IN (SELECT efx_id FROM datascience.efx_matches_custom_inc_ml);

    DROP TABLE IF EXISTS warehouse.equifax_bma_latest;
    CREATE TABLE warehouse.equifax_bma_latest AS
    WITH
        latest_efx AS (SELECT
                           efx_id,
                           MAX(CAST(yr AS INT))  AS yr,
                           MAX(CAST(mon AS INT)) AS mon
                       FROM warehouse.equifax_bma_raw
                       GROUP BY
                           efx_id

        )
    SELECT
        *
    FROM warehouse.equifax_bma_raw
        INNER JOIN latest_efx
                USING (efx_id, yr, mon)
    WHERE efx_id IN (SELECT efx_id FROM datascience.efx_matches_custom_inc_ml);
END;
$$
