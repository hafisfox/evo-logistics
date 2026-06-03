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


def test_air_price_uses_chargeable_weight_times_rate_plus_surcharges():
    # rate 3.0 USD/kg x 100 kg = 300 USD freight; +50 USD surcharges; 13% margin; fx 3.67
    result = p3.calculate_air_price(
        rate_per_kg_usd=3.0,
        chargeable_weight_kg=100.0,
        margin=0.13,
        exchange_rate=3.67,
        surcharges_usd=50.0,
    )
    # subtotal_aed = (300+50)*3.67 = 1284.5; *1.13 = 1451.485; ceil to nearest 10 = 1460
    assert result["final_price_aed"] == 1460
    assert result["air_freight_usd"] == 300.0
    assert result["chargeable_weight_kg"] == 100.0
    assert result["surcharges_usd"] == 50.0


def test_full_pricing_air_mode_produces_single_chargeable_weight_shipment():
    rfq = {"pol": "DXB", "pod": "LHR", "service_type": "airport-to-airport"}
    quote = {"price": "3.0", "carrier": "EK", "surcharges": {"fsc": 50}}
    pricing = p3.calculate_full_pricing(
        rfq, quote, [], [], [], 0.13,
        exchange_rate=3.67, freight_mode="air", chargeable_weight_kg=100.0,
    )
    assert pricing["freight_mode"] == "air"
    assert pricing["grand_total_aed"] == 1460
    assert len(pricing["shipments"]) == 1
    assert pricing["shipments"][0]["chargeable_weight_kg"] == 100.0
    assert pricing["shipments"][0]["carrier"] == "EK"


def test_total_chargeable_weight_takes_volumetric_when_larger():
    # 100x100x60 / 6000 = 100 kg volumetric vs 10 kg actual -> 100 kg, x2 pieces = 200
    pieces = [
        {"count": 2, "weight_kg": 10, "length_cm": 100, "width_cm": 100, "height_cm": 60},
    ]
    assert p3.total_chargeable_weight(pieces) == 200.0


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


class _AirRateQuery:
    def __init__(self, rows, recorder):
        self._rows = rows
        self._rec = recorder

    def select(self, *_a, **_k):
        return self

    def eq(self, column, value):
        self._rec.setdefault("eq", []).append((column, value))
        return self

    def lte(self, column, value):
        self._rec["lte"] = (column, value)
        return self

    def order(self, column, desc=False):
        self._rec["order"] = (column, desc)
        return self

    def limit(self, n):
        self._rec["limit"] = n
        return self

    def execute(self):
        return SimpleNamespace(data=self._rows)


class _AirRateSupabase:
    def __init__(self, rows):
        self._rows = rows
        self.recorder = {}

    def table(self, name):
        self.recorder["table"] = name
        return _AirRateQuery(self._rows, self.recorder)


def test_get_air_rate_per_kg_returns_tier_rate_and_min_charge():
    supabase = _AirRateSupabase(
        [{"rate_per_kg_usd": 4.5, "min_charge_usd": 75, "min_weight_kg": 100}]
    )
    result = p3.get_air_rate_per_kg(supabase, "ws-1", "ek", "dxb", "lhr", 250.0)
    assert result == (4.5, 75.0)
    # Lane filters are uppercased and the tier is bounded by the chargeable weight,
    # ordered by descending break so the highest applicable tier wins.
    assert ("carrier", "EK") in supabase.recorder["eq"]
    assert ("origin", "DXB") in supabase.recorder["eq"]
    assert ("destination", "LHR") in supabase.recorder["eq"]
    assert supabase.recorder["lte"] == ("min_weight_kg", 250.0)
    assert supabase.recorder["order"] == ("min_weight_kg", True)


def test_get_air_rate_per_kg_returns_none_when_lane_unconfigured():
    supabase = _AirRateSupabase([])
    assert p3.get_air_rate_per_kg(supabase, "ws-1", "EK", "DXB", "LHR", 250.0) is None


def test_get_air_rate_per_kg_skips_lookup_on_missing_fields_or_weight():
    supabase = _AirRateSupabase(
        [{"rate_per_kg_usd": 4.5, "min_charge_usd": 0, "min_weight_kg": 0}]
    )
    assert p3.get_air_rate_per_kg(supabase, "ws-1", "", "DXB", "LHR", 250.0) is None
    assert p3.get_air_rate_per_kg(supabase, "ws-1", "EK", "DXB", "LHR", 0.0) is None
