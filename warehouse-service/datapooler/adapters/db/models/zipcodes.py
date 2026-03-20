from sqlalchemy import BigInteger, Boolean, Column, Float, SmallInteger, String

from datapooler.adapters.db.models import base, mixins


class USZipCodeDb(mixins.TimestampMixin, base.Base):
    __tablename__ = "us_zip_codes"
    __tableargs__ = {"implicit_returning": False}

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    zip_code = Column(String(5), nullable=False, index=True)
    city = Column(String(100), nullable=False)
    county = Column(String(100), nullable=True)
    state = Column(String(2), nullable=False)
    county_fips = Column(SmallInteger, nullable=True)
    state_fips = Column(SmallInteger, nullable=True)
    timezone = Column(SmallInteger, nullable=True)
    daylight_savings = Column(Boolean, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    @classmethod
    def from_flat_file(cls, row: dict) -> "USZipCodeDb":
        """
        Create a USZipCodeDb instance from a flat file row.
        """
        return cls(
            zip_code=row["Zip Code"],
            city=row["City"],
            county=row["County"],
            state=row["State"],
            county_fips=int(row["CountyFIPS"]) if row["CountyFIPS"] else None,
            state_fips=int(row["StateFIPS"]) if row["StateFIPS"] else None,
            timezone=int(row["TimeZone"]) if row["TimeZone"] else None,
            daylight_savings=row["DayLightSavings"] == "Y" if row["DayLightSavings"] else None,
            latitude=float(row["ZipLatitude"]),
            longitude=float(row["ZipLongitude"]),
        )


class CAZipCodeDb(mixins.TimestampMixin, base.Base):
    __tablename__ = "ca_zip_codes"
    __tableargs__ = {"implicit_returning": False}

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    postal_code = Column(String(10), nullable=False, index=True)
    city = Column(String(100), nullable=False)
    province_abbr = Column(String(2), nullable=False)
    timezone = Column(SmallInteger, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    @classmethod
    def from_flat_file(cls, row: dict) -> "CAZipCodeDb":
        """
        Create a CAZipCodeDb instance from a flat file row.
        """
        return cls(
            postal_code=row["POSTAL_CODE"],
            city=row["CITY"],
            province_abbr=row["PROVINCE_ABBR"],
            timezone=row["TIME_ZONE"],
            latitude=float(row["LATITUDE"]),
            longitude=float(row["LONGITUDE"]),
        )
