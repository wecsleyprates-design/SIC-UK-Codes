CREATE OR REPLACE PROCEDURE public.sp_regenerate_normalization_functions()
    LANGUAGE plpgsql
AS
$regen_functions$
BEGIN
    CREATE OR REPLACE FUNCTION public.replace_accents_diacritics(varchar)
    returns varchar immutable AS $$
        SELECT
            TRANSLATE(
                $1,
                'ÁÀÂÆÇÉÈÊËÍÎÏÓÔŒÚÙÛÜŸÑ',
                'AAAACEEEEIIIOOOUUUUYN'
            )
    $$ language sql;

    CREATE OR REPLACE FUNCTION public.replace_special_characters(varchar)
    returns varchar immutable AS $$
        SELECT
            REGEXP_REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(REPLACE($1, '&', ' AND '), chr(39), ' '),
                            '’',
                            ' '
                        ),
                        '-',
                        ' '
                    ),
                    '/',
                    ' '
                ),
                '[^A-Z 0-9]',
                ''
            )
    $$ language sql;

    CREATE OR REPLACE FUNCTION public.remove_excess_whitespace(varchar)
    returns varchar immutable AS $$
        SELECT
            TRIM(
                REPLACE(REPLACE(REPLACE($1, ' ', '%#'), '#%', ''), '%#', ' ')
            )
    $$ language sql;

    CREATE OR REPLACE FUNCTION public.sanitize_string(varchar)
    returns varchar immutable AS $$
        SELECT
            public.remove_excess_whitespace(
                public.replace_special_characters(
                    public.replace_accents_diacritics(UPPER($1))
                )
            )
    $$ language sql;

    CREATE OR REPLACE FUNCTION public.sanitize_business_name(varchar)
    returns varchar immutable AS $$
        SELECT
            CASE
            WHEN LEFT(TRIM(REPLACE(UPPER($1), chr(39), '’')), 2) = 'L’'
                THEN 'L’' || public.sanitize_string(SUBSTRING(UPPER($1), 3))
            ELSE public.sanitize_string(UPPER($1))
            END
    $$ language sql;

    CREATE OR REPLACE FUNCTION public.strip_prefix(varchar)
    returns varchar immutable AS $$
        SELECT
            REGEXP_REPLACE(
                REPLACE($1, '’', '’ '),
                '^(THE|A|AN|LE|LA|LES|LAS|LOS|L’) ',
                ''
            )
    $$ language sql;

    CREATE OR REPLACE FUNCTION public.strip_suffix(varchar)
    returns varchar immutable AS $$
        SELECT
            REGEXP_REPLACE(
                $1,
                ' (PLLC|LLC|PROFESSIONAL LIMITED LIABILITY COMPANY|LIMITED LIABILITY COMPANY|LIMITED LIABILITY CO|CORP|NONPROFIT CORPORATION|PROFESSIONAL CORPORATION|CORPORATION|INC|INCORPORATED|INCORPOREE|LTD|LIMITED|CO|COMPANY|LLP|LP|LIMITED LIABILITY PARTNERSHIP|LIMITED PARTNERSHIP|GP|GENERAL PARTNERSHIP|PC|PA|PROFESSIONAL ASSOCIATION|NFP|NOT FOR PROFIT|ASSOC|ASSOCIATION|ULC|UNLIMITED LIABILITY COMPANY|LTEE|LIMITEE|SENC|SEC|SCOP|SENCRL|COOP|COOPERATIVE|FOUNDATION|FONDATION|SOCIETE|SOCIETY)$',
                ''
            )
    $$ language sql;

    CREATE OR REPLACE FUNCTION public.canonize_business_name(varchar)
    returns varchar immutable AS $$
        SELECT
            public.strip_suffix(
                public.strip_suffix(
                    public.strip_prefix(public.sanitize_business_name($1))
                )
            )
    $$ language sql;
END
$regen_functions$;
