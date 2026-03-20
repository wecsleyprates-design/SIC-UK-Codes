/* The materialized view that allows ZoomInfo matching to work in Redshift */
create materialized view zoominfo.normalized_usca_matview as WITH X AS (
  SELECT
    zi_c_location_id,
    zi_c_company_id,
    zi_es_location_id,
    normalize_business_name(zi_c_name) as name,
    parse_address(
      CASE
      when zi_c_street_2 is not null then zi_c_street || ' ' || zi_c_street_2 || ', ' || zi_c_city || ', ' || zi_c_state || ' ' || zi_c_zip || ', ' || zi_c_country
      ELSE zi_c_street || ', ' || zi_c_city || ', ' || zi_c_state || ' ' || zi_c_zip || ', ' || zi_c_country END
    ) AS address_parts,
    CASE
    WHEN can_json_parse(address_parts) THEN json_parse(address_parts)
    ELSE '{}':: SUPER END AS j,
    zi_c_street,
    zi_c_street_2,
    zi_c_city,
    zi_c_state,
    zi_c_zip,
    zi_c_country
  FROM
    zoominfo.comp_standard_global
  WHERE
    zi_c_country in('United States', 'Canada')
    and zi_c_street is not null
    and zi_c_city is not null
    and zi_c_state is not null
    and zi_c_zip is not null
    and zi_c_name is not null
) 
SELECT
/* These three columns are the zoominfo 'keys' */
  zi_c_location_id,
  zi_c_company_id,
  zi_es_location_id,
  name,
  X.j.line1:: TEXT AS line1,
  X.j.line2:: TEXT as line2,
  X.j.city:: TEXT AS city,
  COALESCE(X.j.state, X.j.province):: TEXT AS state,
  COALESCE(X.j.zip, X.j.postal):: TEXT AS zip,
  X.j.country:: TEXT as country,
  LEFT(zip, 3) AS zip3,
  LEFT(zip, 4) AS zip4,
  LEFT(name, 1) AS name1,
  LEFT(name, 2) AS name2
FROM
  X;