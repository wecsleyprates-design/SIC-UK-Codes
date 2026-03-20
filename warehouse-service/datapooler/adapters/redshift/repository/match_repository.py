"""
Redshift Repository for Entity Matching.

This module provides repositories for querying integration data sources (Equifax,
ZoomInfo, OpenCorporate, Canada Open, NPI) stored in Redshift data warehouse.

Repositories handle:
- Geographic matching (postal codes, state/region, country)
- Name-based filtering (first 3 characters)
- Firmographics data retrieval
- Dynamic model creation for flexible table schemas

Key geographic handling:
- GB/IE: No region matching required (country-level only)
- IE: Null postal codes allowed due to data quality
- PR: Mapped to US country code in database
"""

from typing import Any, Type

from pydantic import TypeAdapter
from sqlalchemy import Column, Integer, String, Table, and_
from sqlalchemy import case as case_sql
from sqlalchemy import cast, func, or_, select
from sqlalchemy.engine import MappingResult
from sqlalchemy.sql import ClauseElement, Executable, Select

from datapooler.adapters.redshift.dynamic_model_factory import DynamicModelFactory
from datapooler.adapters.redshift.tables import WarehouseTables
from datapooler.adapters.sessions import WarehouseSessions
from datapooler.models import businesses, firmographics

# Countries where state/region matching is not required
NO_REGION_ALLOWED_COUNTRIES = {"GB", "IE"}

# Countries where null postal codes are acceptable due to data quality issues
NULL_POSTAL_CODE_ALLOWED_COUNTRIES = {"IE"}


class BaseMatchRepository:
    """
    Base repository for querying integration data from Redshift.

    Provides common functionality for:
    - Geographic filtering (postal code, state, country)
    - Session management
    - Dynamic model creation
    - Firmographics retrieval

    Subclasses implement specific logic for each integration source.
    """

    def __init__(self):
        self.sessions = WarehouseSessions
        self._source: str
        self._tbl: Table
        self._return_model: TypeAdapter
        self._firmographic_sources: list[str]
        self._dynamic_models: dict[str, Type] = {}  # Store dynamic models per instance

    def get_matches(
        self, business_list: list[businesses.WorthBusiness]
    ) -> (
        list[businesses.EquifaxBusiness]
        | list[businesses.OpenCorporateBusiness]
        | list[businesses.ZoomInfoBusiness]
        | list[businesses.CanadaOpenBusiness]
    ): ...

    def get_firmographics(
        self, business_list: list[businesses.IntegrationBusiness]
    ) -> firmographics.Firmographics: ...

    def _firmographics_query(
        self, business_list: list[businesses.IntegrationBusiness], tbl: Table
    ) -> Executable: ...

    def _postal_code_clause(
        self, business: businesses.WorthBusiness, postal_code_column: Column
    ) -> ClauseElement:
        """
        Create SQL clause for matching postal code (first 3 digits).

        Special handling for countries with poor postal code data quality.
        For Ireland (IE), allows NULL postal codes to match due to incomplete data.

        Args:
            business: Worth business entity to match
            postal_code_column: Database column containing postal codes

        Returns:
            SQL clause for postal code matching
        """
        if business.country_code in NULL_POSTAL_CODE_ALLOWED_COUNTRIES:
            # For Ireland, the data quality is poor and the sample size is small
            # relative to other countries, so we allow None values
            # to match as well.
            return or_(
                postal_code_column == cast(business.zip3, String),
                postal_code_column.is_(None),
            )
        return postal_code_column == cast(business.zip3, String)

    def _location_clause(
        self, business: businesses.WorthBusiness, state_column: Column, country_column: Column
    ) -> list[ClauseElement]:
        """
        Create SQL clauses for geographic location matching.

        Handles country-specific data storage conventions:
        - PR (Puerto Rico): Stored under US country code in some integrations
        - GB/IE: Only country-level matching (no state/region)
        - Other: Both state and country matching

        Args:
            business: Worth business entity to match
            state_column: Database column for state/region
            country_column: Database column for country code

        Returns:
            List of SQL clauses for location matching
        """
        if business.country_code == "PR":
            # Our Database has PR entries under the US Country Code for Zoominfo and OpenCorporate
            return [state_column == business.state_code, country_column == "US"]

        if business.country_code in NO_REGION_ALLOWED_COUNTRIES:
            return [func.upper(country_column) == business.country_code.upper()]
        else:
            return [state_column == business.state_code, country_column == business.country_code]

    def _get_table_obj(self, schema: str, table_name: str) -> Table:
        return WarehouseTables.get_table(schema, table_name)

    def _get_dynamic_model_for_table(self, table: Table, source: str) -> Type:
        """
        Get or create a cached dynamic Pydantic model for a database table.

        Creates Pydantic models on-the-fly from SQLAlchemy table schemas,
        enabling flexible data validation without hardcoded model definitions.
        Models are cached per instance to avoid repeated creation.

        Args:
            table: SQLAlchemy Table object
            source: Integration source name (for cache key)

        Returns:
            Dynamically created Pydantic model class
        """
        cache_key = f"{source}_{table.name}"

        if cache_key not in self._dynamic_models:
            model_name = f"{source.title()}{table.name.title()}Model"
            self._dynamic_models[cache_key] = DynamicModelFactory.create_model_for_table(
                table, model_name
            )

        return self._dynamic_models[cache_key]


