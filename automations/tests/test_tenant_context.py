import base64
import json
import os
import sys
import unittest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import tenant_context as tc


class _FakeResponse:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, table_name, data, should_raise=False):
        self.table_name = table_name
        self._data = data
        self._should_raise = should_raise
        self.eq_calls = []
        self.update_values = None
        self.upsert_values = None
        self.insert_values = None
        self.limit_value = None

    def select(self, _columns):
        return self

    def eq(self, column, value):
        self.eq_calls.append((column, value))
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def update(self, values):
        self.update_values = values
        return self

    def upsert(self, values):
        self.upsert_values = values
        return self

    def insert(self, values):
        self.insert_values = values
        return self

    def execute(self):
        if self._should_raise:
            raise RuntimeError("query failed")
        return _FakeResponse(self._data)


class _FakeSupabase:
    def __init__(self, data_by_table=None, raise_tables=None):
        self.data_by_table = data_by_table or {}
        self.raise_tables = set(raise_tables or [])
        self.last_query = None

    def table(self, table_name):
        query = _FakeQuery(
            table_name,
            self.data_by_table.get(table_name, []),
            should_raise=table_name in self.raise_tables,
        )
        self.last_query = query
        return query


class TenantContextTests(unittest.TestCase):
    def test_extract_pubsub_mailbox_from_attributes(self):
        payload = {
            "message": {
                "attributes": {
                    "emailAddress": "Ops@Example.com",
                }
            }
        }
        self.assertEqual(tc.extract_pubsub_mailbox(payload), "ops@example.com")

    def test_extract_pubsub_mailbox_from_encoded_data(self):
        encoded = base64.urlsafe_b64encode(
            json.dumps({"emailAddress": "team@example.com"}).encode("utf-8")
        ).decode("utf-8")
        payload = {"message": {"data": encoded}}
        self.assertEqual(tc.extract_pubsub_mailbox(payload), "team@example.com")

    def test_extract_pubsub_mailbox_invalid_payload(self):
        self.assertIsNone(tc.extract_pubsub_mailbox({}))
        self.assertIsNone(tc.extract_pubsub_mailbox(None))

    def test_resolve_workspace_id_from_connected_mailbox(self):
        supabase = _FakeSupabase(
            {
                "workspace_mailboxes": [
                    {"workspace_id": "ws-123", "status": "connected"},
                ]
            }
        )
        self.assertEqual(tc.resolve_workspace_id(supabase, "ops@example.com"), "ws-123")

    def test_resolve_workspace_id_returns_none_without_fallback(self):
        supabase = _FakeSupabase(
            {
                "workspace_mailboxes": [
                    {"workspace_id": "ws-123", "status": "disconnected"},
                ]
            }
        )
        self.assertIsNone(tc.resolve_workspace_id(supabase, "ops@example.com"))

    def test_resolve_workspace_id_handles_query_error(self):
        supabase = _FakeSupabase(raise_tables={"workspace_mailboxes"})
        self.assertIsNone(tc.resolve_workspace_id(supabase, "ops@example.com"))

    def test_resolve_workspace_id_supports_optional_bootstrap_fallback(self):
        supabase = _FakeSupabase()
        previous = tc.ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK
        tc.ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK = True
        try:
            self.assertEqual(
                tc.resolve_workspace_id(supabase, "ops@example.com"),
                tc.BOOTSTRAP_WORKSPACE_ID,
            )
        finally:
            tc.ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK = previous

    def test_scoped_select_applies_workspace_filter_for_tenant_tables(self):
        supabase = _FakeSupabase({"master_rfqs": [{"rfq_id": "RFQ-1"}]})
        rows = tc.scoped_select(supabase, "master_rfqs", "ws-abc")
        self.assertEqual(rows, [{"rfq_id": "RFQ-1"}])
        self.assertIn(("workspace_id", "ws-abc"), supabase.last_query.eq_calls)

    def test_scoped_select_applies_workspace_filter_for_processed_email_events(self):
        supabase = _FakeSupabase({"processed_email_events": [{"gmail_message_id": "m-1"}]})
        rows = tc.scoped_select(supabase, "processed_email_events", "ws-abc")
        self.assertEqual(rows, [{"gmail_message_id": "m-1"}])
        self.assertIn(("workspace_id", "ws-abc"), supabase.last_query.eq_calls)

    def test_scoped_select_skips_workspace_filter_for_non_tenant_tables(self):
        supabase = _FakeSupabase({"public_reference_data": [{"id": 1}]})
        rows = tc.scoped_select(supabase, "public_reference_data", "ws-abc")
        self.assertEqual(rows, [{"id": 1}])
        self.assertNotIn(("workspace_id", "ws-abc"), supabase.last_query.eq_calls)

    def test_scoped_eq_filter_adds_column_and_workspace_filter(self):
        supabase = _FakeSupabase({"agents": [{"agent_name": "A"}]})
        rows = tc.scoped_eq_filter(supabase, "agents", "ws-1", "status", "active")
        self.assertEqual(rows, [{"agent_name": "A"}])
        self.assertIn(("status", "active"), supabase.last_query.eq_calls)
        self.assertIn(("workspace_id", "ws-1"), supabase.last_query.eq_calls)

    def test_scoped_upsert_injects_workspace_id(self):
        supabase = _FakeSupabase()
        payload = {"rfq_id": "RFQ-1"}
        tc.scoped_upsert(supabase, "master_rfqs", "ws-1", payload)
        self.assertEqual(supabase.last_query.upsert_values["workspace_id"], "ws-1")
        self.assertEqual(payload, {"rfq_id": "RFQ-1"})

    def test_scoped_update_by_eq_adds_workspace_filter(self):
        supabase = _FakeSupabase()
        tc.scoped_update_by_eq(
            supabase,
            "master_rfqs",
            "ws-1",
            {"status": "Quoted"},
            "rfq_id",
            "RFQ-1",
        )
        self.assertEqual(supabase.last_query.update_values, {"status": "Quoted"})
        self.assertIn(("rfq_id", "RFQ-1"), supabase.last_query.eq_calls)
        self.assertIn(("workspace_id", "ws-1"), supabase.last_query.eq_calls)

    def test_audit_ignored_mailbox_event_writes_bootstrap_audit_row(self):
        supabase = _FakeSupabase()
        tc.audit_ignored_mailbox_event(
            supabase,
            source="phase_1_request_analysis",
            mailbox_email="ops@example.com",
            reason="mailbox_not_connected_or_unmapped",
        )
        payload = supabase.last_query.insert_values
        self.assertEqual(payload["workspace_id"], tc.BOOTSTRAP_WORKSPACE_ID)
        self.assertEqual(payload["action"], "automation_mailbox_event_ignored")
        self.assertEqual(payload["entity_type"], "phase_1_request_analysis")
        self.assertEqual(payload["entity_id"], "ops@example.com")

    def test_tenant_tables_include_new_idempotency_tables(self):
        self.assertIn("processed_email_events", tc.TENANT_TABLES)
        self.assertIn("rfq_id_aliases", tc.TENANT_TABLES)


if __name__ == "__main__":
    unittest.main()
