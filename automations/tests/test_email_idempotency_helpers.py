import os
import sys
from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import tenant_context as tc


class _RecorderQuery:
    def __init__(self, table_name: str, behavior=None, data=None):
        self.table_name = table_name
        self.behavior = behavior
        self.data = data or []
        self.insert_values = None
        self.eq_calls = []
        self.limit_value = None
        self.select_columns = None

    def insert(self, values):
        self.insert_values = values
        return self

    def select(self, columns):
        self.select_columns = columns
        return self

    def eq(self, column, value):
        self.eq_calls.append((column, value))
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def execute(self):
        if self.behavior:
            return self.behavior(self)
        return SimpleNamespace(data=self.data)


class _RecorderSupabase:
    def __init__(self, behavior_map=None):
        self.behavior_map = behavior_map or {}
        self.queries = []

    def table(self, table_name):
        query = _RecorderQuery(table_name, behavior=self.behavior_map.get(table_name))
        self.queries.append(query)
        return query


def _api_error(code: str):
    return APIError({"code": code, "message": "error", "details": None, "hint": None})


def test_claim_email_event_returns_true_and_inserts_payload():
    supabase = _RecorderSupabase()
    claimed = tc.claim_email_event(
        supabase,
        workspace_id="ws-1",
        source="phase_1_request_analysis",
        gmail_message_id="msg-123",
        thread_id="thread-123",
        subject="shipping",
        sender="hafisjavad@gmail.com",
    )

    assert claimed is True
    query = supabase.queries[-1]
    assert query.table_name == "processed_email_events"
    assert query.insert_values["workspace_id"] == "ws-1"
    assert query.insert_values["source"] == "phase_1_request_analysis"
    assert query.insert_values["gmail_message_id"] == "msg-123"
    assert query.insert_values["thread_id"] == "thread-123"


def test_claim_email_event_returns_false_on_duplicate_violation():
    def _raise_duplicate(_query):
        raise _api_error("23505")

    supabase = _RecorderSupabase({"processed_email_events": _raise_duplicate})
    claimed = tc.claim_email_event(
        supabase,
        workspace_id="ws-1",
        source="phase_1_request_analysis",
        gmail_message_id="msg-123",
        thread_id="thread-123",
    )

    assert claimed is False


def test_claim_email_event_fail_open_when_table_missing(capfd):
    def _raise_missing_table(_query):
        raise _api_error("42P01")

    supabase = _RecorderSupabase({"processed_email_events": _raise_missing_table})
    claimed = tc.claim_email_event(
        supabase,
        workspace_id="ws-1",
        source="phase_1_request_analysis",
        gmail_message_id="msg-123",
        thread_id="thread-123",
    )

    out = capfd.readouterr().out
    assert claimed is True
    assert "processed_email_events" in out


def test_resolve_canonical_rfq_id_returns_alias_mapping():
    def _alias_lookup(_query):
        return SimpleNamespace(data=[{"canonical_rfq_id": "RFQ-NEW"}])

    supabase = _RecorderSupabase({"rfq_id_aliases": _alias_lookup})
    resolved = tc.resolve_canonical_rfq_id(supabase, "ws-1", "RFQ-OLD")

    assert resolved == "RFQ-NEW"


def test_resolve_canonical_rfq_id_returns_original_when_not_found():
    supabase = _RecorderSupabase()
    resolved = tc.resolve_canonical_rfq_id(supabase, "ws-1", "RFQ-OLD")
    assert resolved == "RFQ-OLD"


def test_resolve_canonical_rfq_id_fail_open_when_alias_table_missing(capfd):
    def _raise_missing_table(_query):
        raise _api_error("42P01")

    supabase = _RecorderSupabase({"rfq_id_aliases": _raise_missing_table})
    resolved = tc.resolve_canonical_rfq_id(supabase, "ws-1", "RFQ-OLD")
    out = capfd.readouterr().out
    assert resolved == "RFQ-OLD"
    assert "rfq_id_aliases" in out


def test_is_unique_violation_helper():
    assert tc.is_unique_violation(_api_error("23505")) is True
    assert tc.is_unique_violation(_api_error("42P01")) is False
    assert tc.is_unique_violation(RuntimeError("x")) is False