class EquifaxMatchRepository(BaseMatchRepository):
    def __init__(self):
        super().__init__()
        self._source = "equifax"
        self._firmographic_sources = ["equifax_us_raw", "equifax_bma_raw"]
        self._tbl = self._get_table_obj("warehouse", "equifax_us_standardized")
        self._return_model = TypeAdapter(list[businesses.EquifaxBusiness])

    def get_matches(
        self, business_list: list[businesses.WorthBusiness]
    ) -> list[businesses.EquifaxBusiness]:
        if not business_list:
            raise ValueError("Business list is empty")

        with self.sessions.get_session() as session:
            query = self._match_query(business_list)
            result: MappingResult = session.execute(query).mappings()
            return self._return_model.validate_python(result.fetchall()) if result else []

    def _match_query(self, business_list: list[businesses.WorthBusiness]) -> Select:
        conditions = [
            and_(
                self._tbl.c.efx_state == business.state,
                func.substring(
                    cast(self._tbl.c.efx_eng_zipcode, String), cast(1, Integer), cast(3, Integer)
                )
                == business.zip3,
                self._tbl.c.efx_name != "",
                self._tbl.c.efx_name.isnot(None),
                or_(
                    func.upper(
                        func.substring(
                            cast(self._tbl.c.efx_legal_name, String),
                            cast(1, Integer),
                            cast(3, Integer),
                        )
                    )
                    == business.name[:3],
                    # Don't need func.upper here as efx_eng_companyname is already in uppercase
                    func.substring(
                        cast(self._tbl.c.efx_eng_companyname, String),
                        cast(1, Integer),
                        cast(3, Integer),
                    )
                    == business.name[:3],
                ),
            )
            for business in business_list
        ]

        return select(
            self._tbl.c.efx_id,
            self._tbl.c.efx_eng_companyname,
            self._tbl.c.efx_eng_address,
            self._tbl.c.efx_eng_city,
            self._tbl.c.efx_eng_state,
            self._tbl.c.efx_eng_zipcode,
            self._tbl.c.efx_contct,
            self._tbl.c.efx_ceoname,
        ).where(or_(*conditions))

    def get_firmographics(
        self, business_list: list[businesses.EquifaxBusiness]
    ) -> firmographics.Firmographics:
        firmographics_data: dict[str, list[Any]] = {}

        for source in self._firmographic_sources:
            tbl = self._get_table_obj("warehouse", source)

            # Get the dynamic model for this table
            DynamicModel = self._get_dynamic_model_for_table(tbl, source)

            with WarehouseSessions.get_session() as session:
                qry = self._firmographics_query(business_list, tbl)
                result: list[dict[str, Any]] = session.execute(qry).mappings().all()

                # Validate and return dynamic models directly
                firmographics_data[source] = [DynamicModel.model_validate(row) for row in result]

        return firmographics.Firmographics(firmographics_data)

    def _firmographics_query(
        self, business_list: list[businesses.EquifaxBusiness], tbl: Table
    ) -> Executable:

        # Subquery to rank records by yr/mon for each efx_id
        subq = select(
            tbl,
            func.row_number()
            .over(partition_by=tbl.c.efx_id, order_by=[tbl.c.yr.desc(), tbl.c.mon.desc()])
            .label("rn"),
        ).subquery()

        # Main query to get only the most recent record (rn = 1) for each efx_id
        qry = select(*[c for c in subq.c if c.name != "rn"]).where(
            and_(
                subq.c.rn == 1,
                or_(subq.c.efx_id == business.efx_id for business in business_list),
            )
        )

        return qry


