'use client';

import { useMemo, useState } from 'react';

import { CHART_INK } from '@/lib/chart-theme';

export type LineSeries = { key: string; name: string; colour: string };
export type LinePoint = { label: string } & Record<string, number | string>;

const W = 840;
const H = 260;
const PAD = { top: 18, right: 58, bottom: 34, left: 40 };
/** End labels closer than this would collide — the legend and tooltip carry them instead. */
const LABEL_GAP = 13;

const value = (p: LinePoint | undefined, key: string) => Number(p?.[key] ?? 0);

/**
 * A round top for the y axis whose half is also a whole number, so the three
 * gridlines (0 / half / top) always read as clean counts.
 */
export function niceMax(peak: number) {
  if (peak <= 10) return Math.max(2, Math.ceil(peak / 2) * 2);
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  return [1, 1.2, 2, 3, 4, 5, 6, 8, 10].map((m) => m * magnitude).find((v) => v >= peak)!;
}

/**
 * Several series over time on one axis. Two-pixel lines, a crosshair that
 * snaps to the nearest point, one tooltip listing every series, end-point
 * labels only where they have room, and a table twin so no value depends on
 * colour or hover.
 */
export function LineChart({
  data,
  series,
  ariaLabel,
  xHeading = 'Day',
}: {
  data: LinePoint[];
  series: LineSeries[];
  ariaLabel: string;
  xHeading?: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const { max, x, y, paths, endLabels } = useMemo(() => {
    const peak = Math.max(1, ...data.flatMap((d) => series.map((s) => value(d, s.key))));
    const max = niceMax(peak);
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) =>
      PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

    const paths = series.map((s) => ({
      ...s,
      d: data.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(value(p, s.key)).toFixed(1)}`).join(' '),
    }));

    // Label line ends from the highest down, skipping any that would overlap.
    const last = data[data.length - 1];
    const placed: number[] = [];
    const endLabels = series
      .map((s) => ({ key: s.key, v: value(last, s.key), cy: y(value(last, s.key)) }))
      .sort((a, b) => a.cy - b.cy)
      .filter((l) => {
        if (placed.some((py) => Math.abs(py - l.cy) < LABEL_GAP)) return false;
        placed.push(l.cy);
        return true;
      });

    return { max, x, y, paths, endLabels };
  }, [data, series]);

  if (!data.length) {
    return <p className="px-5 py-10 text-center text-xs text-slate">Nothing to chart for this period yet.</p>;
  }

  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const point = active === null ? null : data[active];

  return (
    <figure className="m-0">
      {/* Legend — always present for two or more series */}
      <div className="mb-2 flex flex-wrap items-center gap-4 px-5">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2 text-2xs text-slate">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.colour }} />
            {s.name}
          </span>
        ))}
      </div>

      <div className="relative px-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1));
            if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? data.length) - 1));
            if (e.key === 'Escape') setActive(null);
          }}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const innerW = W - PAD.left - PAD.right;
            const ratio = (px - PAD.left) / innerW;
            const i = Math.round(ratio * (data.length - 1));
            setActive(Math.max(0, Math.min(data.length - 1, i)));
          }}
        >
          {/* Solid hairline grid, one shade off the surface */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={CHART_INK.grid}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill={CHART_INK.muted}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {t.toLocaleString('en-GB')}
              </text>
            </g>
          ))}

          {/* X labels, thinned so they never collide — including with the last one */}
          {data.map((p, i) =>
            i === data.length - 1 || (i % labelEvery === 0 && data.length - 1 - i >= labelEvery / 2) ? (
              <text
                key={`${p.label}-${i}`}
                x={x(i)}
                y={H - 12}
                textAnchor="middle"
                fontSize={10}
                fill={CHART_INK.muted}
              >
                {p.label}
              </text>
            ) : null,
          )}

          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke={CHART_INK.secondary}
              strokeWidth={1}
              strokeOpacity={0.45}
              vectorEffect="non-scaling-stroke"
            />
          )}

          {paths.map((s) => (
            <path
              key={s.key}
              d={s.d}
              fill="none"
              stroke={s.colour}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Endpoint markers with a 2px surface ring */}
          {series.map((s) => {
            const last = data[data.length - 1];
            return (
              <circle
                key={`end-${s.key}`}
                cx={x(data.length - 1)}
                cy={y(value(last, s.key))}
                r={4.5}
                fill={s.colour}
                stroke={CHART_INK.surface}
                strokeWidth={2}
              />
            );
          })}
          {endLabels.map((l) => (
            <text
              key={`label-${l.key}`}
              x={x(data.length - 1) + 10}
              y={l.cy + 3.5}
              fontSize={11}
              fill={CHART_INK.secondary}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {l.v.toLocaleString('en-GB')}
            </text>
          ))}

          {active !== null &&
            series.map((s) => (
              <circle
                key={`dot-${s.key}`}
                cx={x(active)}
                cy={y(value(data[active], s.key))}
                r={4.5}
                fill={s.colour}
                stroke={CHART_INK.surface}
                strokeWidth={2}
              />
            ))}
        </svg>

        {point && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 rounded-brand border border-stone bg-white px-3 py-2 shadow-lift"
            style={{
              left: `${((x(active!) / W) * 100).toFixed(2)}%`,
              transform:
                active! > data.length / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
            }}
          >
            <p className="text-2xs font-semibold text-ink">{point.label}</p>
            {series.map((s) => (
              <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-2xs text-slate">
                <span className="h-0.5 w-2.5 rounded-full" style={{ background: s.colour }} />
                {s.name}
                <span className="ml-auto pl-3 font-semibold tabular-nums text-ink">
                  {value(point, s.key).toLocaleString('en-GB')}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Table-view twin — every value reachable without colour or hover */}
      <details className="mt-3 border-t border-stone/60 px-5 pt-3">
        <summary className="cursor-pointer text-2xs text-slate hover:text-ink">View as a table</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{xHeading}</th>
                {series.map((s) => (
                  <th key={s.key}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={`${d.label}-${i}`}>
                  <td>{d.label}</td>
                  {series.map((s) => (
                    <td key={s.key} className="tabular-nums">
                      {value(d, s.key).toLocaleString('en-GB')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
