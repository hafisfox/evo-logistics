"""Synthetic prompt-eval harness for Phase 1 AIR RFQ parsing + mode classification.

Mirrors eval_phase1_prompt_fixtures.py (ocean) but measures two things:
  1) Mode-detection accuracy over all fixtures (air + ocean/land decoys), using the
     production MODE_DETECTION_SYSTEM_PROMPT (FUTURE_PLAN Phase 1 criterion: >= 0.90).
  2) Air extraction accuracy over the air-only subset, using the air system prompt.

Usage:
  OPENAI_API_KEY=... python3 automations/tests/eval_phase1_air_fixtures.py
"""

import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List

import openai

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import phase_1_request_analysis as p1


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "phase1_air_prompt_eval_cases.txt"

# Tolerance for piece dimension/weight comparison — LLM unit-conversion arithmetic
# (in->cm, lbs->kg) can round slightly differently than the fixture's exact value.
DIM_REL_TOL = 0.02


@dataclass
class EvalCounts:
    # classification (all cases)
    mode_total: int = 0
    mode_correct: int = 0
    mode_confusion: Dict[str, int] = field(default_factory=dict)
    # extraction (air subset)
    case_total: int = 0
    schema_valid_count: int = 0
    schema_invalid_count: int = 0
    shipment_count_total: int = 0
    shipment_count_correct: int = 0
    route_total: int = 0
    route_correct: int = 0
    piece_total: int = 0
    piece_correct: int = 0
    service_type_total: int = 0
    service_type_correct: int = 0
    date_total: int = 0
    date_correct: int = 0
    action_total: int = 0
    action_correct: int = 0
    complete_expected_but_missing_predicted: int = 0
    parse_errors: List[str] = field(default_factory=list)
    mismatches: List[str] = field(default_factory=list)


def _norm_text(value: Any) -> Any:
    if value is None:
        return None
    text = str(value).strip()
    return text.upper() if text else None


def _ratio(num: int, den: int) -> float:
    return num / den if den > 0 else 1.0


def _approx(a: Any, b: Any) -> bool:
    """Compare two optional numbers with relative tolerance; exact for None/int counts."""
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    try:
        af, bf = float(a), float(b)
    except (TypeError, ValueError):
        return _norm_text(a) == _norm_text(b)
    if af == bf:
        return True
    scale = max(abs(af), abs(bf), 1.0)
    return abs(af - bf) / scale <= DIM_REL_TOL


def _piece_matches(expected: Dict[str, Any], predicted: Dict[str, Any]) -> bool:
    if (expected.get("count") or None) != (predicted.get("count") or None):
        return False
    for dim in ("length_cm", "width_cm", "height_cm", "weight_kg"):
        if not _approx(expected.get(dim), predicted.get(dim)):
            return False
    # packaging is advisory — compare loosely (case-insensitive, allow singular/plural noise)
    exp_pkg = _norm_text(expected.get("packaging_type"))
    pred_pkg = _norm_text(predicted.get("packaging_type"))
    if exp_pkg and pred_pkg and not (exp_pkg in pred_pkg or pred_pkg in exp_pkg):
        return False
    return True


def load_cases() -> list:
    return json.loads(FIXTURE_PATH.read_text())


def detect_mode(client: openai.OpenAI, case: Dict[str, Any]) -> str:
    """Run the production mode-detection prompt against OpenAI for the eval."""
    email = case["email"]
    input_text = f"Subject: {email['subject']}\nBody: {email['body'][:800]}"
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": p1.MODE_DETECTION_SYSTEM_PROMPT},
                {"role": "user", "content": input_text},
            ],
            temperature=0,
            max_tokens=10,
        )
        raw = response.choices[0].message.content or "ocean"
        mode = raw.strip().lower()
        return mode if mode in ("ocean", "air", "land") else "ocean"
    except Exception as exc:  # noqa: BLE001 - eval should not crash on a single case
        return f"error:{exc}"


