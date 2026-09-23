'use client';

import { useState } from 'react';

import { CHART_INK, CHART_PRIMARY } from '@/lib/chart-theme';
import { niceMax } from './line-chart';

export type Column = { key: string; label: string; value: number; detail?: string };

const W = 840;
const H = 230;
const PAD = { top: 26, right: 12, bottom: 30, left: 40 };
const MAX_BAR = 24;
const RADIUS = 4;

/** A column with a 4px rounded data end and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(RADIUS, w / 2, h);
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}

/**
 * One measure across ordered categories, one colour for every column — the
 * height already carries the magnitude. Only the peak is labelled; every other
 * value is a hover, a focus or the table away.
 */
export function ColumnChart({
  data,
  ariaLabel,
  valueName,
  xHeading,
  colour = CHART_PRIMARY,
  decimals = 0,
}: {
  data: Column[];
  ariaLabel: string;
  valueName: string;
  xHeading: string;
  colour?: string;
  /** Decimal places for values — a plain number, since it crosses from the server. */
  decimals?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const format = (v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: decimals });
  if (!data.length || data.every((d) => d.value === 0)) {
    return <p className="px-5 py-10 text-center text-xs text-slate">Nothing to chart for this period yet.</p>;
  }

  const peak = Math.max(...data.map((d) => d.value));
  const max = niceMax(peak);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / data.length;
  const barW = Math.min(MAX_BAR, band * 0.62);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const peakIndex = data.findIndex((d) => d.value === peak);
  const point = active === null ? null : data[active];

  return (
    <figure className="m-0">
      <div className="relative px-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={ariaLabel}>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={CHART_INK.grid} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={PAD.left - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={CHART_INK.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t.toLocaleString('en-GB')}
              </text>
            </g>
          ))}

          <g role="list">
          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const top = y(d.value);
            const isActive = active === i;
            return (
              <g
                key={d.key}
                tabIndex={0}
                role="listitem"
                aria-label={`${d.label}: ${format(d.value)} ${valueName}${d.detail ? `, ${d.detail}` : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              >
                {/* The hit target is the whole band, not just the painted column. */}
                <rect x={PAD.left + band * i} y={PAD.top} width={band} height={innerH} fill="transparent" />
                <path
                  d={columnPath(cx - barW / 2, top, barW, PAD.top + innerH - top)}
                  fill={colour}
                  opacity={active === null || isActive ? 1 : 0.55}
                />
                <text x={cx} y={H - 11} textAnchor="middle" fontSize={10} fill={isActive ? CHART_INK.primary : CHART_INK.muted}>
                  {d.label}
                </text>
                {i === peakIndex && (
                  <text x={cx} y={top - 7} textAnchor="middle" fontSize={11} fill={CHART_INK.secondary} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {format(d.value)}
                  </text>
                )}
              </g>
            );
          })}
          </g>
        </svg>

        {point && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 rounded-brand border border-stone bg-white px-3 py-2 shadow-lift"
            style={{
              left: `${(((PAD.left + band * active! + band / 2) / W) * 100).toFixed(2)}%`,
              transform: active! > data.length / 2 ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)',
            }}
          >
            <p className="text-sm font-semibold tabular-nums text-ink">
              {format(point.value)} <span className="text-2xs font-normal text-slate">{valueName}</span>
            </p>
            <p className="text-2xs text-slate">{point.label}</p>
            {point.detail && <p className="mt-0.5 text-2xs text-slate">{point.detail}</p>}
          </div>
        )}
      </div>

      <details className="mt-2 border-t border-stone/60 px-5 pt-3">
        <summary className="cursor-pointer text-2xs text-slate hover:text-ink">View as a table</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{xHeading}</th>
                <th>{valueName}</th>
                {data.some((d) => d.detail) && <th>Detail</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key}>
                  <td>{d.label}</td>
                  <td className="tabular-nums">{format(d.value)}</td>
                  {data.some((x) => x.detail) && <td className="text-slate">{d.detail ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
