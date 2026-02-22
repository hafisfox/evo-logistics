import base64
import os
import sys
from types import SimpleNamespace

import pytest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import phase_1_request_analysis as p1
import phase_2_quote_analysis as p2


class _FakeRequest:
    def __init__(self, payload):
        self._payload = payload

    def execute(self):
        return self._payload


class _FakeUsers:
    def __init__(self, message):
        self._message = message

    def messages(self):
        return self

    def list(self, **_kwargs):
        return _FakeRequest({"messages": [{"id": self._message["id"]}]})

    def get(self, **_kwargs):
        return _FakeRequest(self._message)

    def modify(self, **_kwargs):
        return _FakeRequest({})


class _FakeGmailService:
    def __init__(self, message):
        self._users = _FakeUsers(message)

    def users(self):
        return self._users


class _DummyOpenAI:
    def __init__(self, *_args, **_kwargs):
        self.chat = SimpleNamespace(
            completions=SimpleNamespace(
                create=lambda *_a, **_k: SimpleNamespace(
                    choices=[SimpleNamespace(message=SimpleNamespace(content="customer_rfq"))]
                )
            )
        )
        self.beta = SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(
                    parse=lambda *_a, **_k: pytest.fail("OpenAI parse should not run")
                )
            )
        )


class _OpenAIWithEmptyQuotes:
    def __init__(self, *_args, **_kwargs):
        self.beta = SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(
                    parse=lambda *_a, **_k: SimpleNamespace(
                        choices=[SimpleNamespace(message=SimpleNamespace(parsed=SimpleNamespace(quotes=[])))]
                    )
                )
            )
        )


def _build_email_message(msg_id: str, thread_id: str, subject: str, sender: str, body: str):
    body_b64 = base64.urlsafe_b64encode(body.encode("utf-8")).decode("utf-8")
    return {
        "id": msg_id,
        "threadId": thread_id,
        "payload": {
            "mimeType": "text/plain",
            "headers": [
                {"name": "Subject", "value": subject},
                {"name": "From", "value": sender},
                {"name": "Message-ID", "value": f"<{msg_id}@example.com>"},
            ],
            "body": {"data": body_b64},
        },
        "snippet": body,
    }


def test_phase1_skips_already_claimed_message(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    message = _build_email_message(
        msg_id="msg-1",
        thread_id="thread-1",
        subject="shipping",
        sender="Hafis Javad <hafisjavad@gmail.com>",
        body="POL: SHENZHEN\nPOD: JEBEL ALI\nCargo: 2x40FT",
    )
    upsert_calls = []
    outreach_calls = []

    monkeypatch.setattr(p1, "get_google_services", lambda: _FakeGmailService(message))
    monkeypatch.setattr(p1, "get_supabase_client", lambda: object())
    monkeypatch.setattr(p1, "extract_pubsub_mailbox", lambda _p: "yunapink05@gmail.com")
    monkeypatch.setattr(p1, "resolve_workspace_id", lambda _s, _m: "ws-1")
    monkeypatch.setattr(p1, "claim_email_event", lambda *a, **k: False, raising=False)
    monkeypatch.setattr(p1.openai, "OpenAI", _DummyOpenAI)
    monkeypatch.setattr(p1, "_upsert_row", lambda *a, **k: upsert_calls.append((a, k)))
    monkeypatch.setattr(
        p1,
        "_send_agent_outreach",
        lambda *a, **k: outreach_calls.append((a, k)),
    )
    monkeypatch.setattr(
        p1,
        "classify_email",
        lambda *a, **k: pytest.fail("classify_email should not run for already-claimed messages"),
    )

    p1._process_incoming_rfqs({"message": {"attributes": {"emailAddress": "yunapink05@gmail.com"}}})

    assert upsert_calls == []
    assert outreach_calls == []


def test_phase2_skips_already_claimed_message(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    message = _build_email_message(
        msg_id="msg-2",
        thread_id="thread-2",
        subject="Re: RFQ quote [Ref:RFQ-OLD]",
        sender="Agent X <agent@example.com>",
        body="Carrier: MSC, Price: 1000",
    )
    upsert_calls = []

    monkeypatch.setattr(p2, "get_google_services", lambda: _FakeGmailService(message))
    monkeypatch.setattr(p2, "get_supabase_client", lambda: object())
    monkeypatch.setattr(p2, "extract_pubsub_mailbox", lambda _p: "yunapink05@gmail.com")
    monkeypatch.setattr(p2, "resolve_workspace_id", lambda _s, _m: "ws-1")
    monkeypatch.setattr(p2, "claim_email_event", lambda *a, **k: False, raising=False)
    monkeypatch.setattr(p2.openai, "OpenAI", _DummyOpenAI)
    monkeypatch.setattr(p2, "_upsert_row", lambda *a, **k: upsert_calls.append((a, k)))

    p2._process_agent_quotes({"message": {"attributes": {"emailAddress": "yunapink05@gmail.com"}}})

    assert upsert_calls == []


def test_phase2_uses_canonical_alias_for_rfq_id(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    message = _build_email_message(
        msg_id="msg-3",
        thread_id="thread-3",
        subject="Re: RFQ quote [Ref:RFQ-OLD]",
        sender="Agent X <agent@example.com>",
        body="No slots available",
    )
    upsert_rows = []
    alias_lookups = []

    monkeypatch.setattr(p2, "get_google_services", lambda: _FakeGmailService(message))
    monkeypatch.setattr(p2, "get_supabase_client", lambda: object())
    monkeypatch.setattr(p2, "extract_pubsub_mailbox", lambda _p: "yunapink05@gmail.com")
    monkeypatch.setattr(p2, "resolve_workspace_id", lambda _s, _m: "ws-1")
    monkeypatch.setattr(p2, "claim_email_event", lambda *a, **k: True, raising=False)
    monkeypatch.setattr(p2.openai, "OpenAI", _OpenAIWithEmptyQuotes)
    monkeypatch.setattr(
        p2,
        "resolve_canonical_rfq_id",
        lambda _supabase, workspace_id, rfq_id: (
            alias_lookups.append((workspace_id, rfq_id)) or "RFQ-CANON"
        ),
        raising=False,
    )
    monkeypatch.setattr(
        p2,
        "_upsert_row",
        lambda _s, _t, row, _w: upsert_rows.append(row),
    )

    p2._process_agent_quotes({"message": {"attributes": {"emailAddress": "yunapink05@gmail.com"}}})

    assert alias_lookups == [("ws-1", "RFQ-OLD")]
    assert upsert_rows
    assert all(row.get("rfq_id") == "RFQ-CANON" for row in upsert_rows)