class OpenCorporateMatchRepository(BaseMatchRepository):
    def __init__(self):
        super().__init__()
        self._source = "open_corporate"
        self._firmographic_sources = [
            "additional_identifiers",
            "alternative_names",
            "companies",
            "non_reg_addresses",
            "officers",
        ]
        self._tbl = self._get_table_obj("datascience", "open_corporates_standard")
        self._return_model = TypeAdapter(list[businesses.OpenCorporateBusiness])

    def get_matches(
        self, business_list: list[businesses.WorthBusiness]
    ) -> list[businesses.OpenCorporateBusiness]:
        if not business_list:
            return None

        with self.sessions.get_session() as session:
            query = self._match_query(business_list)
            result: MappingResult = session.execute(query).mappings()
            return self._return_model.validate_python(result.fetchall()) if result else []

    def _match_query(self, business_list: list[businesses.WorthBusiness]) -> Select:

        conditions = [
            and_(
                *self._location_clause(business, self._tbl.c.region, self._tbl.c.country_code),
                self._postal_code_clause(business, self._tbl.c.zipcode_threedigits),
                self._tbl.c.normalised_name != "",
                self._tbl.c.normalised_name.isnot(None),
                or_(
                    # Don't need func.upper here as normalized_name is already in uppercase
                    func.substring(
                        cast(self._tbl.c.normalised_name, String),
                        cast(1, Integer),
                        cast(3, Integer),
                    )
                    == business.name[:3],
                    func.substring(
                        func.upper(cast(self._tbl.c.alternative_name, String)),
                        cast(1, Integer),
                        cast(3, Integer),
                    )
                    == business.name[:3],
                ),
            )
            for business in business_list
        ]

        return select(
            self._tbl.c.company_number,
            self._tbl.c.normalised_name,
            self._tbl.c.alternative_name,
            self._tbl.c.street_address_normalized,
            self._tbl.c.dba_normalized,
            self._tbl.c.region,
            self._tbl.c.locality,
            self._tbl.c.postal_code,
            self._tbl.c.jurisdiction_code,
            self._tbl.c.country_code,
        ).where(or_(*conditions))

    def get_firmographics(
        self, business_list: list[businesses.OpenCorporateBusiness]
    ) -> firmographics.Firmographics:
        firmographics_data: dict[str, list[Any]] = {}

        for source in self._firmographic_sources:
            tbl = self._get_table_obj("open_corporate", source)

            # Get the dynamic model for this table
            DynamicModel = self._get_dynamic_model_for_table(tbl, source)

            with WarehouseSessions.get_session() as session:
                qry = self._firmographics_query(business_list, tbl)
                result: list[dict[str, Any]] = session.execute(qry).mappings().all()

                # Validate and return dynamic models directly
                if result and source == "companies":
                    # Use top result to find home jurisdiction info
                    company = DynamicModel.model_validate(result[0])
                    home_qry = self._home_jurisdiction_firmographics_query(company, tbl)

                    # This query will retrieve the original results plus any home jurisdiction
                    # which is a bit inefficient but keeps the code simple.
                    result = session.execute(home_qry).mappings().all()

                firmographics_data[source] = [DynamicModel.model_validate(row) for row in result]

        return firmographics.Firmographics(firmographics_data)

    def _firmographics_query(
        self, business_list: list[businesses.OpenCorporateBusiness], tbl: Table
    ) -> Select:
        conditions = [
            and_(
                tbl.c.company_number == business.company_number,
                tbl.c.jurisdiction_code == business.jurisdiction_code,
            )
            for business in business_list
        ]

        qry = select(tbl).where(or_(*conditions))

        return qry

    def _home_jurisdiction_firmographics_query(self, business: Any, tbl: Table) -> Select:
        # if we have home jurisdiction info, check for both home jurisdiction or if the business is
        # the home jurisdiction of other companies
        if business.home_jurisdiction_code and business.home_jurisdiction_company_number:
            conditions = [
                or_(
                    # Get companies which share the same home jurisdiction as this business
                    and_(
                        tbl.c.home_jurisdiction_code == business.home_jurisdiction_code,
                        tbl.c.home_jurisdiction_company_number
                        == business.home_jurisdiction_company_number,
                    ),
                    # Get companies where this business is the home jurisdiction
                    and_(
                        tbl.c.home_jurisdiction_company_number == business.company_number,
                        tbl.c.home_jurisdiction_code == business.jurisdiction_code,
                    ),
                    # Get the home jurisdiction record itself
                    and_(
                        tbl.c.jurisdiction_code == business.home_jurisdiction_code,
                        tbl.c.company_number == business.home_jurisdiction_company_number,
                    ),
                )
            ]
        # if no home jurisdiction info, check if the business is the home jurisdiction
        # use the jurisdiction_code and company_number to see if its the home jurisdiction of other
        # companies
        else:
            conditions = [
                or_(
                    # Retrieve the original record
                    and_(
                        tbl.c.jurisdiction_code == business.jurisdiction_code,
                        tbl.c.company_number == business.company_number,
                    ),
                    # retrieve companies where this business is the home jurisdiction
                    and_(
                        tbl.c.home_jurisdiction_company_number == business.company_number,
                        tbl.c.home_jurisdiction_code == business.jurisdiction_code,
                    ),
                )
            ]

        qry = select(tbl).where(or_(*conditions))

        return qry


