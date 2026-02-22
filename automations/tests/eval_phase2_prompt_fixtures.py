"""Synthetic prompt-eval harness for Phase 2 quote parsing.

Usage:
  OPENAI_API_KEY=... python3 automations/tests/eval_phase2_prompt_fixtures.py
"""

import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import openai

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import phase_2_quote_analysis as p2


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "phase2_prompt_eval_cases.txt"


@dataclass
class EvalCounts:
    tp_presence: int = 0
    fp_presence: int = 0
    fn_presence: int = 0
    exact_price_total: int = 0
    exact_price_correct: int = 0
    shipment_total: int = 0
    shipment_correct: int = 0
    etd_tt_ft_total: int = 0
    etd_tt_ft_correct: int = 0
    multi_option_cases: int = 0
    multi_option_preserved: int = 0


def quote_signature(q: dict) -> tuple:
    return (
        int(q.get("shipment_number", 1)),
        str(q.get("carrier", "")).upper().strip(),
        float(q.get("price", 0)),
        q.get("etd"),
        q.get("transit_time"),
        q.get("free_time"),
        q.get("validity"),
    )


def load_cases() -> list:
    return json.loads(FIXTURE_PATH.read_text())


def build_prompt(case: dict) -> tuple[str, int, bool, object]:
    rfq = case["rfq"]
    email = case["email"]

    context = p2.build_shipment_context(rfq)
    context_text = p2.format_shipment_context_for_prompt(context)
    trimmed = p2.trim_agent_reply(email["body"])
    received_dt = p2.parse_email_received_date(email["received_at"])
    explicit_mapping = p2.detect_explicit_shipment_mapping(trimmed)

    prompt = (
        f"RFQ_CONTEXT\n"
        f"rfq_id: {case['id']}\n"
        f"email_received_at: {received_dt.strftime('%Y-%m-%d')}\n"
        f"subject: {email['subject']}\n"
        f"shipment_count: {context.get('shipment_count', 1)}\n"
        f"{context_text}\n\n"
        f"AGENT_EMAIL_METADATA\n"
        f"agent_name: Eval Agent\n"
        f"agent_email: eval@example.com\n\n"
        f"AGENT_REPLY_CURRENT_MESSAGE\n"
        f"\"\"\"\n{trimmed}\n\"\"\""
    )
    return prompt, context.get("shipment_count", 1), explicit_mapping, received_dt


def evaluate_case(client: openai.OpenAI, case: dict) -> list[dict]:
    prompt, shipment_count, explicit_mapping, received_dt = build_prompt(case)
    response = client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": p2.AI_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format=p2.ExtractedQuotes,
    )
    parsed = response.choices[0].message.parsed
    cleaned = p2.sanitize_extracted_quotes(
        parsed_quotes=parsed.quotes,
        shipment_count=shipment_count,
        anchor_date=received_dt,
        has_explicit_shipment_mapping=explicit_mapping,
    )
    return [q.model_dump() for q in cleaned]


def main() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is required")

    client = openai.OpenAI(api_key=api_key)
    cases = load_cases()
    counts = EvalCounts()

    for case in cases:
        expected = case["expected"]["quotes"]
        predicted = evaluate_case(client, case)

        expected_has = len(expected) > 0
        predicted_has = len(predicted) > 0
        if expected_has and predicted_has:
            counts.tp_presence += 1
        elif predicted_has and not expected_has:
            counts.fp_presence += 1
        elif expected_has and not predicted_has:
            counts.fn_presence += 1

        expected_map = {quote_signature(q): q for q in expected}
        predicted_map = {quote_signature(q): q for q in predicted}

        if len(expected) >= 2:
            counts.multi_option_cases += 1
            if len(predicted) >= len(expected):
                counts.multi_option_preserved += 1

        for exp_sig, exp in expected_map.items():
            counts.exact_price_total += 1
            matched_pred = None
            for pred_sig, pred in predicted_map.items():
                if pred_sig[0] == exp_sig[0] and pred_sig[1] == exp_sig[1]:
                    matched_pred = pred
                    break

            if matched_pred and float(matched_pred.get("price", 0)) == float(exp.get("price", 0)):
                counts.exact_price_correct += 1

            counts.shipment_total += 1
            if matched_pred and int(matched_pred.get("shipment_number", 0)) == int(exp.get("shipment_number", 0)):
                counts.shipment_correct += 1

            for field in ("etd", "transit_time", "free_time"):
                if exp.get(field) is not None:
                    counts.etd_tt_ft_total += 1
                    if matched_pred and matched_pred.get(field) == exp.get(field):
                        counts.etd_tt_ft_correct += 1

    precision = (
        counts.tp_presence / (counts.tp_presence + counts.fp_presence)
        if (counts.tp_presence + counts.fp_presence) > 0
        else 1.0
    )
    recall = (
        counts.tp_presence / (counts.tp_presence + counts.fn_presence)
        if (counts.tp_presence + counts.fn_presence) > 0
        else 1.0
    )
    price_acc = (
        counts.exact_price_correct / counts.exact_price_total
        if counts.exact_price_total > 0
        else 1.0
    )
    shipment_acc = (
        counts.shipment_correct / counts.shipment_total
        if counts.shipment_total > 0
        else 1.0
    )
    etd_tt_ft_acc = (
        counts.etd_tt_ft_correct / counts.etd_tt_ft_total
        if counts.etd_tt_ft_total > 0
        else 1.0
    )
    option_rate = (
        counts.multi_option_preserved / counts.multi_option_cases
        if counts.multi_option_cases > 0
        else 1.0
    )

    print("Phase 2 Prompt Eval Metrics")
    print(f"- Quote presence precision: {precision:.3f}")
    print(f"- Quote presence recall: {recall:.3f}")
    print(f"- Price exact-match accuracy: {price_acc:.3f}")
    print(f"- Shipment mapping accuracy: {shipment_acc:.3f}")
    print(f"- ETD/TT/Free extraction accuracy: {etd_tt_ft_acc:.3f}")
    print(f"- Multi-option preservation rate: {option_rate:.3f}")

    print("\nAcceptance Gates")
    print(f"- 0 false positives on no-rate cases: {'PASS' if counts.fp_presence == 0 else 'FAIL'}")
    print(f"- >=95% price accuracy: {'PASS' if price_acc >= 0.95 else 'FAIL'}")
    print(f"- >=95% option preservation: {'PASS' if option_rate >= 0.95 else 'FAIL'}")


if __name__ == "__main__":
    main()
