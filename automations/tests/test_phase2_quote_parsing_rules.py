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
