import os
import sys
from datetime import datetime, timezone


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import phase_2_quote_analysis as p2


def test_trim_agent_reply_removes_quoted_history_blocks():
    body = (
        "Dear team,\n"
        "Shenzhen to Jebel Ali USD1900/40HQ by SSL\n"
        "14 days free time\n"
        "-----Original Message-----\n"
        "From: sales@example.com\n"
        "Older message\n"
    )
    trimmed = p2.trim_agent_reply(body)

    assert "USD1900/40HQ" in trimmed
    assert "Original Message" not in trimmed
    assert "Older message" not in trimmed


def test_build_shipment_context_groups_containers_by_route():
    rfq = {
        "pol": "SHENZHEN\nSHENZHEN\nQINGDAO",
        "pod": "JEBEL ALI\nJEBEL ALI\nJEBEL ALI",
        "container_type": "40HQ\n20GP\n40HQ",
        "qty": "2\n1\n1",
        "service_type": "port-to-port",
    }
    context = p2.build_shipment_context(rfq)

    assert context["shipment_count"] == 2
    assert context["shipments"][0]["shipment_number"] == 1
    assert context["shipments"][0]["pol"] == "SHENZHEN"
    assert context["shipments"][0]["containers"] == [
        {"qty": 2, "type": "40HQ"},
        {"qty": 1, "type": "20GP"},
    ]
    assert context["shipments"][1]["shipment_number"] == 2
    assert context["shipments"][1]["pol"] == "QINGDAO"


def test_sanitize_extracted_quotes_filters_invalid_and_dedupes():
    anchor = datetime(2025, 12, 18, tzinfo=timezone.utc)
    parsed = [
        p2.QuoteData(
            shipment_number=1,
            price=1900,
            currency="USD",
            carrier="ssl",
            validity="rates valid to this vsl",
            transit_time=15,
            free_time=14,
            etd="12/20",
        ),
        p2.QuoteData(
            shipment_number=1,
            price=1900,
            currency="USD",
            carrier="SSL",
            validity=None,
            transit_time=15,
            free_time=14,
            etd="2025-12-20",
        ),
        p2.QuoteData(
            shipment_number=3,
            price=2100,
            currency="USD",
            carrier="MSK",
            validity=None,
            transit_time=20,
            free_time=14,
            etd="12/23",
        ),
        p2.QuoteData(
            shipment_number=1,
            price=0,
            currency="USD",
            carrier="MSC",
            validity=None,
            transit_time=15,
            free_time=14,
            etd="12/22",
        ),
    ]

    cleaned = p2.sanitize_extracted_quotes(
        parsed_quotes=parsed,
        shipment_count=2,
        anchor_date=anchor,
        has_explicit_shipment_mapping=True,
    )

    assert len(cleaned) == 1
    first = cleaned[0]
    assert first.shipment_number == 1
    assert first.carrier == "SSL"
    assert first.etd == "2025-12-20"
    assert first.validity is None


def test_sanitize_extracted_quotes_returns_empty_when_mapping_ambiguous():
    anchor = datetime(2025, 12, 18, tzinfo=timezone.utc)
    parsed = [
        p2.QuoteData(
            shipment_number=1,
            price=2000,
            currency="USD",
            carrier="COSCO",
            validity=None,
            transit_time=18,
            free_time=14,
            etd="12/20",
        )
    ]

    cleaned = p2.sanitize_extracted_quotes(
        parsed_quotes=parsed,
        shipment_count=2,
        anchor_date=anchor,
        has_explicit_shipment_mapping=False,
    )

    assert cleaned == []


def test_build_quote_match_key_creates_unique_keys_for_same_carrier_options():
    q1 = p2.QuoteData(
        shipment_number=1,
        price=1900,
        currency="USD",
        carrier="SSL",
        validity=None,
        transit_time=15,
        free_time=14,
        etd="2025-12-15",
    )
    q2 = p2.QuoteData(
        shipment_number=1,
        price=1900,
        currency="USD",
        carrier="SSL",
        validity=None,
        transit_time=15,
        free_time=14,
        etd="2025-12-20",
    )

    k1 = p2.build_quote_match_key("RFQ-1", "agent@example.com", q1)
    k2 = p2.build_quote_match_key("RFQ-1", "agent@example.com", q2)

    assert k1 != k2
    assert k1.startswith("RFQ-1_agent@example.com_1_SSL_")
    assert k2.startswith("RFQ-1_agent@example.com_1_SSL_")


def test_system_prompt_contains_non_ocean_charge_exclusions():
    prompt = p2.AI_SYSTEM_PROMPT.upper()
    for marker in ("EXW", "THC", "DOC", "CUS", "ENS", "NOC", "INSPECTION", "TLX", "CO"):
        assert marker in prompt


