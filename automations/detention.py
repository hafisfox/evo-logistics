"""Detention & demurrage (D&D) fee calculation (Phase 4, P2).

Pure, dependency-free helpers so the billing math is unit-testable in isolation.
Used by the ``check_detention_demurrage`` scheduled task in scheduled_tasks.py.
"""

from __future__ import annotations

import math
from datetime import date, datetime
from typing import Optional


def calculate_dd_fee(free_time_days, days_used, daily_rate_usd) -> float:
    """Chargeable D&D fee.

    ``fee = ceil(max(0, days_used - free_time_days)) * daily_rate``

    - Days beyond free time are chargeable; partial days round **up** to a full
      chargeable day (standard carrier billing).
    - Within free time (``days_used <= free_time_days``) the fee is ``0``.
    - ``None``/negative inputs are treated as ``0``.
    """
    free = max(0.0, float(free_time_days or 0))
    used = max(0.0, float(days_used or 0))
    rate = max(0.0, float(daily_rate_usd or 0))
    chargeable_days = max(0, math.ceil(used - free))
    return round(chargeable_days * rate, 2)


def days_past(free_until, as_of: Optional[date] = None) -> int:
    """Whole days elapsed since ``free_until`` (an ISO date string or date).

    Returns ``0`` while still within free time (i.e. on/before ``free_until``),
    and ``0`` if the date can't be parsed.
    """
    as_of = as_of or date.today()
    parsed: Optional[date] = None
    if isinstance(free_until, date) and not isinstance(free_until, datetime):
        parsed = free_until
    elif isinstance(free_until, datetime):
        parsed = free_until.date()
    elif isinstance(free_until, str) and free_until.strip():
        try:
            parsed = datetime.fromisoformat(free_until.strip()[:10]).date()
        except ValueError:
            parsed = None
    if parsed is None:
        return 0
    return max(0, (as_of - parsed).days)
