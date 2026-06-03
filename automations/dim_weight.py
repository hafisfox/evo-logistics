"""DIM (volumetric) weight calculator for air freight.

Standard air freight DIM factor = 6000 (cm → kg).
Chargeable weight = max(actual_weight, volumetric_weight).
"""


def calculate_chargeable_weight_kg(
    actual_weight_kg: float,
    length_cm: float,
    width_cm: float,
    height_cm: float,
    dim_factor: int = 6000,
) -> float:
    """Return max(actual_weight, volumetric_weight)."""
    volumetric = (length_cm * width_cm * height_cm) / dim_factor
    return max(actual_weight_kg, volumetric)


def total_chargeable_weight(pieces: list, dim_factor: int = 6000) -> float:
    """Sum chargeable weight across all piece lines (count × chargeable per piece)."""
    total = 0.0
    for p in pieces:
        count = p.get("count") or 1
        actual = p.get("weight_kg") or 0
        l = p.get("length_cm") or 0
        w = p.get("width_cm") or 0
        h = p.get("height_cm") or 0
        if l and w and h:
            cw = calculate_chargeable_weight_kg(actual, l, w, h, dim_factor)
        else:
            cw = actual
        total += cw * count
    return round(total, 2)