class ZoomInfoMatchRepository(BaseMatchRepository):
    def __init__(self):
        super().__init__()
        self._source = "zoominfo"
        self._tbl = self._get_table_obj("datascience", "zoominfo_standard")
        self._firmographic_sources = ["comp_standard_global"]
        self._return_model = TypeAdapter(list[businesses.ZoomInfoBusiness])

    def get_matches(
        self, business_list: list[businesses.WorthBusiness]
    ) -> list[businesses.ZoomInfoBusiness]:
        if not business_list:
            return None

        with self.sessions.get_session() as session:
            query = self._match_query(business_list)

            result: MappingResult = session.execute(query).mappings()
            return self._return_model.validate_python(result.fetchall()) if result else []

    def _match_query(self, business_list: list[businesses.WorthBusiness]) -> Select:
        conditions = [
            and_(
                *self._location_clause(
                    business,
                    self._tbl.c.zi_eng_state,
                    self._tbl.c.country_code,
                ),
                self._postal_code_clause(business, self._tbl.c.zi_eng_zipcode_threedigits),
                self._tbl.c.zi_eng_companyname != "",
                self._tbl.c.zi_eng_companyname.isnot(None),
                self._tbl.c.zi_eng_dba != "",
                self._tbl.c.zi_eng_dba.isnot(None),
                or_(
                    func.substring(
                        func.upper(cast(self._tbl.c.zi_eng_companyname, String)),
                        cast(1, Integer),
                        cast(3, Integer),
                    )
                    == business.name[:3],
                    func.substring(
                        func.upper(cast(self._tbl.c.zi_eng_dba, String)),
                        cast(1, Integer),
                        cast(3, Integer),
                    )
                    == business.name[:3],
                    func.substring(
                        func.upper(cast(self._tbl.c.zi_eng_dba2, String)),
                        cast(1, Integer),
                        cast(3, Integer),
                    )
                    == business.name[:3],
                ),
            )
            for business in business_list
        ]

        return select(
            self._tbl.c.zi_c_company_id,
            self._tbl.c.zi_c_location_id,
            self._tbl.c.zi_es_location_id,
            self._tbl.c.zi_eng_companyname,
            self._tbl.c.zi_eng_address,
            self._tbl.c.zi_eng_dba,
            self._tbl.c.zi_eng_city,
            self._tbl.c.zi_eng_state,
            self._tbl.c.zi_eng_zipcode,
            self._tbl.c.country_code,
        ).where(or_(*conditions))

    def get_firmographics(self, business_list: list[businesses.ZoomInfoBusiness]):
        firmographics_data: dict[str, list[Any]] = {}
        for source in self._firmographic_sources:
            tbl = self._get_table_obj("zoominfo", source)

            # Get the dynamic model for this table
            DynamicModel = self._get_dynamic_model_for_table(tbl, source)

            with WarehouseSessions.get_session() as session:
                qry = self._firmographics_query(business_list, tbl)
                result: list[dict[str, Any]] = session.execute(qry).mappings().all()

                # Validate and return dynamic models directly
                firmographics_data[source] = [DynamicModel.model_validate(row) for row in result]

        return firmographics.Firmographics(firmographics_data)

    def _firmographics_query(
        self, business_list: list[businesses.ZoomInfoBusiness], tbl: Table
    ) -> Select:
        conditions = [
            and_(
                tbl.c.zi_c_company_id == business.company_id,
                tbl.c.zi_c_location_id == business.location_id,
                tbl.c.zi_es_location_id == business.es_location_id,
            )
            for business in business_list
        ]

        qry = select(tbl).where(or_(*conditions))

        return qry


