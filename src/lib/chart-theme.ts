/**
 * Chart palette.
 *
 * The brand's UI colours are deliberately muted, which is right for chrome and
 * wrong for data marks — several of them fall below the chroma floor and read as
 * grey next to each other. These are brand-adjacent steps chosen so the pair
 * passes the categorical checks on a white card surface:
 *
 *   node scripts/validate_palette.js "#C0762F,#0F76A8" --mode light
 *   Lightness PASS · Chroma PASS · CVD ΔE 19.2 PASS · Normal ΔE 25.8 PASS · Contrast PASS
 *
 * Series colour follows the entity, never its rank. Slot order is fixed.
 */
export const CHART_SERIES = ['#C0762F', '#0F76A8'] as const;

/** Single-series marks: one colour for every bar, never a value ramp. */
export const CHART_PRIMARY = CHART_SERIES[0];

export const CHART_INK = {
  primary: '#1C2022',
  secondary: '#6E7A7F',
  muted: '#98A2A6',
  grid: '#E6E0D6',
  surface: '#FFFFFF',
} as const;

/** Reserved for state, never reused as a series colour. */
export const CHART_STATUS = {
  good: '#4F6B4B',
  warning: '#B98A32',
  serious: '#C0762F',
  critical: '#A6453C',
} as const;

export function statusForRate(rate: number) {
  if (rate >= 90) return CHART_STATUS.good;
  if (rate >= 75) return CHART_STATUS.warning;
  if (rate >= 60) return CHART_STATUS.serious;
  return CHART_STATUS.critical;
}
