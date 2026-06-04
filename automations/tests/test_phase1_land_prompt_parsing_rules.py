"""Offline (no API key) rules + fixture-integrity tests for Phase 1 LAND parsing.

The LLM accuracy measurement lives in eval_phase1_land_fixtures.py (manual, costs money).
These tests lock the land prompt invariants, the land routing rules, and the land fixture
file's structural integrity so CI catches regressions without any network calls. Mirrors
test_phase1_air_prompt_parsing_rules.py.
"""

import json
import os
import sys
from pathlib import Path


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import phase_1_request_analysis as p1


LAND_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "phase1_land_prompt_eval_cases.txt"
VALID_ACTIONS = {"complete", "need_port_data", "need_door_data"}


# --------------------------------------------------------------------------- #
# Land system prompt invariants
# --------------------------------------------------------------------------- #
def test_land_prompt_enforces_land_mode_and_empty_containers_pieces():
    prompt = p1.AI_SYSTEM_PROMPT_LAND.upper()
    assert 'FREIGHT_MODE MUST ALWAYS BE "LAND"' in prompt
    assert "CONTAINERS MUST ALWAYS BE AN EMPTY ARRAY" in prompt
    assert "PIECES MUST ALWAYS BE AN EMPTY ARRAY" in prompt


def test_land_prompt_extracts_land_specific_fields():
    prompt = p1.AI_SYSTEM_PROMPT_LAND.upper()
    for marker in ("ORIGIN_ZIP", "DESTINATION_ZIP", "WEIGHT_LBS",
                   "EQUIPMENT_TYPE", "LOAD_TYPE", "NMFC_CLASS", "ACCESSORIALS"):
        assert marker in prompt, f"land prompt missing {marker}"


def test_land_prompt_load_type_mappings():
    prompt = p1.AI_SYSTEM_PROMPT_LAND.upper()
    assert '"FTL"' in prompt and '"LTL"' in prompt and '"PTL"' in prompt
    assert "DRY VAN" in prompt and "FLATBED" in prompt and "REEFER" in prompt


def test_land_prompt_enforces_raw_json_and_concise_reasoning():
    prompt = p1.AI_SYSTEM_PROMPT_LAND.upper()
    assert "RAW JSON ONLY" in prompt
    assert "CONCISE DETERMINISTIC SUMMARY" in prompt


# --------------------------------------------------------------------------- #
# Mode prompt selector
# --------------------------------------------------------------------------- #
def test_get_system_prompt_for_mode_routes_land():
    assert p1._get_system_prompt_for_mode("land") is p1.AI_SYSTEM_PROMPT_LAND


# --------------------------------------------------------------------------- #
# Land normalizers + truck-detail builder
# --------------------------------------------------------------------------- #
def test_normalize_load_type():
    assert p1.normalize_load_type("ftl") == "FTL"
    assert p1.normalize_load_type(" LTL ") == "LTL"
    assert p1.normalize_load_type("ptl") == "PTL"
    assert p1.normalize_load_type("bogus") is None
    assert p1.normalize_load_type(None) is None


def test_normalize_zip_and_accessorials():
    assert p1.normalize_zip(" 90210 ") == "90210"
    assert p1.normalize_zip("n/a") is None
    assert p1.normalize_accessorials(["liftgate", " ", "residential"]) == ["liftgate", "residential"]
    assert p1.normalize_accessorials("liftgate") == ["liftgate"]


def test_build_truck_detail_from_land_shipment():
    detail = p1._build_truck_detail({
        "equipment_type": "REEFER",
        "load_type": "ltl",
        "weight_lbs": 4000,
        "nmfc_class": "70",
        "commodity_description": "frozen food",
        "is_dangerous_goods": False,
        "accessorials": ["liftgate"],
        "origin_zip": "90001",
        "destination_zip": "60601",
    })
    assert detail is not None
    assert detail["load_type"] == "LTL"
    assert detail["weight_lbs"] == 4000
    assert detail["nmfc_class"] == "70"
    assert detail["accessorials"] == ["liftgate"]
    assert detail["origin_zip"] == "90001"


