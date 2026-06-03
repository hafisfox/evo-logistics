import os
import sys


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import phase_1_request_analysis as p1


def test_system_prompt_contains_origin_alternative_split_rule():
    prompt = p1.AI_SYSTEM_PROMPT.upper()
    assert "NANSHA,YANTIAN" in prompt
    assert "SPLIT INTO MULTIPLE SHIPMENTS" in prompt


def test_system_prompt_contains_fob_door_port_to_door_rule():
    prompt = p1.AI_SYSTEM_PROMPT.upper()
    assert "FOB + DOOR MUST MAP TO PORT-TO-DOOR" in prompt
    assert "PORT-TO-DOOR" in prompt


def test_system_prompt_contains_destination_mapping_markers():
    prompt = p1.AI_SYSTEM_PROMPT.upper()
    for marker in ("DUBAI", "DEIRA", "HAMAD PORT", "UMM AL QUWAIN"):
        assert marker in prompt


def test_system_prompt_enforces_concise_reasoning():
    prompt = p1.AI_SYSTEM_PROMPT.upper()
    assert "EXTRACTION_REASONING MUST BE CONCISE DETERMINISTIC SUMMARY" in prompt
    assert "MAX 2 SHORT SENTENCES" in prompt


def test_system_prompt_enforces_raw_json_and_container_whitelist():
    prompt = p1.AI_SYSTEM_PROMPT.upper()
    assert "RAW JSON ONLY" in prompt
    for container_type in ("20FT", "40FT", "40HC", "40HQ", "45FT", "20OT", "40OT"):
        assert container_type in prompt


def test_system_prompt_merges_duplicate_container_mentions_across_lines():
    prompt = p1.AI_SYSTEM_PROMPT.upper()
    assert "SUMMARY LINE AND A DETAILED LINE BOTH MENTION THE SAME CONTAINER" in prompt
    assert "SUM QUANTITIES INSTEAD OF OVERWRITING" in prompt
    assert "PATTERN F (DUPLICATE MENTIONS ACROSS LINES)" in prompt
    assert "CONTAINERS=[{\"QTY\":2,\"TYPE\":\"40FT\"}]" in prompt


def test_structured_user_envelope_contains_email_metadata_and_anchor_date():
    prompt = p1.build_phase1_extraction_prompt(
        subject="RFQ Request",
        sender="buyer@example.com",
        email_body="Please quote 1x40 from Shanghai to Jebel Ali.",
        received_at="Tue, 20 Jan 2026 08:00:00 +0400",
    )

    assert "EMAIL_METADATA" in prompt
    assert "email_received_at: 2026-01-20" in prompt
    assert "subject: RFQ Request" in prompt
    assert "from: buyer@example.com" in prompt
    assert "EMAIL_BODY" in prompt


# =====================================================================
# FREIGHT MODE TESTS
# =====================================================================

def test_shipment_data_has_freight_mode_field():
    """ShipmentData defaults freight_mode to 'ocean'."""
    s = p1.ShipmentData()
    assert s.freight_mode == "ocean"
    assert s.pieces == []


def test_shipment_data_freight_mode_validates():
    """ShipmentData accepts 'air' and 'land', rejects invalid values."""
    s_air = p1.ShipmentData(freight_mode="air")
    assert s_air.freight_mode == "air"
    s_land = p1.ShipmentData(freight_mode="land")
    assert s_land.freight_mode == "land"
    import pytest
    with pytest.raises(Exception):
        p1.ShipmentData(freight_mode="rail")


def test_piece_item_model():
    """PieceItem coerces string count to int."""
    p = p1.PieceItem(count="5", length_cm=120, width_cm=100, height_cm=150, weight_kg=500)
    assert p.count == 5
    assert p.length_cm == 120.0
    p_bad = p1.PieceItem(count="abc")
    assert p_bad.count is None


def test_normalize_type_bypasses_for_air():
    """normalize_type returns raw value for air freight (no validation)."""
    result = p1.normalize_type("PALLET", freight_mode="air")
    assert result == "PALLET"
    result = p1.normalize_type("ULD", freight_mode="air")
    assert result == "ULD"


def test_normalize_type_ocean_unchanged():
    """normalize_type preserves existing ocean behavior."""
    assert p1.normalize_type("40HC") == "40HC"
    assert p1.normalize_type("40HQ") == "40HC"  # alias
    assert p1.normalize_type("20FT") == "20FT"
    assert p1.normalize_type("INVALID_TYPE") is None


