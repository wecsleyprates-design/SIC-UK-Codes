"""
National Provider Identifier (NPI) Automation and Matching Service.

Handles automated updates of NPI data (healthcare provider registry) and
provides name matching for individual healthcare providers.

NPIAutomationService:
- Downloads weekly NPI data files from CMS
- Performs incremental updates to avoid full reloads
- Loads data into Redshift warehouse

NPIMatchService:
- Matches healthcare provider names (first + last)
- Uses Damerau-Levenshtein distance for fuzzy matching
- Handles name variations and typos

Use cases:
- Healthcare provider verification
- Medical practice matching
- Provider network validation
"""

import logging

from datapooler.adapters.db.models import NPIUpdateRunsDb
from datapooler.adapters.db.repositories.npi_automation_repository import (
    NPIAutomationRepository,
    NPIFileRepository,
)
from datapooler.models import businesses


class NPIAutomationService:
    """
    Automated NPI data update service.

    Downloads and loads NPI (National Provider Identifier) data from CMS
    into the data warehouse on a regular schedule.
    """

    def __init__(self):
        self._logger = logging.getLogger(__name__)
        self.npi_repository = NPIAutomationRepository()
        self.npi_file_repository = NPIFileRepository()
        self.last_run = self.npi_repository.get_last_update_run()
        self.download_link = self.npi_file_repository.get_download_link()

    def perform(self) -> NPIUpdateRunsDb:
        """
        Perform an NPI update using the provided data.
        """

        if not self.download_link:
            raise RuntimeError("No download link available for NPI data.")

        new_npi_run, file_map = self.npi_file_repository.download(self.download_link, self.last_run)

        self._logger.info(f"Starting NPI update run: {new_npi_run.id} for URL: {new_npi_run.url}")

        self.npi_repository.load(new_npi_run, file_map)

        self._logger.info(f"NPI update run {new_npi_run.id} completed successfully.")

        return new_npi_run


class NPIMatchService:
    """
    Name matching service for healthcare providers.

    Compares Worth business owner names against NPI registry names
    using fuzzy string matching to account for variations and typos.
    """

    def __init__(
        self, worth_business: businesses.WorthBusiness, npi_business: businesses.NPIBusiness
    ):
        self.worth_business = worth_business
        self.npi_business = npi_business
        self._logger = logging.getLogger(__name__ + "." + self.__class__.__name__)

    def is_name_match(self) -> bool:
        """
        Check if provider names match between Worth and NPI records.

        Compares first and last names independently using fuzzy matching.
        Both names must match for overall match to be True.

        Returns:
            True if both first and last names match within threshold
        """
        if self.worth_business.extra.first_name is None or self.npi_business.first_name is None:
            return False

        if self.npi_business.last_name is None or self.worth_business.extra.last_name is None:
            return False

        return self._name_match(
            self.worth_business.extra.first_name, self.npi_business.first_name, "first"
        ) and self._name_match(
            self.worth_business.extra.last_name, self.npi_business.last_name, "last"
        )

    def _damerau_levenshtein_distance(self, s1: str, s2: str) -> int:
        """
        Calculate Damerau-Levenshtein distance between two strings.

        Measures edit distance allowing:
        - Insertions
        - Deletions
        - Substitutions
        - Transpositions (swapped adjacent characters)

        Args:
            s1: First string
            s2: Second string

        Returns:
            Minimum number of edits needed to transform s1 into s2

        Example:
            "JOHN" vs "JON" -> 1 (one deletion)
            "JOHN" vs "JONH" -> 1 (one transposition)
        """
        len1, len2 = len(s1), len(s2)

        # Handle empty string cases
        if len1 == 0:
            return len2
        if len2 == 0:
            return len1

        # Ensure s1 is the shorter string for optimization
        if len1 > len2:
            s1, s2 = s2, s1
            len1, len2 = len2, len1

        # Initialize distance matrix rows
        prev_row = list(range(len2 + 1))
        curr_row = [0] * (len2 + 1)
        prev_prev_row = [0] * (len2 + 1)

        for i in range(1, len1 + 1):
            curr_row[0] = i
            for j in range(1, len2 + 1):
                # Calculate costs for different operations
                cost = 0 if s1[i - 1] == s2[j - 1] else 1

                deletion = prev_row[j] + 1
                insertion = curr_row[j - 1] + 1
                substitution = prev_row[j - 1] + cost

                curr_row[j] = min(deletion, insertion, substitution)

                # Handle transposition (Damerau extension)
                if i > 1 and j > 1 and s1[i - 1] == s2[j - 2] and s1[i - 2] == s2[j - 1]:
                    curr_row[j] = min(curr_row[j], prev_prev_row[j - 2] + cost)

            # Rotate rows for next iteration
            prev_prev_row, prev_row, curr_row = prev_row, curr_row, prev_prev_row

        return prev_row[len2]

    def _name_match(self, name_1: str, name_2: str, kind: str = "first") -> bool:
        """Check if two names match based on the specified kind."""
        name_1 = name_1.replace("-", " ")
        name_2 = name_2.replace("-", " ")
        if name_1 == name_2:
            return True

        # Determine shorter and longer names
        short, long = (name_1, name_2) if len(name_1) <= len(name_2) else (name_2, name_1)

        if kind == "first":
            # Naively handle middle names
            if " " in short:
                short = short.split(" ")[0]
            # Handle abbreviated first names (e.g., SAM == SAMUEL)
            if short == long[: len(short)]:
                return True
            distance = min(
                self._damerau_levenshtein_distance(short, name) for name in long.split(" ")
            )

        elif kind == "last":
            # Handle hyphenated last names
            if " " in long and " " not in short:
                distance = min(
                    self._damerau_levenshtein_distance(short, name) for name in long.split(" ")
                )
            else:
                distance = self._damerau_levenshtein_distance(short, long)

        return distance <= 1

    def is_npi_match(self) -> bool:
        """Check if the NPI numbers match."""
        if self.worth_business.extra.npi is None or self.npi_business.npi is None:
            return False

        return self.worth_business.extra.npi == self.npi_business.npi
