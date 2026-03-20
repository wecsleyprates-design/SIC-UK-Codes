from sqlalchemy import Table
from sqlalchemy.engine import MappingResult

from datapooler.adapters.redshift.tables import WarehouseTables
from datapooler.adapters.sessions import WarehouseSessions
from datapooler.models import npi


class NPIRepository:
    def __init__(self):
        self._sessions = WarehouseSessions
        self._tbl: Table
        self._return_model: npi.NPIRecord = npi.NPIRecord
        self._tbl = self._get_table_obj("npi", "records")

    def _get_table_obj(self, schema: str, table_name: str) -> Table:
        return WarehouseTables.get_table(schema, table_name)

    def get(self, id: str) -> npi.NPIRecord | None:
        with self._sessions.get_session() as session:
            query = session.query(self._tbl).filter(self._tbl.c.npi == id)
            result: MappingResult = session.execute(query)
            row = result.mappings().first()

            if row:
                return self._return_model(
                    npi=str(row["npi"]),
                    replacement_npi=row["replacement npi"],
                    employer_identification_number=row["employer identification number (ein)"],
                    entity_type_code=row["entity type code"],
                    healthcare_provider_taxonomy_code=row["healthcare provider taxonomy code_1"],
                    is_sole_proprietor=row["is sole proprietor"],
                    last_update_date=row["last update date"],
                    deactivation_date=row["npi deactivation date"],
                    reactivation_date=row["npi reactivation date"],
                    deactivation_reason_code=row["npi deactivation reason code"],
                    provider_organization_name=row[
                        "provider organization name (legal business name)"
                    ],
                    provider_gender_code=row["provider gender code"],
                    provider_first_name=row["provider first name"],
                    provider_last_name=row["provider last name (legal name)"],
                    provider_middle_name=row["provider middle name"],
                    provider_credential_text=row["provider credential text"],
                    provider_business_address=npi.ProviderBusinessAddress(
                        address_line_1=row["provider first line business mailing address"],
                        address_line_2=row["provider second line business mailing address"],
                        city=row["provider business mailing address city name"],
                        state=row["provider business mailing address state name"],
                        postal_code=row["provider business mailing address postal code"],
                        country_code=row[
                            "provider business mailing address country code (if outside u.s.)"
                        ],
                        telephone_number=row["provider business mailing address telephone number"],
                        fax_number=(
                            str(row["provider business mailing address fax number"])
                            if row["provider business mailing address fax number"]
                            else None
                        ),
                    ),
                    metadata=row,
                )

            return None
