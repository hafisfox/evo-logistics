import os
import sys


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import phase_3_select_and_quote as p3


def _request(**overrides):
    base = {
        "rfq_id": "RFQ-1",
        "workspace_id": "ws-1",
        "selected_by_user_id": "user-1",
        "selected_agent": "Agent A",
        "selected_carrier": "COSCO",
        "selected_match": "RFQ-1_agenta@example.com_1_COSCO_a1b2c3d4",
        "shipment_number": "1",
        "selected_by": "dashboard",
        "margin": 0.13,
        "quote_threshold": 2,
    }
    base.update(overrides)
    return p3.SelectAgentRequest(**base)


def test_find_selected_quote_prefers_exact_match():
    all_quotes = [
        {
            "rfq_id": "RFQ-1",
            "match": "RFQ-1_agenta@example.com_1_COSCO_oldopt00",
            "agent_name": "Agent A",
            "carrier": "COSCO",
            "shipment_number": "1",
            "price": "1800",
        },
        {
            "rfq_id": "RFQ-1",
            "match": "RFQ-1_agenta@example.com_1_MSK_a1b2c3d4",
            "agent_name": "Agent A",
            "carrier": "MSK",
            "shipment_number": "1",
            "price": "1700",
        },
    ]
    request = _request(
        selected_carrier="COSCO",
        selected_match="RFQ-1_agenta@example.com_1_MSK_a1b2c3d4",
    )

    selected = p3._find_selected_quote(all_quotes, request)
    assert selected["carrier"] == "MSK"
    assert selected["match"] == "RFQ-1_agenta@example.com_1_MSK_a1b2c3d4"


def test_find_selected_quote_falls_back_when_selected_match_missing():
    all_quotes = [
        {
            "rfq_id": "RFQ-1",
            "match": "RFQ-1_agenta@example.com_1_COSCO_oldopt00",
            "agent_name": "Agent A",
            "carrier": "COSCO",
            "shipment_number": "1",
            "price": "1800",
        },
    ]
    request = _request(selected_match="")

    selected = p3._find_selected_quote(all_quotes, request)
    assert selected["carrier"] == "COSCO"
    assert selected["match"] == "RFQ-1_agenta@example.com_1_COSCO_oldopt00"
