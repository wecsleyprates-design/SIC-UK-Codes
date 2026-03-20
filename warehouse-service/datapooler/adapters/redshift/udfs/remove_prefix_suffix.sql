CREATE OR REPLACE FUNCTION remove_prefix_suffix(input_name VARCHAR)
    RETURNS VARCHAR
    IMMUTABLE
    LANGUAGE sql
AS
$$
    SELECT
        TRIM(BOTH FROM
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    TRIM(BOTH FROM UPPER($1)),
                    '^\\s*(THE\\s|A\\s)+',  -- Matches "THE" or "A" at the start
                    ''
                ),
                '\\s*(LLC|CORP|CORPORATION|INC)\\s*$',  -- Matches suffixes at the end
                ''
            )
        );
$$;