def evaluate_air_case(client: openai.OpenAI, case: Dict[str, Any]) -> Dict[str, Any]:
    email = case["email"]
    prompt = p1.build_phase1_extraction_prompt(
        subject=email["subject"],
        sender=email.get("from", "customer@example.com"),
        email_body=email["body"],
        received_at=email["received_at"],
    )
    try:
        response = client.beta.chat.completions.parse(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": p1._get_system_prompt_for_mode("air")},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            response_format=p1.ExtractedRFQs,
        )
        parsed = response.choices[0].message.parsed
        shipments = []
        for i, s in enumerate(parsed.shipments):
            sd = s.model_dump()
            sd["freight_mode"] = "air"  # mirror production: detected mode is injected
            shipments.append(p1.validate_shipment(sd, i))
        schema_valid = bool(parsed.shipments) and parsed.count == len(parsed.shipments)
        action = p1.determine_routing_action(shipments) if shipments else "need_port_data"
        return {"schema_valid": schema_valid, "shipments": shipments, "action": action, "parse_error": None}
    except Exception as exc:  # noqa: BLE001
        return {"schema_valid": False, "shipments": [], "action": "need_port_data", "parse_error": str(exc)}


def update_mode_metrics(counts: EvalCounts, case: Dict[str, Any], predicted_mode: str) -> None:
    expected_mode = case["expected"]["freight_mode"]
    counts.mode_total += 1
    if predicted_mode == expected_mode:
        counts.mode_correct += 1
    else:
        key = f"{expected_mode}->{predicted_mode}"
        counts.mode_confusion[key] = counts.mode_confusion.get(key, 0) + 1
        counts.mismatches.append(f"{case.get('id')}: mode expected={expected_mode} predicted={predicted_mode}")


def update_extraction_metrics(counts: EvalCounts, case: Dict[str, Any], result: Dict[str, Any]) -> None:
    counts.case_total += 1
    case_id = case.get("id", "unknown_case")

    if result["schema_valid"]:
        counts.schema_valid_count += 1
    else:
        counts.schema_invalid_count += 1
    if result["parse_error"]:
        counts.parse_errors.append(f"{case_id}: {result['parse_error']}")

    expected_shipments = case["expected"]["shipments"]
    predicted_shipments = result["shipments"]

    counts.shipment_count_total += 1
    if len(expected_shipments) == len(predicted_shipments):
        counts.shipment_count_correct += 1
    else:
        counts.mismatches.append(
            f"{case_id}: shipment_count expected={len(expected_shipments)} predicted={len(predicted_shipments)}"
        )

    for idx, expected in enumerate(expected_shipments):
        if idx >= len(predicted_shipments):
            counts.mismatches.append(f"{case_id} shipment#{idx + 1}: missing predicted shipment")
            continue
        predicted = predicted_shipments[idx]

        for field_name in ("pol", "pod"):
            counts.route_total += 1
            if _norm_text(predicted.get(field_name)) == _norm_text(expected.get(field_name)):
                counts.route_correct += 1
            else:
                counts.mismatches.append(
                    f"{case_id} shipment#{idx + 1} {field_name}: "
                    f"expected={_norm_text(expected.get(field_name))} predicted={_norm_text(predicted.get(field_name))}"
                )

        # Piece-level accuracy: count match + each piece field within tolerance.
        counts.piece_total += 1
        exp_pieces = expected.get("pieces", [])
        pred_pieces = predicted.get("pieces", [])
        pieces_ok = len(exp_pieces) == len(pred_pieces) and all(
            _piece_matches(e, p) for e, p in zip(exp_pieces, pred_pieces)
        )
        if pieces_ok:
            counts.piece_correct += 1
        else:
            counts.mismatches.append(
                f"{case_id} shipment#{idx + 1} pieces: expected={exp_pieces} predicted={pred_pieces}"
            )

        counts.service_type_total += 1
        if _norm_text(predicted.get("service_type")) == _norm_text(expected.get("service_type")):
            counts.service_type_correct += 1
        else:
            counts.mismatches.append(
                f"{case_id} shipment#{idx + 1} service_type: "
                f"expected={_norm_text(expected.get('service_type'))} predicted={_norm_text(predicted.get('service_type'))}"
            )

        expected_date = expected.get("date")
        counts.date_total += 1
        if str(predicted.get("date")) == str(expected_date):
            counts.date_correct += 1
        else:
            counts.mismatches.append(
                f"{case_id} shipment#{idx + 1} date: expected={expected_date} predicted={predicted.get('date')}"
            )

    expected_action = case["expected"]["action"]
    counts.action_total += 1
    if result["action"] == expected_action:
        counts.action_correct += 1
    else:
        counts.mismatches.append(f"{case_id}: action expected={expected_action} predicted={result['action']}")

    if expected_action == "complete" and result["action"] != "complete":
        counts.complete_expected_but_missing_predicted += 1


