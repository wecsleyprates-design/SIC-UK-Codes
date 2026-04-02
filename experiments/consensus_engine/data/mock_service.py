"""
Mock Enrichment Service
==========================
Simulates API calls to OpenCorporates, ZoomInfo, Equifax, Trulioo, and AI
by generating realistic source signals from a company name and website.
Used for the Interactive Simulator in the dashboard.
"""

from __future__ import annotations
import random
from data.synthetic_entities import EntityInput, SourceSignal, UK_SIC_LABELS, NAICS_LABELS, US_SIC_LABELS, ALL_JURISDICTIONS

# ---------------------------------------------------------------------------
# Knowledge Base: Keywords → Likely Industry Codes
# ---------------------------------------------------------------------------

KEYWORD_MAP = {
    "pizza":      {"uk_sic": "56101", "naics": "722511", "label": "Pizza Restaurant", "sector": "food"},
    "restaurant": {"uk_sic": "56101", "naics": "722511", "label": "Full-Service Restaurant", "sector": "food"},
    "food":       {"uk_sic": "56101", "naics": "722511", "label": "Food Services", "sector": "food"},
    "cafe":       {"uk_sic": "56101", "naics": "722511", "label": "Cafe/Restaurant", "sector": "food"},
    "holding":    {"uk_sic": "64205", "naics": "551112", "label": "Holding Company", "sector": "holding"},
    "invest":     {"uk_sic": "64205", "naics": "551112", "label": "Investment Holding", "sector": "holding"},
    "group":      {"uk_sic": "64205", "naics": "551112", "label": "Group Activities", "sector": "holding"},
    "tech":       {"uk_sic": "62020", "naics": "541512", "label": "IT Consultancy", "sector": "tech"},
    "software":   {"uk_sic": "62012", "naics": "541511", "label": "Software Development", "sector": "tech"},
    "digital":    {"uk_sic": "62020", "naics": "541512", "label": "Digital Services", "sector": "tech"},
    "app":        {"uk_sic": "62012", "naics": "541511", "label": "App Development", "sector": "tech"},
    "consult":    {"uk_sic": "70229", "naics": "541611", "label": "Management Consultancy", "sector": "services"},
    "market":     {"uk_sic": "73110", "naics": "541810", "label": "Advertising Agency", "sector": "services"},
    "grocery":    {"uk_sic": "47110", "naics": "445110", "label": "Retail Grocery", "sector": "retail"},
    "shop":       {"uk_sic": "47190", "naics": "452990", "label": "General Retail", "sector": "retail"},
    "estate":     {"uk_sic": "68209", "naics": "531120", "label": "Real Estate Leasing", "sector": "real_estate"},
    "property":   {"uk_sic": "68209", "naics": "531120", "label": "Property Management", "sector": "real_estate"},
}

DEFAULT_INDUSTRY = {"uk_sic": "82990", "naics": "561499", "label": "Other Business Support", "sector": "other"}