def test_system_prompt_air_contains_freight_mode():
    """Air prompt specifies freight_mode: air."""
    prompt = p1.AI_SYSTEM_PROMPT_AIR.upper()
    assert "AIR" in prompt
    assert "FREIGHT_MODE" in prompt.replace('"', '').replace("'", '')


def test_system_prompt_land_contains_freight_mode():
    """Land prompt specifies freight_mode: land."""
    prompt = p1.AI_SYSTEM_PROMPT_LAND.upper()
    assert "LAND" in prompt
    assert "FREIGHT_MODE" in prompt.replace('"', '').replace("'", '')


def test_get_system_prompt_for_mode():
    """_get_system_prompt_for_mode returns correct prompt."""
    assert p1._get_system_prompt_for_mode("air") is p1.AI_SYSTEM_PROMPT_AIR
    assert p1._get_system_prompt_for_mode("land") is p1.AI_SYSTEM_PROMPT_LAND
    assert p1._get_system_prompt_for_mode("ocean") is p1.AI_SYSTEM_PROMPT
    assert p1._get_system_prompt_for_mode("unknown") is p1.AI_SYSTEM_PROMPT


def test_validate_shipment_passes_freight_mode():
    """validate_shipment preserves freight_mode and pieces through validation."""
    s = {
        'freight_mode': 'air',
        'pol': 'PVG',
        'pod': 'DXB',
        'pod_hint': [],
        'containers': [],
        'pieces': [{'count': '10', 'length_cm': 120, 'width_cm': 100, 'height_cm': 150, 'weight_kg': 500, 'packaging_type': 'pallet'}],
        'date': '2026-03-15',
        'delivery_deadline': None,
        'service_type': 'port-to-port',
        'pickup_address': None,
        'delivery_address': None,
    }
    result = p1.validate_shipment(s, 0)
    assert result['freight_mode'] == 'air'
    assert len(result['pieces']) == 1
    assert result['pieces'][0]['count'] == 10
    assert result['pieces'][0]['length_cm'] == 120.0


def test_get_missing_port_fields_air_requires_pieces():
    """Air freight requires pieces instead of containers."""
    s = {
        'freight_mode': 'air',
        'pol': 'PVG',
        'pod': 'DXB',
        'pod_hint': [],
        'containers': [],
        'pieces': [],
        'date': '2026-03-15',
    }
    missing = p1.get_missing_port_fields(s)
    assert 'pieces' in missing
    assert 'containers' not in missing

    # With valid pieces, 'pieces' should not be missing
    s['pieces'] = [{'count': 5}]
    missing = p1.get_missing_port_fields(s)
    assert 'pieces' not in missing


def test_get_missing_port_fields_land_no_containers():
    """Land freight doesn't require containers or pieces."""
    s = {
        'freight_mode': 'land',
        'pol': 'DUBAI',
        'pod': 'RIYADH',
        'pod_hint': [],
        'containers': [],
        'pieces': [],
        'date': '2026-03-15',
    }
    missing = p1.get_missing_port_fields(s)
    assert 'containers' not in missing
    assert 'pieces' not in missing


def test_build_normalized_shipments_freight_mode():
    """_build_normalized_shipments includes freight_mode and guards 40HQ fallback."""
    ocean_shipment = {'pol': 'SHANGHAI', 'pod': 'JEBEL ALI', 'containers': [], 'freight_mode': 'ocean'}
    air_shipment = {'pol': 'PVG', 'pod': 'DXB', 'containers': [], 'freight_mode': 'air'}

    ocean_result = p1._build_normalized_shipments([ocean_shipment])
    assert ocean_result[0]['freight_mode'] == 'ocean'
    assert len(ocean_result[0]['containers']) == 1  # default 40HQ added

    air_result = p1._build_normalized_shipments([air_shipment])
    assert air_result[0]['freight_mode'] == 'air'
    assert len(air_result[0]['containers']) == 0  # no default for air


def test_ocean_prompt_includes_reefer_containers():
    """Ocean prompt includes 20RF and 40RF container types."""
    prompt = p1.AI_SYSTEM_PROMPT.upper()
    assert "20RF" in prompt
    assert "40RF" in prompt