class CanadaOpenMatchRepository(BaseMatchRepository):
    def __init__(self):
        super().__init__()
        self._source = "canada_open"
        self._firmographic_sources = ["ca_open_businesses"]
        self._tbl = self._get_table_obj("warehouse", "ca_open_businesses_standardized")
        self._return_model = TypeAdapter(list[businesses.CanadaOpenBusiness])

    def get_matches(
        self, business_list: list[businesses.WorthBusiness]
    ) -> list[businesses.CanadaOpenBusiness]:
        if not business_list:
            return None

        with self.sessions.get_session() as session:
            query = self._match_query(business_list)
            result: MappingResult = session.execute(query).mappings()
            return self._return_model.validate_python(result.fetchall()) if result else []

    def _match_query(self, business_list: list[businesses.WorthBusiness]) -> Select:
        conditions = [
            and_(
                self._tbl.c.region == business.state,
                func.substring(
                    cast(self._tbl.c.postal_code, String), cast(1, Integer), cast(3, Integer)
                )
                == business.zip3,
                self._tbl.c.current_name != "",
                self._tbl.c.current_name.isnot(None),
                or_(
                    # Don't need func.upper here as normalized_name is already in uppercase
                    func.substring(
                        cast(self._tbl.c.canonized_name, String),
                        cast(1, Integer),
                        cast(3, Integer),
                    )
                    == business.name[:3],
                    func.substring(
                        cast(self._tbl.c.sanitized_name, String),
                        cast(1, Integer),
                        cast(3, Integer),
                    )
                    == business.name[:3],
                    func.substring(
                        func.upper(cast(self._tbl.c.current_name, String)),
                        cast(1, Integer),
                        cast(3, Integer),
                    )
                    == business.name[:3],
                ),
                self._explicit_id_clause(business),
            )
            for business in business_list
        ]

        return select(
            self._tbl.c.id,
            self._tbl.c.business_number,
            self._tbl.c.canonized_name,
            self._tbl.c.sanitized_name,
            self._tbl.c.current_name,
            self._tbl.c.other_names,
            self._tbl.c.normalized_address,
            self._tbl.c.other_addresses,
            self._tbl.c.city,
            self._tbl.c.postal_code,
            self._tbl.c.country,
            self._tbl.c.region,
        ).where(or_(*conditions))

    def _explicit_id_clause(self, business: businesses.WorthBusiness) -> ClauseElement:
        clauses = []
        if business.extra.canada_open_business_number:
            clauses.append(
                self._tbl.c.business_number == business.extra.canada_open_business_number
            )
        if business.extra.canada_open_corporate_id:
            clauses.append(self._tbl.c.id == business.extra.canada_open_corporate_id)

        return or_(*clauses)

    def get_firmographics(
        self, business_list: list[businesses.CanadaOpenBusiness]
    ) -> firmographics.Firmographics:
        firmographics_data: dict[str, list[Any]] = {}

        for source in self._firmographic_sources:
            tbl = self._get_table_obj("warehouse", source)

            # Get the dynamic model for this table
            DynamicModel = self._get_dynamic_model_for_table(tbl, source)

            with WarehouseSessions.get_session() as session:
                qry = self._firmographics_query(business_list, tbl)
                result: list[dict[str, Any]] = session.execute(qry).mappings().all()

                # Validate and return dynamic models directly
                firmographics_data[source] = [DynamicModel.model_validate(row) for row in result]

        return firmographics.Firmographics(firmographics_data)

    def _firmographics_query(
        self, business_list: list[businesses.CanadaOpenBusiness], tbl: Table
    ) -> Executable:
        conditions = [
            and_(
                tbl.c.id == business.corporate_id,
                tbl.c.business_number == business.business_number,
            )
            for business in business_list
        ]

        qry = select(tbl).where(or_(*conditions))

        return qry


