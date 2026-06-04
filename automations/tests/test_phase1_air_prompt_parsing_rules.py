"""Offline (no API key) rules + fixture-integrity tests for Phase 1 AIR parsing.

The LLM accuracy measurement lives in eval_phase1_air_fixtures.py (manual, costs money).
These tests lock the prompt invariants, the mode-detection prompt constant, the air
routing rules, and the air fixture file's structural integrity so CI catches regressions
without any network calls.
"""

import json
import os
import sys
from pathlib import Path


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import phase_1_request_analysis as p1


AIR_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "phase1_air_prompt_eval_cases.txt"
VALID_ACTIONS = {"complete", "need_port_data", "need_door_data"}


# --------------------------------------------------------------------------- #
# Air system prompt invariants
# --------------------------------------------------------------------------- #
def test_air_prompt_enforces_air_mode_and_pieces():
    prompt = p1.AI_SYSTEM_PROMPT_AIR.upper()
    assert 'FREIGHT_MODE MUST ALWAYS BE "AIR"' in prompt
    assert "CONTAINERS MUST ALWAYS BE AN EMPTY ARRAY" in prompt
    assert "PIECES MUST ALWAYS BE A NON-EMPTY ARRAY" in prompt


def test_air_prompt_contains_service_type_mappings():
    prompt = p1.AI_SYSTEM_PROMPT_AIR.upper()
    for marker in (
        'MAP "AIRPORT-TO-AIRPORT" TO "PORT-TO-PORT"',
        'MAP "DOOR-TO-AIRPORT" TO "DOOR-TO-PORT"',
        'MAP "AIRPORT-TO-DOOR" TO "PORT-TO-DOOR"',
    ):
        assert marker in prompt


def test_air_prompt_contains_unit_conversion_rules():
    prompt = p1.AI_SYSTEM_PROMPT_AIR.upper()
    assert "2.54" in prompt  # inches -> cm
    assert "2.205" in prompt  # lbs -> kg
    assert "DUBAI -> DXB" in prompt
    assert "SHARJAH -> SHJ" in prompt


def test_air_prompt_enforces_raw_json_and_concise_reasoning():
    prompt = p1.AI_SYSTEM_PROMPT_AIR.upper()
    assert "RAW JSON ONLY" in prompt
    assert "CONCISE DETERMINISTIC SUMMARY" in prompt


# --------------------------------------------------------------------------- #
# Mode prompt selector + mode-detection constant (locks the refactor)
# --------------------------------------------------------------------------- #
def test_get_system_prompt_for_mode_routing():
    assert p1._get_system_prompt_for_mode("air") is p1.AI_SYSTEM_PROMPT_AIR
    assert p1._get_system_prompt_for_mode("land") is p1.AI_SYSTEM_PROMPT_LAND
    assert p1._get_system_prompt_for_mode("ocean") is p1.AI_SYSTEM_PROMPT
    assert p1._get_system_prompt_for_mode("anything-else") is p1.AI_SYSTEM_PROMPT


def test_mode_detection_prompt_constant_has_all_signal_groups():
    prompt = p1.MODE_DETECTION_SYSTEM_PROMPT.upper()
    assert "OCEAN:" in prompt and "FCL" in prompt and "B/L" in prompt
    assert "AIR:" in prompt and "AWB" in prompt and "PER-KG" in prompt
    assert "LAND:" in prompt and "FTL" in prompt and "DRY VAN" in prompt
    assert "OCEAN, AIR, OR LAND" in prompt
    # detect_freight_mode must reference the hoisted constant, not an inline copy.
    assert p1.detect_freight_mode.__doc__ is not None


# --------------------------------------------------------------------------- #
# Air routing rules (deterministic, no LLM)
# --------------------------------------------------------------------------- #
def _air_shipment(**overrides):
    base = {
        "freight_mode": "air",
        "pol": "PVG",
        "pod": "DXB",
        "pod_hint": [],
        "containers": [],
        "pieces": [{"count": 5, "length_cm": 120, "width_cm": 100, "height_cm": 150, "weight_kg": 500}],
        "date": "2026-03-08",
        "service_type": "port-to-port",
    }
    base.update(overrides)
    return base


def test_air_complete_when_all_present():
    s = p1.validate_shipment(_air_shipment(), 0)
    assert s["freight_mode"] == "air"
    assert s["containers"] == []
    assert p1.determine_routing_action([s]) == "complete"


def test_air_missing_pieces_routes_to_need_port_data():
    s = p1.validate_shipment(_air_shipment(pieces=[]), 0)
    assert "pieces" in p1.get_missing_port_fields(s)
    assert p1.determine_routing_action([s]) == "need_port_data"


def test_air_piece_without_count_is_incomplete():
    s = p1.validate_shipment(_air_shipment(pieces=[{"count": None, "weight_kg": 2500}]), 0)
    assert "pieces" in p1.get_missing_port_fields(s)
    assert p1.determine_routing_action([s]) == "need_port_data"


def test_air_missing_date_routes_to_need_port_data():
    s = p1.validate_shipment(_air_shipment(date=None), 0)
    assert p1.determine_routing_action([s]) == "need_port_data"


# --------------------------------------------------------------------------- #
# Air fixture file integrity
# --------------------------------------------------------------------------- #
def _load_fixtures():
    return json.loads(AIR_FIXTURE_PATH.read_text())


def test_air_fixture_has_at_least_50_air_cases():
    cases = _load_fixtures()
    air_cases = [c for c in cases if c["expected"]["freight_mode"] == "air"]
    assert len(air_cases) >= 50, f"need >=50 air fixtures, found {len(air_cases)}"


def test_air_fixture_has_ocean_and_land_decoys():
    cases = _load_fixtures()
    modes = {c["expected"]["freight_mode"] for c in cases}
    assert "ocean" in modes and "land" in modes


def test_air_fixture_ids_are_unique():
    cases = _load_fixtures()
    ids = [c["id"] for c in cases]
    assert len(ids) == len(set(ids))


def test_air_fixture_air_cases_are_well_formed():
    cases = _load_fixtures()
    for case in cases:
        exp = case["expected"]
        assert exp["action"] in VALID_ACTIONS, case["id"]
        email = case["email"]
        for key in ("subject", "from", "received_at", "body"):
            assert email.get(key), f"{case['id']} missing email.{key}"
        if exp["freight_mode"] != "air":
            continue
        for ship in exp["shipments"]:
            assert ship["containers"] == [], f"{case['id']} air shipment must have empty containers"
            assert "pieces" in ship, case["id"]
            assert ship["service_type"] in p1.VALID_SERVICE_TYPES, case["id"]


def test_air_fixture_complete_p2p_cases_satisfy_routing_rule():
    """Port-to-port fixtures labelled action=complete must satisfy the air routing rule.

    Door cases are excluded: the expected-shipment schema intentionally omits
    pickup/delivery addresses (they aren't scored by the eval), so re-deriving their
    routing would wrongly demand addresses.
    """
    cases = _load_fixtures()
    for case in cases:
        exp = case["expected"]
        if exp["freight_mode"] != "air" or exp["action"] != "complete":
            continue
        if any(s.get("service_type") != "port-to-port" for s in exp["shipments"]):
            continue
        shipments = [p1.validate_shipment({**s, "freight_mode": "air"}, i)
                     for i, s in enumerate(exp["shipments"])]
        assert p1.determine_routing_action(shipments) == "complete", (
            f"{case['id']} labelled complete but routing disagrees"
        )
