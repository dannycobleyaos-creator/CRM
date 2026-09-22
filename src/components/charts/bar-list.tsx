import { CHART_PRIMARY } from '@/lib/chart-theme';
import { titleCase } from '@/lib/utils';

export type BarDatum = { key: string; label: string; value: number };

/**
 * A single-series horizontal bar list: one colour for every bar, because the
 * bar length already carries the magnitude. Values sit outside the bar end so
 * a short bar never clips its own label.
 */
export function BarList({
  data,
  total,
  emptyLabel = 'Nothing in this period',
}: {
  data: BarDatum[];
  total?: number;
  emptyLabel?: string;
}) {
  if (!data.length) {
    return <p className="px-5 py-8 text-center text-xs text-slate">{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const sum = total ?? data.reduce((s, d) => s + d.value, 0);

  return (
    <ul className="space-y-2.5 px-5 py-4">
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        const share = sum ? Math.round((d.value / sum) * 100) : 0;

        return (
          <li key={d.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
            <span className="truncate text-2xs text-slate" title={titleCase(d.label)}>
              {titleCase(d.label)}
            </span>

            <span
              className="h-2.5 w-full overflow-hidden rounded-full bg-sand"
              title={`${titleCase(d.label)}: ${d.value} (${share}%)`}
            >
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(pct, 2)}%`, background: CHART_PRIMARY }}
              />
            </span>

            <span className="text-2xs tabular-nums text-ink">
              {d.value}
              <span className="ml-1.5 text-slate/70">{share}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