def main() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is required")

    client = openai.OpenAI(api_key=api_key)
    cases = load_cases()
    counts = EvalCounts()

    for case in cases:
        predicted_mode = detect_mode(client, case)
        update_mode_metrics(counts, case, predicted_mode)
        if case["expected"]["freight_mode"] == "air":
            result = evaluate_air_case(client, case)
            update_extraction_metrics(counts, case, result)

    mode_accuracy = _ratio(counts.mode_correct, counts.mode_total)
    schema_valid_rate = _ratio(counts.schema_valid_count, counts.case_total)
    shipment_count_accuracy = _ratio(counts.shipment_count_correct, counts.shipment_count_total)
    route_accuracy = _ratio(counts.route_correct, counts.route_total)
    piece_accuracy = _ratio(counts.piece_correct, counts.piece_total)
    service_type_accuracy = _ratio(counts.service_type_correct, counts.service_type_total)
    date_accuracy = _ratio(counts.date_correct, counts.date_total)
    action_accuracy = _ratio(counts.action_correct, counts.action_total)

    print("Phase 1 AIR Prompt Eval Metrics")
    print(f"- Cases (all, for classification): {counts.mode_total}")
    print(f"- Air cases (for extraction): {counts.case_total}")
    print(f"- Mode-detection accuracy: {mode_accuracy:.3f}")
    print(f"- Schema-valid rate (air): {schema_valid_rate:.3f}")
    print(f"- Shipment count accuracy: {shipment_count_accuracy:.3f}")
    print(f"- Route accuracy (pol/pod): {route_accuracy:.3f}")
    print(f"- Piece accuracy (count/dims/weight): {piece_accuracy:.3f}")
    print(f"- Service-type accuracy: {service_type_accuracy:.3f}")
    print(f"- Date accuracy: {date_accuracy:.3f}")
    print(f"- Routing-action accuracy: {action_accuracy:.3f}")
    print(f"- complete_expected_but_missing_predicted: {counts.complete_expected_but_missing_predicted}")

    if counts.mode_confusion:
        print("\nMode Confusion (expected->predicted)")
        for key, n in sorted(counts.mode_confusion.items()):
            print(f"- {key}: {n}")

    if counts.parse_errors:
        print("\nParse Errors")
        for err in counts.parse_errors:
            print(f"- {err}")

    if counts.mismatches:
        print("\nMismatch Details")
        for mismatch in counts.mismatches:
            print(f"- {mismatch}")

    print("\nAcceptance Gates")
    print(f"- mode_detection_accuracy >= 0.90: {'PASS' if mode_accuracy >= 0.90 else 'FAIL'}")
    print(f"- schema_invalid_count == 0: {'PASS' if counts.schema_invalid_count == 0 else 'FAIL'}")
    print(f"- route_accuracy >= 0.95: {'PASS' if route_accuracy >= 0.95 else 'FAIL'}")
    print(f"- piece_accuracy >= 0.90: {'PASS' if piece_accuracy >= 0.90 else 'FAIL'}")
    print(f"- service_type_accuracy >= 0.95: {'PASS' if service_type_accuracy >= 0.95 else 'FAIL'}")
    print(f"- date_accuracy >= 0.95: {'PASS' if date_accuracy >= 0.95 else 'FAIL'}")
    print(f"- action_accuracy >= 0.95: {'PASS' if action_accuracy >= 0.95 else 'FAIL'}")
    print(
        "- complete_expected_but_missing_predicted == 0: "
        f"{'PASS' if counts.complete_expected_but_missing_predicted == 0 else 'FAIL'}"
    )


if __name__ == "__main__":
    main()
