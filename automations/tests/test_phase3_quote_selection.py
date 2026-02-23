import os
import sys
from types import SimpleNamespace


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import phase_3_select_and_quote as p3


def _request(**overrides):
    base = {
        "rfq_id": "RFQ-1",
        "workspace_id": "ws-1",
        "selected_by_user_id": "user-1",
        "selected_agent": "Agent A",
        "selected_carrier": "COSCO",
        "selected_match": "RFQ-1_agenta@example.com_1_COSCO_a1b2c3d4",
        "shipment_number": "1",
        "selected_by": "dashboard",
        "margin": 0.13,
        "quote_threshold": 2,
    }
    base.update(overrides)
    return p3.SelectAgentRequest(**base)


def test_find_selected_quote_prefers_exact_match():
    all_quotes = [
        {
            "rfq_id": "RFQ-1",
            "match": "RFQ-1_agenta@example.com_1_COSCO_oldopt00",
            "agent_name": "Agent A",
            "carrier": "COSCO",
            "shipment_number": "1",
            "price": "1800",
        },
        {
            "rfq_id": "RFQ-1",
            "match": "RFQ-1_agenta@example.com_1_MSK_a1b2c3d4",
            "agent_name": "Agent A",
            "carrier": "MSK",
            "shipment_number": "1",
            "price": "1700",
        },
    ]
    request = _request(
        selected_carrier="COSCO",
        selected_match="RFQ-1_agenta@example.com_1_MSK_a1b2c3d4",
    )

    selected = p3._find_selected_quote(all_quotes, request)
    assert selected["carrier"] == "MSK"
    assert selected["match"] == "RFQ-1_agenta@example.com_1_MSK_a1b2c3d4"


def test_find_selected_quote_falls_back_when_selected_match_missing():
    all_quotes = [
        {
            "rfq_id": "RFQ-1",
            "match": "RFQ-1_agenta@example.com_1_COSCO_oldopt00",
            "agent_name": "Agent A",
            "carrier": "COSCO",
            "shipment_number": "1",
            "price": "1800",
        },
    ]
    request = _request(selected_match="")

    selected = p3._find_selected_quote(all_quotes, request)
    assert selected["carrier"] == "COSCO"
    assert selected["match"] == "RFQ-1_agenta@example.com_1_COSCO_oldopt00"


class _FakeQuery:
    def __init__(self, table_name, rows_by_table):
        self.table_name = table_name
        self.rows_by_table = rows_by_table
        self.values = None
        self.eq_calls = []

    def select(self, _columns="*"):
        return self

    def update(self, values):
        self.values = values
        return self

    def eq(self, column, value):
        self.eq_calls.append((column, value))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows_by_table.get(self.table_name, []))


class _FakeSupabase:
    def __init__(self, rows_by_table=None):
        self.rows_by_table = rows_by_table or {}
        self.queries = []

    def table(self, table_name):
        query = _FakeQuery(table_name, self.rows_by_table)
        self.queries.append(query)
        return query


def test_process_agent_selection_uses_workspace_mailbox_for_notifications(monkeypatch):
    request = _request()
    fake_supabase = _FakeSupabase()
    notified = {}

    monkeypatch.setattr(p3, "get_supabase_client", lambda: fake_supabase)
    monkeypatch.setattr(
        p3,
        "get_gmail_service_for_workspace",
        lambda _supabase, workspace_id: (object(), f"{workspace_id}@mailbox.test"),
    )
    monkeypatch.setattr(
        p3,
        "_get_by_filter",
        lambda _supabase, table, _column, _value, _workspace_id: (
            [{
                "rfq_id": "RFQ-1",
                "thread_id": "thread-1",
                "customer_email": "customer@example.com",
                "service_type": "port-to-port",
                "container_type": "40HQ",
                "qty": "1",
                "pol": "SHENZHEN",
                "pod": "JEBEL ALI",
            }] if table == "master_rfqs" else [{"match": request.selected_match}]
        ),
    )
    monkeypatch.setattr(p3, "_find_selected_quote", lambda _quotes, _request: {"price": "1000"})
    monkeypatch.setattr(p3, "_get_table", lambda *_args, **_kwargs: [])
    monkeypatch.setattr(
        p3,
        "calculate_full_pricing",
        lambda *_args, **_kwargs: {
            "grand_total_aed": 1000,
            "grand_total_usd": 272,
            "shipments": [],
        },
    )
    monkeypatch.setattr(p3, "_send_quotation_email", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        p3,
        "_notify_sales",
        lambda _gmail, notification_email, *_args, **_kwargs: notified.update(
            {"email": notification_email}
        ),
    )

    result = p3._process_agent_selection(request)

    assert result["success"] is True
    assert notified["email"] == "ws-1@mailbox.test"