class NPIMatchRepository(BaseMatchRepository):
    ALIAS_COLUMNS = {
        "provider organization name (legal business name)",
        "provider other organization name",
    }

    # Only the columns needed for NPIBusiness model fields.  The full NPI
    # records table has ~300 columns; selecting all of them inflated per-
    # candidate memory from ~3 KB to ~48 KB (the long CMS column names alone
    # are ~45 KB of dict keys per row).  Firmographics does its own SELECT *
    # query by NPI number, so these columns are sufficient for scoring.
    _SCORING_COLUMNS = [
        "npi",
        "provider first line business practice location address",
        "provider business practice location address city name",
        "provider business practice location address state name",
        "provider business practice location address postal code",
        "provider business practice location address country code (if outside u.s.)",
        "provider business practice location address telephone number",
        "provider business practice location address fax number",
        "provider first name",
        "provider last name (legal name)",
        "provider middle name",
        "provider telephone number",
        "provider license number_1",
        "provider credential text",
        "replacement npi",
        "employer identification number (ein)",
        "entity type code",
        "healthcare provider taxonomy code_1",
        "is sole proprietor",
        "last update date",
        "npi deactivation date",
        "npi reactivation date",
        "npi deactivation reason code",
    ]

    def __init__(self):
        super().__init__()
        self._source = "npi"
        self._firmographic_sources = ["records"]
        self._tbl = self._get_table_obj("npi", "records")
        self._return_model = TypeAdapter(list[businesses.NPIBusiness])

    def get_matches(
        self, business_list: list[businesses.WorthBusiness]
    ) -> list[businesses.NPIBusiness]:
        if not business_list:
            return []

        with self.sessions.get_session() as session:
            query = self._match_query(business_list)

            results = []
            for row in session.execute(query).mappings():
                self._set_results(results, row)

            return results

    def _set_results(self, results: list[businesses.NPIBusiness], row: MappingResult) -> None:
        # Create NPIBusiness model including original row data
        npi_business = businesses.NPIBusiness(**row, row=dict(row))
        results.append(npi_business)

        # If there is an other name, create a separate match candidate for it
        # We want to replace the name but keep the rest of the data the same
        if npi_business.other_name:
            other_name_npi_business = npi_business.model_copy(
                update={"name": npi_business.other_name, "other_name": None}
            )

            # Also set the original row data's name to the other name
            other_name_npi_business.row["provider organization name (legal business name)"] = (
                npi_business.other_name
            )
            results.append(other_name_npi_business)

    def _match_query(self, business_list: list[businesses.WorthBusiness]) -> Select:
        alias_tbl = self._get_alias_table()

        conditions = [
            and_(
                alias_tbl.c["provider organization name (legal business name)"] != "",
                alias_tbl.c["provider organization name (legal business name)"].isnot(None),
                self._tbl.c["npi deactivation date"] == "",
                self._tbl.c["npi deactivation date"].isnot(None),
                self._tbl.c["entity type code"] == "1",  # Only match providers
                self._case_clause(
                    "provider business practice location address postal code",
                    business,
                ),
                or_(
                    func.substring(
                        func.upper(
                            func.cast(
                                alias_tbl.c["provider organization name (legal business name)"],
                                String,
                            )
                        ),
                        func.cast(1, Integer),
                        func.cast(3, Integer),
                    )
                    == business.name[:3],
                    func.substring(
                        func.upper(
                            func.cast(
                                alias_tbl.c["provider other organization name"],
                                String,
                            )
                        ),
                        func.cast(1, Integer),
                        func.cast(3, Integer),
                    )
                    == business.name[:3],
                ),
                *self._name_conditions(business),
            )
            for business in business_list
        ]

        scoring_columns = [self._tbl.c[name] for name in self._SCORING_COLUMNS]

        return (
            select(
                *scoring_columns,
                alias_tbl.c["provider organization name (legal business name)"],
                func.coalesce(
                    func.nullif(alias_tbl.c["provider other organization name"], ""),
                    func.nullif(self._tbl.c["provider other organization name"], ""),
                ).label("provider other organization name"),
            )
            .join(
                alias_tbl,
                and_(
                    func.substring(
                        self._tbl.c["provider business practice location address postal code"],
                        cast(1, Integer),
                        cast(3, Integer),
                    )
                    == func.substring(
                        alias_tbl.c["provider business practice location address postal code"],
                        cast(1, Integer),
                        cast(3, Integer),
                    ),
                    self._tbl.c["provider first line business practice location address"]
                    == alias_tbl.c["provider first line business practice location address"],
                    self._tbl.c["provider business practice location address city name"]
                    == alias_tbl.c["provider business practice location address city name"],
                    self._tbl.c["provider business practice location address state name"]
                    == alias_tbl.c["provider business practice location address state name"],
                ),
            )
            .where(or_(*conditions))
        )

    def _name_conditions(self, business: businesses.WorthBusiness) -> list[ClauseElement]:
        # if we have a first and last name for the authorized official, match on the first letter
        if (first_name := business.extra.first_name) and (last_name := business.extra.last_name):
            return [
                and_(
                    func.substring(
                        self._tbl.c["provider first name"],
                        cast(1, Integer),
                        cast(1, Integer),
                    )
                    == first_name[0],
                    func.substring(
                        self._tbl.c["provider last name (legal name)"],
                        cast(1, Integer),
                        cast(1, Integer),
                    )
                    == last_name[0],
                )
            ]

        return []

    def _get_alias_table(self) -> Select:
        alias_tbl = self._tbl

        return (
            select(
                alias_tbl.c["provider organization name (legal business name)"],
                alias_tbl.c["provider other organization name"],
                alias_tbl.c["provider business practice location address postal code"],
                alias_tbl.c["provider first line business practice location address"],
                alias_tbl.c["provider business practice location address city name"],
                alias_tbl.c["provider business practice location address state name"],
            )
            .where(
                and_(
                    alias_tbl.c["provider organization name (legal business name)"].isnot(None),
                    alias_tbl.c["provider organization name (legal business name)"] != "",
                    alias_tbl.c["entity type code"] == "2",
                )
            )
            .distinct()
            .subquery("alias_tbl")
        )

    def _case_clause(self, column_name: str, business: businesses.WorthBusiness) -> ClauseElement:
        return case_sql(
            [
                # if postal code length <= 5, pad to 5 and match first 3 digits
                # leading zeros may be missing
                (
                    func.length(self._tbl.c[column_name]) <= 5,
                    func.substring(
                        func.lpad(
                            func.cast(
                                self._tbl.c[column_name],
                                String,
                            ),
                            5,
                            "0",
                        ),
                        func.cast(1, Integer),
                        func.cast(3, Integer),
                    )
                    == func.cast(business.zip3, String),
                ),
                # if postal code length is between 6 and 8, pad to 9 and match
                # first 3 digits
                (
                    func.length(self._tbl.c[column_name]) >= 6,
                    func.substring(
                        func.lpad(
                            func.cast(
                                self._tbl.c[column_name],
                                String,
                            ),
                            9,
                            "0",
                        ),
                        func.cast(1, Integer),
                        func.cast(3, Integer),
                    )
                    == func.cast(business.zip3, String),
                ),
            ]
        )

    def get_firmographics(
        self, business_list: list[businesses.NPIBusiness]
    ) -> firmographics.Firmographics:
        firmographics_data: dict[str, list[Any]] = {}

        for source in self._firmographic_sources:
            tbl = self._get_table_obj("npi", source)

            # Get the dynamic model for this table
            DynamicModel = self._get_dynamic_model_for_table(tbl, source)

            with WarehouseSessions.get_session() as session:
                qry = self._firmographics_query(business_list, tbl)
                result: list[dict[str, Any]] = session.execute(qry).mappings().all()

                # Validate and return dynamic models directly
                firmographics_data[source] = [DynamicModel.model_validate(row) for row in result]

        return firmographics.Firmographics(firmographics_data)

    def _firmographics_query(self, business_list, tbl) -> Executable:
        conditions = [tbl.c.npi == business.npi for business in business_list]

        qry = select(tbl).where(or_(*conditions))

        return qry


MAP_REPOSITORY_CLASSES = {
    "equifax": EquifaxMatchRepository,
    "open_corporate": OpenCorporateMatchRepository,
    "zoominfo": ZoomInfoMatchRepository,
    "canada_open": CanadaOpenMatchRepository,
    "npi": NPIMatchRepository,
}


def _get_repository_class(integration: str) -> BaseMatchRepository:
    return MAP_REPOSITORY_CLASSES[integration]()
