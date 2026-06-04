import os
import sys
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from detention import calculate_dd_fee, days_past  # noqa: E402


def test_within_free_time_is_zero():
    assert calculate_dd_fee(5, 5, 150) == 0
    assert calculate_dd_fee(5, 3, 150) == 0


def test_days_over_free_time():
    assert calculate_dd_fee(3, 6, 150) == 450  # 3 chargeable days


def test_partial_day_rounds_up():
    assert calculate_dd_fee(3, 5.1, 100) == 300  # ceil(2.1) = 3 days


def test_none_and_negative_inputs():
    assert calculate_dd_fee(None, None, None) == 0
    assert calculate_dd_fee(-2, 4, 100) == 400  # free clamped to 0 -> 4 chargeable days
    assert calculate_dd_fee(2, -1, 100) == 0
    assert calculate_dd_fee(2, 5, -50) == 0  # negative rate clamped to 0


def test_days_past_iso_string():
    assert days_past("2026-06-01", as_of=date(2026, 6, 4)) == 3
    assert days_past("2026-06-10", as_of=date(2026, 6, 4)) == 0  # still within free time


def test_days_past_handles_bad_and_typed_inputs():
    assert days_past("", as_of=date(2026, 6, 4)) == 0
    assert days_past("not-a-date") == 0
    assert days_past(None) == 0
    assert days_past(date(2026, 6, 1), as_of=date(2026, 6, 4)) == 3
    assert days_past("2026-06-01T08:00:00", as_of=date(2026, 6, 4)) == 3  # iso datetime trimmed


def test_end_to_end_accrual_via_days_past():
    # free_until passed 4 days ago at $120/day -> 4 * 120
    days = days_past("2026-06-01", as_of=date(2026, 6, 5))
    fee = calculate_dd_fee(free_time_days=0, days_used=days, daily_rate_usd=120)
    assert days == 4
    assert fee == 480