def test_build_truck_detail_falls_back_to_kg_conversion():
    detail = p1._build_truck_detail({"cargo_weight_kg": 1000, "load_type": "FTL"})
    assert detail is not None
    # 1000 kg -> ~2204.62 lbs
    assert abs(detail["weight_lbs"] - 2204.62) < 1.0


def test_build_truck_detail_returns_none_when_empty():
    assert p1._build_truck_detail({}) is None


# --------------------------------------------------------------------------- #
# Land routing rules (deterministic, no LLM): no container/piece requirement
# --------------------------------------------------------------------------- #
def _land_shipment(**overrides):
    base = {
        "freight_mode": "land",
        "pol": "LOS ANGELES",
        "pod": "CHICAGO",
        "pod_hint": [],
        "containers": [],
        "pieces": [],
        "date": "2026-03-08",
        "service_type": "port-to-port",
    }
    base.update(overrides)
    return base


def test_land_complete_when_pol_pod_date_present():
    s = p1.validate_shipment(_land_shipment(), 0)
    assert s["freight_mode"] == "land"
    assert s["containers"] == []
    assert p1.determine_routing_action([s]) == "complete"


def test_land_does_not_require_containers_or_pieces():
    s = p1.validate_shipment(_land_shipment(), 0)
    missing = p1.get_missing_port_fields(s)
    assert "containers" not in missing
    assert "pieces" not in missing


def test_land_missing_date_routes_to_need_port_data():
    s = p1.validate_shipment(_land_shipment(date=None), 0)
    assert p1.determine_routing_action([s]) == "need_port_data"


def test_land_missing_destination_routes_to_need_port_data():
    s = p1.validate_shipment(_land_shipment(pod=None), 0)
    assert "pod" in p1.get_missing_port_fields(s)
    assert p1.determine_routing_action([s]) == "need_port_data"


# --------------------------------------------------------------------------- #
# Land fixture file integrity
# --------------------------------------------------------------------------- #
def _load_fixtures():
    return json.loads(LAND_FIXTURE_PATH.read_text())


def test_land_fixture_has_at_least_50_land_cases():
    cases = _load_fixtures()
    land_cases = [c for c in cases if c["expected"]["freight_mode"] == "land"]
    assert len(land_cases) >= 50, f"need >=50 land fixtures, found {len(land_cases)}"


def test_land_fixture_has_ocean_and_air_decoys():
    cases = _load_fixtures()
    modes = {c["expected"]["freight_mode"] for c in cases}
    assert "ocean" in modes and "air" in modes


def test_land_fixture_ids_are_unique():
    cases = _load_fixtures()
    ids = [c["id"] for c in cases]
    assert len(ids) == len(set(ids))


def test_land_fixture_land_cases_are_well_formed():
    cases = _load_fixtures()
    for case in cases:
        exp = case["expected"]
        assert exp["action"] in VALID_ACTIONS, case["id"]
        email = case["email"]
        for key in ("subject", "from", "received_at", "body"):
            assert email.get(key), f"{case['id']} missing email.{key}"
        if exp["freight_mode"] != "land":
            continue
        for ship in exp["shipments"]:
            assert ship["containers"] == [], f"{case['id']} land shipment must have empty containers"
            assert ship["pieces"] == [], f"{case['id']} land shipment must have empty pieces"
            assert ship["load_type"] in ("FTL", "LTL", "PTL"), case["id"]
            assert ship["origin_zip"], f"{case['id']} land shipment must have origin_zip"
            assert ship["destination_zip"], f"{case['id']} land shipment must have destination_zip"


def test_land_fixture_complete_p2p_cases_satisfy_routing_rule():
    """Port-to-port land fixtures labelled action=complete must satisfy the land routing rule.

    Door cases are excluded: the offline rule would otherwise demand pickup/delivery
    addresses that aren't always part of the scored expected schema.
    """
    cases = _load_fixtures()
    for case in cases:
        exp = case["expected"]
        if exp["freight_mode"] != "land" or exp["action"] != "complete":
            continue
        if any(s.get("service_type") != "port-to-port" for s in exp["shipments"]):
            continue
        shipments = [p1.validate_shipment({**s, "freight_mode": "land"}, i)
                     for i, s in enumerate(exp["shipments"])]
        assert p1.determine_routing_action(shipments) == "complete", (
            f"{case['id']} labelled complete but routing disagrees"
        )
