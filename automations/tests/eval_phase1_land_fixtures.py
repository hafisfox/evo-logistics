"""Synthetic prompt-eval harness for Phase 1 LAND RFQ parsing + mode classification.

Mirrors eval_phase1_air_fixtures.py but measures two things:
  1) Mode-detection accuracy over all fixtures (land + ocean/air decoys), using the
     production MODE_DETECTION_SYSTEM_PROMPT (FUTURE_PLAN Phase 1 criterion: >= 0.90).
  2) Land extraction accuracy over the land-only subset, using the land system prompt
     (pol/pod, ZIP lane, load_type, equipment_type, weight_lbs, NMFC class).

Usage:
  OPENAI_API_KEY=... python3 automations/tests/eval_phase1_land_fixtures.py
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


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "phase1_land_prompt_eval_cases.txt"

# Weight comparison tolerance (kg<->lbs conversion can round slightly differently).
WEIGHT_REL_TOL = 0.03


@dataclass
class EvalCounts:
    # classification (all cases)
    mode_total: int = 0
    mode_correct: int = 0
    mode_confusion: Dict[str, int] = field(default_factory=dict)
    # extraction (land subset)
    case_total: int = 0
    schema_valid_count: int = 0
    schema_invalid_count: int = 0
    shipment_count_total: int = 0
    shipment_count_correct: int = 0
    route_total: int = 0
    route_correct: int = 0
    zip_total: int = 0
    zip_correct: int = 0
    load_type_total: int = 0
    load_type_correct: int = 0
    equipment_total: int = 0
    equipment_correct: int = 0
    weight_total: int = 0
    weight_correct: int = 0
    nmfc_total: int = 0
    nmfc_correct: int = 0
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


def _weight_matches(expected: Any, predicted: Any) -> bool:
    if expected is None and predicted is None:
        return True
    if expected is None or predicted is None:
        return False
    try:
        ef, pf = float(expected), float(predicted)
    except (TypeError, ValueError):
        return False
    scale = max(abs(ef), abs(pf), 1.0)
    return abs(ef - pf) / scale <= WEIGHT_REL_TOL


def _equipment_matches(expected: Any, predicted: Any) -> bool:
    e, p = _norm_text(expected), _norm_text(predicted)
    if e is None and p is None:
        return True
    if e is None or p is None:
        return False
    e = e.replace("-", " ").replace("_", " ")
    p = p.replace("-", " ").replace("_", " ")
    return e in p or p in e


def load_cases() -> list:
    return json.loads(FIXTURE_PATH.read_text())


def detect_mode(client: openai.OpenAI, case: Dict[str, Any]) -> str:
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
    except Exception as exc:  # noqa: BLE001
        return f"error:{exc}"


def evaluate_land_case(client: openai.OpenAI, case: Dict[str, Any]) -> Dict[str, Any]:
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
                {"role": "system", "content": p1._get_system_prompt_for_mode("land")},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            response_format=p1.ExtractedRFQs,
        )
        parsed = response.choices[0].message.parsed
        shipments = []
        for i, s in enumerate(parsed.shipments):
            sd = s.model_dump()
            sd["freight_mode"] = "land"  # mirror production: detected mode is injected
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

        for zip_field in ("origin_zip", "destination_zip"):
            counts.zip_total += 1
            if _norm_text(predicted.get(zip_field)) == _norm_text(expected.get(zip_field)):
                counts.zip_correct += 1
            else:
                counts.mismatches.append(
                    f"{case_id} shipment#{idx + 1} {zip_field}: "
                    f"expected={_norm_text(expected.get(zip_field))} predicted={_norm_text(predicted.get(zip_field))}"
                )

        counts.load_type_total += 1
        if _norm_text(predicted.get("load_type")) == _norm_text(expected.get("load_type")):
            counts.load_type_correct += 1
        else:
            counts.mismatches.append(
                f"{case_id} shipment#{idx + 1} load_type: "
                f"expected={_norm_text(expected.get('load_type'))} predicted={_norm_text(predicted.get('load_type'))}"
            )

        counts.equipment_total += 1
        if _equipment_matches(expected.get("equipment_type"), predicted.get("equipment_type")):
            counts.equipment_correct += 1
        else:
            counts.mismatches.append(
                f"{case_id} shipment#{idx + 1} equipment_type: "
                f"expected={expected.get('equipment_type')} predicted={predicted.get('equipment_type')}"
            )

        counts.weight_total += 1
        if _weight_matches(expected.get("weight_lbs"), predicted.get("weight_lbs")):
            counts.weight_correct += 1
        else:
            counts.mismatches.append(
                f"{case_id} shipment#{idx + 1} weight_lbs: "
                f"expected={expected.get('weight_lbs')} predicted={predicted.get('weight_lbs')}"
            )

        if expected.get("nmfc_class"):
            counts.nmfc_total += 1
            if _norm_text(predicted.get("nmfc_class")) == _norm_text(expected.get("nmfc_class")):
                counts.nmfc_correct += 1
            else:
                counts.mismatches.append(
                    f"{case_id} shipment#{idx + 1} nmfc_class: "
                    f"expected={expected.get('nmfc_class')} predicted={predicted.get('nmfc_class')}"
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
        if case["expected"]["freight_mode"] == "land":
            result = evaluate_land_case(client, case)
            update_extraction_metrics(counts, case, result)

    mode_accuracy = _ratio(counts.mode_correct, counts.mode_total)
    schema_valid_rate = _ratio(counts.schema_valid_count, counts.case_total)
    shipment_count_accuracy = _ratio(counts.shipment_count_correct, counts.shipment_count_total)
    route_accuracy = _ratio(counts.route_correct, counts.route_total)
    zip_accuracy = _ratio(counts.zip_correct, counts.zip_total)
    load_type_accuracy = _ratio(counts.load_type_correct, counts.load_type_total)
    equipment_accuracy = _ratio(counts.equipment_correct, counts.equipment_total)
    weight_accuracy = _ratio(counts.weight_correct, counts.weight_total)
    nmfc_accuracy = _ratio(counts.nmfc_correct, counts.nmfc_total)
    date_accuracy = _ratio(counts.date_correct, counts.date_total)
    action_accuracy = _ratio(counts.action_correct, counts.action_total)

    print("Phase 1 LAND Prompt Eval Metrics")
    print(f"- Cases (all, for classification): {counts.mode_total}")
    print(f"- Land cases (for extraction): {counts.case_total}")
    print(f"- Mode-detection accuracy: {mode_accuracy:.3f}")
    print(f"- Schema-valid rate (land): {schema_valid_rate:.3f}")
    print(f"- Shipment count accuracy: {shipment_count_accuracy:.3f}")
    print(f"- Route accuracy (pol/pod): {route_accuracy:.3f}")
    print(f"- ZIP accuracy (origin/destination): {zip_accuracy:.3f}")
    print(f"- Load-type accuracy (FTL/LTL/PTL): {load_type_accuracy:.3f}")
    print(f"- Equipment-type accuracy: {equipment_accuracy:.3f}")
    print(f"- Weight accuracy (lbs): {weight_accuracy:.3f}")
    print(f"- NMFC class accuracy (LTL): {nmfc_accuracy:.3f}")
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
    print(f"- zip_accuracy >= 0.90: {'PASS' if zip_accuracy >= 0.90 else 'FAIL'}")
    print(f"- load_type_accuracy >= 0.90: {'PASS' if load_type_accuracy >= 0.90 else 'FAIL'}")
    print(f"- equipment_accuracy >= 0.90: {'PASS' if equipment_accuracy >= 0.90 else 'FAIL'}")
    print(f"- date_accuracy >= 0.95: {'PASS' if date_accuracy >= 0.95 else 'FAIL'}")
    print(f"- action_accuracy >= 0.95: {'PASS' if action_accuracy >= 0.95 else 'FAIL'}")
    print(
        "- complete_expected_but_missing_predicted == 0: "
        f"{'PASS' if counts.complete_expected_but_missing_predicted == 0 else 'FAIL'}"
    )


if __name__ == "__main__":
    main()
