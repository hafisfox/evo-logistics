"""Synthetic prompt-eval harness for Phase 1 RFQ parsing.

Usage:
  OPENAI_API_KEY=... python3 automations/tests/eval_phase1_prompt_fixtures.py
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


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "phase1_prompt_eval_cases.txt"


@dataclass
class EvalCounts:
    case_total: int = 0
    schema_valid_count: int = 0
    schema_invalid_count: int = 0
    shipment_count_total: int = 0
    shipment_count_correct: int = 0
    route_total: int = 0
    route_correct: int = 0
    container_total: int = 0
    container_correct: int = 0
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


def _norm_hint(hints: Any) -> List[str]:
    if not isinstance(hints, list):
        return []
    return sorted([str(h).strip().upper() for h in hints if str(h).strip()])


def _norm_containers(containers: Any) -> List[tuple]:
    if not isinstance(containers, list):
        return []
    normalized = []
    for item in containers:
        if not isinstance(item, dict):
            continue
        qty = item.get("qty")
        ctype = item.get("type")
        normalized.append((qty, _norm_text(ctype)))
    return sorted(normalized, key=lambda x: (x[1] or "", x[0] if x[0] is not None else -1))


def _ratio(num: int, den: int) -> float:
    return num / den if den > 0 else 1.0


def load_cases() -> list:
    return json.loads(FIXTURE_PATH.read_text())


def build_prompt(case: Dict[str, Any]) -> str:
    email = case["email"]
    return p1.build_phase1_extraction_prompt(
        subject=email["subject"],
        sender=email.get("from", "customer@example.com"),
        email_body=email["body"],
        received_at=email["received_at"],
    )


def evaluate_case(client: openai.OpenAI, case: Dict[str, Any]) -> Dict[str, Any]:
    prompt = build_prompt(case)
    try:
        response = client.beta.chat.completions.parse(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": p1.AI_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            response_format=p1.ExtractedRFQs,
        )
        parsed = response.choices[0].message.parsed
        shipments = [p1.validate_shipment(s.model_dump(), i) for i, s in enumerate(parsed.shipments)]
        schema_valid = bool(parsed.shipments) and parsed.count == len(parsed.shipments)
        action = p1.determine_routing_action(shipments) if shipments else "need_port_data"
        return {
            "schema_valid": schema_valid,
            "shipments": shipments,
            "action": action,
            "parse_error": None,
        }
    except Exception as exc:
        return {
            "schema_valid": False,
            "shipments": [],
            "action": "need_port_data",
            "parse_error": str(exc),
        }


def update_metrics(counts: EvalCounts, case: Dict[str, Any], result: Dict[str, Any]) -> None:
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
            counts.mismatches.append(
                f"{case_id} shipment#{idx + 1}: missing predicted shipment; expected={expected}"
            )
            continue
        predicted = predicted_shipments[idx]

        for field in ("pol", "pod"):
            counts.route_total += 1
            predicted_value = _norm_text(predicted.get(field))
            expected_value = _norm_text(expected.get(field))
            if predicted_value == expected_value:
                counts.route_correct += 1
            else:
                counts.mismatches.append(
                    f"{case_id} shipment#{idx + 1} {field}: expected={expected_value} predicted={predicted_value}"
                )

        counts.route_total += 1
        predicted_hint = _norm_hint(predicted.get("pod_hint"))
        expected_hint = _norm_hint(expected.get("pod_hint", []))
        if predicted_hint == expected_hint:
            counts.route_correct += 1
        else:
            counts.mismatches.append(
                f"{case_id} shipment#{idx + 1} pod_hint: expected={expected_hint} predicted={predicted_hint}"
            )

        counts.container_total += 1
        predicted_containers = _norm_containers(predicted.get("containers"))
        expected_containers = _norm_containers(expected.get("containers"))
        if predicted_containers == expected_containers:
            counts.container_correct += 1
        else:
            counts.mismatches.append(
                f"{case_id} shipment#{idx + 1} containers: expected={expected_containers} predicted={predicted_containers}"
            )

        counts.service_type_total += 1
        predicted_service = _norm_text(predicted.get("service_type"))
        expected_service = _norm_text(expected.get("service_type"))
        if predicted_service == expected_service:
            counts.service_type_correct += 1
        else:
            counts.mismatches.append(
                f"{case_id} shipment#{idx + 1} service_type: expected={expected_service} predicted={predicted_service}"
            )

        expected_date = expected.get("date")
        if expected_date is not None:
            counts.date_total += 1
            predicted_date = str(predicted.get("date"))
            expected_date_str = str(expected_date)
            if predicted_date == expected_date_str:
                counts.date_correct += 1
            else:
                counts.mismatches.append(
                    f"{case_id} shipment#{idx + 1} date: expected={expected_date_str} predicted={predicted_date}"
                )

    expected_action = case["expected"]["action"]
    counts.action_total += 1
    if result["action"] == expected_action:
        counts.action_correct += 1
    else:
        counts.mismatches.append(
            f"{case_id}: action expected={expected_action} predicted={result['action']}"
        )

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
        result = evaluate_case(client, case)
        update_metrics(counts, case, result)

    schema_valid_rate = _ratio(counts.schema_valid_count, counts.case_total)
    shipment_count_accuracy = _ratio(counts.shipment_count_correct, counts.shipment_count_total)
    route_accuracy = _ratio(counts.route_correct, counts.route_total)
    container_accuracy = _ratio(counts.container_correct, counts.container_total)
    service_type_accuracy = _ratio(counts.service_type_correct, counts.service_type_total)
    date_accuracy = _ratio(counts.date_correct, counts.date_total)
    action_accuracy = _ratio(counts.action_correct, counts.action_total)

    print("Phase 1 Prompt Eval Metrics")
    print(f"- Cases evaluated: {counts.case_total}")
    print(f"- Schema-valid rate: {schema_valid_rate:.3f}")
    print(f"- Shipment count accuracy: {shipment_count_accuracy:.3f}")
    print(f"- Route accuracy (pol/pod/pod_hint): {route_accuracy:.3f}")
    print(f"- Container accuracy: {container_accuracy:.3f}")
    print(f"- Service-type accuracy: {service_type_accuracy:.3f}")
    print(f"- Date accuracy (dated subset): {date_accuracy:.3f}")
    print(f"- Routing-action accuracy: {action_accuracy:.3f}")
    print(
        "- complete_expected_but_missing_predicted: "
        f"{counts.complete_expected_but_missing_predicted}"
    )

    if counts.parse_errors:
        print("\nParse Errors")
        for err in counts.parse_errors:
            print(f"- {err}")

    if counts.mismatches:
        print("\nMismatch Details")
        for mismatch in counts.mismatches:
            print(f"- {mismatch}")

    print("\nAcceptance Gates")
    print(f"- schema_invalid_count == 0: {'PASS' if counts.schema_invalid_count == 0 else 'FAIL'}")
    print(f"- route_accuracy >= 0.95: {'PASS' if route_accuracy >= 0.95 else 'FAIL'}")
    print(f"- container_accuracy >= 0.95: {'PASS' if container_accuracy >= 0.95 else 'FAIL'}")
    print(f"- service_type_accuracy >= 0.95: {'PASS' if service_type_accuracy >= 0.95 else 'FAIL'}")
    print(f"- date_accuracy >= 0.95: {'PASS' if date_accuracy >= 0.95 else 'FAIL'}")
    print(f"- action_accuracy >= 0.95: {'PASS' if action_accuracy >= 0.95 else 'FAIL'}")
    print(
        "- complete_expected_but_missing_predicted == 0: "
        f"{'PASS' if counts.complete_expected_but_missing_predicted == 0 else 'FAIL'}"
    )


if __name__ == "__main__":
    main()
