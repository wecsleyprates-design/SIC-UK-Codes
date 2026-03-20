CREATE OR REPLACE PROCEDURE sp_regenerate_smbs_and_joined_tables()
    LANGUAGE plpgsql
AS
$$
BEGIN

    CALL public.sp_truncate_and_populate_smb_standard(); -- Regenerates smb_standard AKA Step 2
    CALL public.sp_truncate_and_insert_smb_equifax_standardized_joined(); -- Regenerates smb_equifax_standardized_joined Step 6
    CALL public.sp_truncate_and_insert_smb_zoominfo_standardized_joined(); -- Regenerates smb_zoominfo_standardized_joined step 7
    CALL public.sp_truncate_and_insert_smb_open_corporate_standardized_joined(); -- Regenerates smb_open_corporate_standardized_joined Step 8
    CALL public.sp_truncate_insert_verdata_aggregate(); -- Regenerates verdata_aggregate Step 9
    CALL public.sp_truncate_and_insert_verification_results(); -- Regenerates verdata_aggregate Step 10
    CALL public.sp_truncate_and_insert_smb_zi_oc_efx_combined_recreate(); -- Regenerates smb_zi_oc_efx_combined Step 11
    CALL public.sp_recreate_smb_pr_verification_cs(); -- Regenerates smb_pr_verification_cs Step 13
    CALL public.sp_recreate_customer_files(); --Regenerates customer_files Step 14

END
$$