# =====================================================================
# FREIGHT MODE TESTS
# =====================================================================

def test_normalize_carrier_passthrough_for_air():
    """Air freight: carrier name returned as cleaned uppercase, not aliased to ocean carrier."""
    assert p2.normalize_carrier("Emirates SkyCargo", freight_mode="air") == "EMIRATES SKYCARGO"
    assert p2.normalize_carrier("qatar airways cargo", freight_mode="air") == "QATAR AIRWAYS CARGO"


def test_normalize_carrier_passthrough_for_land():
    """Land freight: carrier name returned as cleaned uppercase, not aliased."""
    assert p2.normalize_carrier("Al Futtaim Logistics", freight_mode="land") == "AL FUTTAIM LOGISTICS"


def test_normalize_carrier_ocean_unchanged():
    """Ocean carrier aliasing still works."""
    assert p2.normalize_carrier("cosco shipping") == "COSCO"
    assert p2.normalize_carrier("MSC") == "MSC"
    assert p2.normalize_carrier("hapag lloyd") == "HAPAG-LLOYD"


def test_surcharge_data_air_fields():
    """SurchargeData accepts air surcharge fields."""
    sc = p2.SurchargeData(FSC=1.5, SSC=0.3, TSA=0.1, handling=50.0, dg_surcharge=100.0)
    assert sc.FSC == 1.5
    assert sc.SSC == 0.3
    assert sc.TSA == 0.1
    assert sc.handling == 50.0
    assert sc.dg_surcharge == 100.0
    # Ocean fields should be None
    assert sc.BAF is None


def test_surcharge_data_land_fields():
    """SurchargeData accepts land surcharge fields."""
    sc = p2.SurchargeData(fuel_surcharge=200.0, detention=150.0, accessorials=75.0)
    assert sc.fuel_surcharge == 200.0
    assert sc.detention == 150.0
    assert sc.accessorials == 75.0


def test_get_quote_system_prompt_for_mode():
    """Dispatcher returns correct prompt for each mode."""
    assert p2._get_quote_system_prompt_for_mode("air") is p2.AI_SYSTEM_PROMPT_AIR_QUOTE
    assert p2._get_quote_system_prompt_for_mode("land") is p2.AI_SYSTEM_PROMPT_LAND_QUOTE
    assert p2._get_quote_system_prompt_for_mode("ocean") is p2.AI_SYSTEM_PROMPT
    assert p2._get_quote_system_prompt_for_mode("unknown") is p2.AI_SYSTEM_PROMPT


def test_quote_data_freight_mode_default():
    """QuoteData defaults freight_mode to 'ocean'."""
    q = p2.QuoteData()
    assert q.freight_mode == "ocean"
    q_air = p2.QuoteData(freight_mode="air")
    assert q_air.freight_mode == "air"


def test_air_quote_prompt_contains_mode():
    """Air quote prompt mentions air cargo."""
    prompt = p2.AI_SYSTEM_PROMPT_AIR_QUOTE.upper()
    assert "AIR" in prompt
    assert "FSC" in prompt
    assert "SSC" in prompt


def test_land_quote_prompt_contains_mode():
    """Land quote prompt mentions trucking."""
    prompt = p2.AI_SYSTEM_PROMPT_LAND_QUOTE.upper()
    assert "LAND" in prompt or "TRUCKING" in prompt
    assert "FUEL_SURCHARGE" in prompt
    assert "DETENTION" in prompt


def test_build_shipment_context_includes_freight_mode():
    """build_shipment_context includes freight_mode in output."""
    rfq = {
        "pol": "SHANGHAI",
        "pod": "JEBEL ALI",
        "container_type": "40HQ",
        "qty": "2",
        "service_type": "port-to-port",
        "freight_mode": "air",
    }
    context = p2.build_shipment_context(rfq)
    assert context["freight_mode"] == "air"


def test_sanitize_with_air_surcharges():
    """Sanitization handles air surcharges correctly."""
    from datetime import datetime, timezone
    anchor = datetime(2026, 3, 5, tzinfo=timezone.utc)
    quote = p2.QuoteData(
        freight_mode="air",
        shipment_number=1,
        price=3.5,
        carrier="EMIRATES SKYCARGO",
        surcharges=p2.SurchargeData(FSC=1.5, SSC=-0.5, handling=50.0),
    )
    result = p2.sanitize_extracted_quotes(
        parsed_quotes=[quote],
        shipment_count=1,
        anchor_date=anchor,
        has_explicit_shipment_mapping=False,
    )
    assert len(result) == 1
    assert result[0].surcharges.FSC == 1.5
    assert result[0].surcharges.SSC is None  # negative → None
    assert result[0].surcharges.handling == 50.0
