import logging
import re
import unicodedata

from datapooler import constants
from datapooler.models import businesses

COMBINDED_ADDRESS_MAPPINGS = {
    **constants.STREET_ABBREVIATIONS,
    **constants.DIRECTIONS,
    **constants.SECONDARY_ABBREVIATIONS,
    **constants.STATE_ABBREVIATIONS,
}

ADD_PART_REPLACE_PATTERN = re.compile(
    r"\b(" + "|".join(map(re.escape, COMBINDED_ADDRESS_MAPPINGS.keys())) + r")\b"
)


class BusinessProcessingService:
    def __init__(self, business: "businesses.WorthBusiness"):
        self.business = business
        self._logger = logging.getLogger(__name__ + "." + self.__class__.__name__)

    @staticmethod
    def prepare_address(address: str) -> str:
        def replace_match(match):
            return COMBINDED_ADDRESS_MAPPINGS[match.group(0)]

        return re.sub(ADD_PART_REPLACE_PATTERN, replace_match, address.upper())

    @property
    def street_name(self) -> str | None:
        if not self.business.address:
            return None

        if matches := re.match(r"^\d+\s+([^,]+)", self.business.address):
            try:
                return matches.group(1).strip()
            except Exception:
                self._logger.exception(f"Error generating street name from {matches}")
                return None
        return None

    @property
    def street_number(self) -> int | None:
        if not self.business.address:
            return None

        if matches := re.match(r"^\d+", self.business.address):
            try:
                return int(matches.group(0))
            except Exception:
                self._logger.exception(
                    f"Failed to convert the street number '{matches.group(0)}' to an integer",
                )
                return None

        return None

    @staticmethod
    def fill_zip(zip: str) -> str:
        if any(c.isalpha() for c in zip):
            return zip

        # Ensure first part of zip is 5 digits long
        elif "-" in zip:
            zip_parts = zip.split("-")
            zip = zip_parts[0].rjust(5, "0") + "-" + zip_parts[1]

        else:
            zip = zip.rjust(5, "0")

        return zip

    @staticmethod
    def normalize_zip(zip: str | None) -> str:
        if zip is None:
            return ""

        if any(
            [
                re.match(constants.UK_POSTAL_CODE_PATTERN, zip),
                re.match(constants.IE_POSTAL_CODE_PATTERN, zip),
            ]
        ):
            # We just want to return the zip as is, but ensure
            # it's uppercased and stripped of spaces
            return zip.upper().replace(" ", "")

        # for Canadian postal codes, we want to ensure it's 6 characters long
        if any(c.isalpha() for c in zip):
            return zip.upper().replace(" ", "")[:6]

        # for US zip codes, we want to ensure it's 5 digits long
        return zip[:5]

    @staticmethod
    def is_valid_uk_postal_code(zip: str) -> bool:
        return bool(re.match(constants.UK_POSTAL_CODE_PATTERN, zip))

    @staticmethod
    def zip3(zip: str) -> str | None:
        return zip[:3] if zip else None

    @staticmethod
    def country_code(country: str) -> str | None:
        if len(country) == 2:
            return country

        return constants.SUPPORTED_COUNTRIES.get(country.upper(), None)

    def region_abbreviation(self) -> str | None:
        if self.business.state is None:
            return None

        if self.business.country_code == "GB":
            # Determine Locality based off the UK postal code
            if abbreviation := re.match(constants.UK_POSTAL_CODE_PREFIX_PATTERN, self.business.zip):
                return abbreviation.group(0)
            return None

        # Determine locality based off the first 3 characters of the irish postal code
        if self.business.country_code == "IE":
            return self.business.zip3

        if (
            len(self.business.state) == 2
            and self.business.state.upper() in constants.STATE_ABBREVIATIONS.values()
        ):
            return self.business.state.upper()

        return constants.STATE_ABBREVIATIONS.get(self.business.state.upper())

    def normalize_address(self) -> str:
        def replace_match(match):
            return COMBINDED_ADDRESS_MAPPINGS[match.group(0)]

        return re.sub(ADD_PART_REPLACE_PATTERN, replace_match, self.business.address.upper())

    def shingify(self, attr: str, k: int = 1, by_word: bool = False) -> set[str]:
        shingle = set()

        if (attribute := getattr(self.business, attr)) is None:
            shingle.add("")
        elif by_word:
            shingle = shingle.union(attribute.split(" "))
        elif len(attribute) <= k:
            shingle.add(attribute)
        else:
            for index in range(len(attribute) - k + 1):
                shingle.add(attribute[index : index + k])

        return shingle

    @property
    def short_name(self) -> str:
        return self._short_name(self.business.canonical_name, self.business.city)

    def _short_name(self, name, city: str) -> str:
        if city is None:
            city = "@"
        return "".join((word for word in name.split() if word not in ["AND"] + city.split()))

    def sanitize_name(self, name: str) -> str:
        name = name.upper().strip()
        name = self._replace_accents_diacritics(name)
        name = self._replace_french_characters(name)

        # handling the edgecase of a french name starting with L’
        prefix = ""
        if name[:2] == "L’":
            prefix = name[:2]
            name = name[2:]

        name = self._replace_special_characters(name)
        name = prefix + name
        name = self._remove_excess_whitespace(name)
        return name

    def _replace_accents_diacritics(self, string: str) -> str:
        string = unicodedata.normalize("NFKD", string)
        string = "".join((char for char in string if not unicodedata.combining(char)))
        return string

    def _replace_french_characters(self, string: str) -> str:
        return string.replace("Æ", "A").replace("Œ", "O").replace("'", "’")

    def _replace_special_characters(self, string: str) -> str:
        string = string.replace("&", " AND ")
        string = re.sub(r"[-’/]", " ", string)
        string = re.sub(r"[^A-Z 0-9]", "", string)
        return string

    def _remove_excess_whitespace(self, string: str) -> str:
        return re.sub(r"\s+", " ", string).strip()

    def canonize_name(self, name: str) -> str:
        name = name.replace("’", "’ ")  # for the edgecase of L’
        for part, values in constants.NORMALIZATION_WORD_PARTS.items():
            match part:
                case "prefix":
                    name = self._strip_prefix(name, values)
                case "suffix":
                    name = self._strip_suffix(name, values)
                    name = self._strip_suffix(name, values)
        return name

    def _strip_prefix(self, string: str, values: list[str]) -> str:
        return re.sub(rf"^({"|".join(values)}) ", "", string)

    def _strip_suffix(self, string: str, values: list[str]) -> str:
        return re.sub(rf" ({"|".join(values)})$", "", string)