class MockEnrichmentService:
    """
    Simulates the Worth AI data ingestion pipeline.
    Generates a set of SourceSignals from high-level input.
    """

    def enrich(self, name: str, website: str = "", country: str = "gb") -> EntityInput:
        # Normalize country to lowercase
        country = (country or "gb").lower()
        
        # 1. Determine base industry from keywords
        combined = (name + " " + website).lower()
        industry = DEFAULT_INDUSTRY
        for kw, mapping in KEYWORD_MAP.items():
            if kw in combined:
                industry = mapping
                break
        
        sources: list[SourceSignal] = []
        is_holding_pattern = "holding" in combined or "group" in combined
        
        # Helper to get descriptive labels
        def get_label(tax, code):
            if tax == "uk_sic_2007": return UK_SIC_LABELS.get(code, "Unknown UK SIC")
            if tax == "naics_2022": return NAICS_LABELS.get(code, f"NAICS {code}")
            if tax == "us_sic": return US_SIC_LABELS.get(code, "Unknown US SIC")
            return "Unknown"

        # Determine Registry Taxonomy
        # If it's a US state (us_*) or us itself, use NAICS. If it's gb, use UK SIC.
        is_us_centric = country.startswith("us_") or country == "us"
        reg_tax = "naics_2022" if is_us_centric else ("uk_sic_2007" if country == "gb" else "naics_2022")
        reg_code = industry["naics"] if is_us_centric else (industry["uk_sic"] if country == "gb" else industry["naics"])

        # --- SOURCE 1: OpenCorporates (Registry) ---
        sources.append(SourceSignal(
            source="opencorporates",
            data_channel="api_call",
            taxonomy=reg_tax,
            raw_code=reg_code,
            raw_label=get_label(reg_tax, reg_code),
            confidence=0.95 + random.uniform(-0.05, 0.04),
            static_weight=0.9,
            retrieved_days_ago=random.randint(0, 30),
            is_primary_code=True,
            notes=f"Primary registration from {country.upper()} registry."
        ))
        
        if is_holding_pattern:
            hold_tax = "uk_sic_2007" if country == "gb" else "naics_2022"
            hold_code = "64205" if country == "gb" else "551112"
            sources.append(SourceSignal(
                source="opencorporates",
                data_channel="api_call",
                taxonomy=hold_tax,
                raw_code=hold_code,
                raw_label=get_label(hold_tax, hold_code),
                confidence=0.88,
                static_weight=0.9,
                retrieved_days_ago=random.randint(0, 30),
                is_primary_code=False,
                notes="Secondary registration code (Holding Company)."
            ))

        # --- SOURCE 2: ZoomInfo (Firmographic) ---
        sources.append(SourceSignal(
            source="zoominfo",
            data_channel="api_call",
            taxonomy="naics_2022",
            raw_code=industry["naics"],
            raw_label=NAICS_LABELS[industry["naics"]],
            confidence=0.82 + random.uniform(-0.1, 0.1),
            static_weight=0.8,
            retrieved_days_ago=random.randint(14, 90),
            is_primary_code=True,
            notes="Web-scraped firmographic data."
        ))

        # --- SOURCE 3: Equifax (Credit/Public Records) ---
        efx_code = industry["naics"]
        efx_stale = random.randint(180, 500)
        if is_holding_pattern and industry["sector"] != "holding":
            efx_code = "551112"
            
        sources.append(SourceSignal(
            source="equifax",
            data_channel="redshift_cache",
            taxonomy="naics_2022",
            raw_code=efx_code,
            raw_label=NAICS_LABELS[efx_code],
            confidence=0.75 + random.uniform(-0.15, 0.1),
            static_weight=0.7,
            retrieved_days_ago=efx_stale,
            is_primary_code=True,
            notes=f"Equifax record found (Staleness: {efx_stale} days)."
        ))

        # --- SOURCE 4: Trulioo (KYC/Identity) ---
        tru_code = industry["uk_sic"] if country == "gb" else industry["naics"]
        tru_tax = "uk_sic_2007" if country == "gb" else "naics_2022"
        tru_notes = "KYC signal."
        
        if country == "gb" and random.random() > 0.5:
            tru_code = "5812" if industry["sector"] == "food" else "7371"
            tru_tax = "us_sic"
            tru_notes = "KYC signal (US-SIC taxonomy pollution detected)."

        sources.append(SourceSignal(
            source="trulioo",
            data_channel="api_call",
            taxonomy=tru_tax,
            raw_code=tru_code,
            raw_label=get_label(tru_tax, tru_code),
            confidence=0.68 + random.uniform(-0.1, 0.2),
            static_weight=0.8,
            retrieved_days_ago=0,
            is_primary_code=True,
            notes=tru_notes
        ))

        # --- SOURCE 5: AI Enrichment (Web Analysis) ---
        sources.append(SourceSignal(
            source="ai_enrichment",
            data_channel="ai_web_scrape",
            taxonomy="naics_2022",
            raw_code=industry["naics"],
            raw_label=NAICS_LABELS[industry["naics"]],
            confidence=0.85 + random.uniform(-0.05, 0.1),
            static_weight=0.1,
            retrieved_days_ago=random.randint(0, 7),
            is_primary_code=True,
            notes=f"LLM analysis of {website if website else name}: '{industry['label']}' pattern confirmed."
        ))

        return EntityInput(
            business_id=f"sim_{random.randint(1000, 9999)}",
            entity_name=name,
            entity_country=country,
            archetype="USER_SIMULATION",
            sources=sources,
            ground_truth_code=industry["uk_sic"] if country == "gb" else industry["naics"],
            ground_truth_taxonomy="uk_sic_2007" if country == "gb" else "naics_2022",
            archetype_description="User-generated simulation for interactive testing.",
            entity_age_years=5.0,
            revenue_band="1M-10M",
            has_group_structure=is_holding_pattern
        )
