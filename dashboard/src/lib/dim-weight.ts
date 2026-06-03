/**
 * DIM (volumetric) weight calculator for air freight.
 *
 * Standard air freight DIM factor = 6000 (cm → kg).
 * Chargeable weight = max(actual_weight, volumetric_weight).
 */

export function calculateChargeableWeight(
  actualWeightKg: number,
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  dimFactor = 6000
): number {
  const volumetric = (lengthCm * widthCm * heightCm) / dimFactor;
  return Math.max(actualWeightKg, volumetric);
}

export interface PieceInput {
  count?: number | null;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

export function totalChargeableWeight(
  pieces: PieceInput[],
  dimFactor = 6000
): number {
  let total = 0;
  for (const p of pieces) {
    const count = p.count ?? 1;
    const actual = p.weight_kg ?? 0;
    const l = p.length_cm ?? 0;
    const w = p.width_cm ?? 0;
    const h = p.height_cm ?? 0;
    const cw =
      l && w && h
        ? calculateChargeableWeight(actual, l, w, h, dimFactor)
        : actual;
    total += cw * count;
  }
  return Math.round(total * 100) / 100;
}
