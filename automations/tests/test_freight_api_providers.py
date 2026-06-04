import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from freight_apis import RateRequest, aggregate_land_rates, get_land_providers  # noqa: E402
from freight_apis.base import NormalizedRate, RateProvider  # noqa: E402
from freight_apis.dat import DATProvider  # noqa: E402
from freight_apis.smc3 import SMC3Provider  # noqa: E402
from freight_apis.uber_freight import LoadsmartProvider, UberFreightProvider  # noqa: E402
from freight_apis.vucem import VucemCrossBorder  # noqa: E402

SAMPLE = RateRequest(
    origin="90001",
    destination="60601",
    equipment_type="van",
    load_type="FTL",
    weight_lbs=1200,
    nmfc_class="70",
)

PROVIDER_CRED_KEYS = [
    "DAT_API_KEY",
    "SMC3_USERNAME",
    "SMC3_PASSWORD",
    "UBER_FREIGHT_API_KEY",
    "LOADSMART_API_KEY",
    "VUCEM_RFC",
    "VUCEM_API_KEY",
]


@pytest.fixture(autouse=True)
def _mock_mode_default(monkeypatch):
    """Make every test hermetic: default to mock mode with no provider creds."""
    monkeypatch.setenv("FREIGHT_API_MODE", "mock")
    for key in PROVIDER_CRED_KEYS:
        monkeypatch.delenv(key, raising=False)
    yield


def _assert_valid_rate(r: NormalizedRate, provider_name: str):
    assert isinstance(r, NormalizedRate)
    assert r.provider == provider_name
    assert r.price > 0
    assert r.currency == "USD"
    assert r.origin == "90001" and r.destination == "60601"
    assert r.freight_mode == "land"
    assert r.source == "api"
    assert isinstance(r.surcharges, list)
    row = r.to_row(workspace_id="ws-1", rfq_id="RFQ-9")
    assert row["workspace_id"] == "ws-1"
    assert row["rfq_id"] == "RFQ-9"
    assert row["price_usd"] == round(r.price, 2)
    assert row["source"] == "api"


def test_each_provider_returns_valid_normalized_rate_in_mock_mode():
    for prov in [DATProvider(), SMC3Provider(), UberFreightProvider(), LoadsmartProvider()]:
        rates = prov.fetch(SAMPLE)
        assert rates, f"{prov.name} returned no rates in mock mode"
        for r in rates:
            _assert_valid_rate(r, prov.name)


def test_providers_unconfigured_without_env():
    for prov in get_land_providers():
        assert prov.is_configured() is False
        assert prov.mode() == "mock"


def test_live_mode_requires_credentials(monkeypatch):
    monkeypatch.setenv("FREIGHT_API_MODE", "live")
    dat = DATProvider()
    # global live but no key -> still mock
    assert dat.mode() == "mock"
    # key present -> live
    monkeypatch.setenv("DAT_API_KEY", "test-key")
    assert dat.is_configured() is True
    assert dat.mode() == "live"


def test_live_mode_invokes_fetch_live(monkeypatch):
    monkeypatch.setenv("FREIGHT_API_MODE", "live")
    monkeypatch.setenv("DAT_API_KEY", "k")
    dat = DATProvider()

    seen = {}

    def fake_live(req):
        seen["called"] = True
        return [
            {
                "rateResponse": {
                    "rate": {"perTrip": {"amount": 1000.0, "currency": "USD"}},
                    "averageFuelSurchargeUsd": 100.0,
                    "estimatedTransitDays": 2,
                    "equipmentType": "VAN",
                    "validUntil": "2026-07-01",
                    "originCity": "90001",
                    "destinationCity": "60601",
                }
            }
        ]

    monkeypatch.setattr(dat, "_fetch_live", fake_live)
    rates = dat.fetch(SAMPLE)
    assert seen.get("called") is True
    assert len(rates) == 1
    assert rates[0].price == 1100.0  # 1000 linehaul + 100 fuel


def test_aggregate_sorts_cheapest_first():
    rates = aggregate_land_rates(SAMPLE)
    assert len(rates) == 4
    prices = [r.price for r in rates]
    assert prices == sorted(prices)


def test_aggregate_survives_failing_provider():
    class BoomProvider(RateProvider):
        name = "boom"

        def _fetch_live(self, req):
            raise RuntimeError("nope")

        def _mock_payloads(self, req):
            raise RuntimeError("boom in mock")

        def _normalize(self, payload, req):
            raise RuntimeError("n")

    combined = aggregate_land_rates(SAMPLE, providers=[BoomProvider(), DATProvider()])
    assert len(combined) == 1
    assert combined[0].provider == "dat"


def test_normalize_against_canned_smc3_payload():
    payload = {
        "scac": "SMC3",
        "details": {
            "originPostalCode": "90001",
            "destinationPostalCode": "60601",
            "transitDays": 3,
            "nmfcClass": "70",
        },
        "charges": [
            {"type": "LINEHAUL", "amountUsd": 300.0},
            {"type": "FUEL", "amountUsd": 60.0},
        ],
        "totalChargeUsd": 360.0,
        "currency": "USD",
        "expirationDate": "2026-07-01",
    }
    r = SMC3Provider()._normalize(payload, SAMPLE.normalized())
    assert r.price == 360.0
    assert r.transit_time_days == 3
    assert r.valid_until == "2026-07-01"
    # LINEHAUL excluded from surcharges; FUEL included
    assert r.surcharges == [{"type": "FUEL", "amount": 60.0}]


def test_unsupported_mode_returns_empty():
    ocean = RateRequest(origin="X", destination="Y", freight_mode="ocean")
    assert DATProvider().fetch(ocean) == []


def test_vucem_scaffold_returns_mock_docs():
    v = VucemCrossBorder()
    assert v.is_configured() is False
    assert v.mode() == "mock"
    cert = v.generate_usmca_certificate({"goods": ["widgets"], "hs_codes": ["1234.56"]})
    assert cert["status"] == "GENERATED_MOCK"
    ped = v.submit_pedimento({"ref": "X"})
    assert ped["status"] == "ACCEPTED_MOCK"


def test_vucem_live_mode_raises_until_implemented(monkeypatch):
    monkeypatch.setenv("FREIGHT_API_MODE", "live")
    monkeypatch.setenv("VUCEM_RFC", "rfc")
    monkeypatch.setenv("VUCEM_API_KEY", "key")
    v = VucemCrossBorder()
    assert v.mode() == "live"
    with pytest.raises(NotImplementedError):
        v.generate_usmca_certificate({})
