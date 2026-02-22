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
