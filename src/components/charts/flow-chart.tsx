'use client';

import { useMemo, useState } from 'react';

import { CHART_INK, CHART_SERIES } from '@/lib/chart-theme';

export type FlowPoint = { label: string; opened: number; resolved: number };

const W = 840;
const H = 260;
const PAD = { top: 18, right: 58, bottom: 34, left: 34 };

const SERIES = [
  { key: 'opened' as const, name: 'Cases opened', colour: CHART_SERIES[0] },
  { key: 'resolved' as const, name: 'Cases resolved', colour: CHART_SERIES[1] },
];

/**
 * Opened against resolved, on one axis. If the orange line sits above the blue
 * one for a week, the backlog is growing — that is the entire question this
 * chart exists to answer.
 */
export function FlowChart({ data }: { data: FlowPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  const { max, x, y, paths } = useMemo(() => {
    const peak = Math.max(1, ...data.flatMap((d) => [d.opened, d.resolved]));
    const max = Math.ceil(peak / 2) * 2 || 2;
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) =>
      PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

    const paths = SERIES.map((s) => ({
      ...s,
      d: data.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[s.key]).toFixed(1)}`).join(' '),
    }));

    return { max, x, y, paths };
  }, [data]);

  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));
  const point = active === null ? null : data[active];

  return (
    <figure className="m-0">
      {/* Legend — always present for two series */}
      <div className="mb-2 flex flex-wrap items-center gap-4 px-5">
        {SERIES.map((s) => (
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
          aria-label={`Cases opened and resolved over the last ${data.length} days`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1));
            if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? data.length) - 1));
            if (e.key === 'Escape') setActive(null);
          }}
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
                {t}
              </text>
            </g>
          ))}

          {/* X labels, thinned so they never collide */}
          {data.map((p, i) =>
            i % labelEvery === 0 || i === data.length - 1 ? (
              <text
                key={p.label}
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

          {/* Endpoint markers with a 2px surface ring, plus a direct label */}
          {SERIES.map((s) => {
            const last = data[data.length - 1];
            if (!last) return null;
            return (
              <g key={`end-${s.key}`}>
                <circle
                  cx={x(data.length - 1)}
                  cy={y(last[s.key])}
                  r={4.5}
                  fill={s.colour}
                  stroke={CHART_INK.surface}
                  strokeWidth={2}
                />
                <text
                  x={x(data.length - 1) + 10}
                  y={y(last[s.key]) + 3.5}
                  fontSize={11}
                  fill={CHART_INK.secondary}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {last[s.key]}
                </text>
              </g>
            );
          })}

          {active !== null &&
            SERIES.map((s) => (
              <circle
                key={`dot-${s.key}`}
                cx={x(active)}
                cy={y(data[active]![s.key])}
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
            {SERIES.map((s) => (
              <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-2xs text-slate">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.colour }} />
                {s.name}
                <span className="ml-auto pl-3 font-semibold tabular-nums text-ink">
                  {point[s.key]}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Table-view twin — every value reachable without colour or hover */}
      <details className="mt-3 border-t border-stone/60 px-5 pt-3">
        <summary className="cursor-pointer text-2xs text-slate hover:text-ink">
          View as a table
        </summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Opened</th>
                <th>Resolved</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td className="tabular-nums">{d.opened}</td>
                  <td className="tabular-nums">{d.resolved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
