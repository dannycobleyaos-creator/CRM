'use client';

import { CHART_SERIES } from '@/lib/chart-theme';
import { LineChart } from './line-chart';

export type FlowPoint = { label: string; opened: number; resolved: number };

const SERIES = [
  { key: 'opened', name: 'Cases opened', colour: CHART_SERIES[0] },
  { key: 'resolved', name: 'Cases resolved', colour: CHART_SERIES[1] },
];

/**
 * Opened against resolved, on one axis. If the orange line sits above the blue
 * one for a week, the backlog is growing — that is the entire question this
 * chart exists to answer.
 */
export function FlowChart({ data }: { data: FlowPoint[] }) {
  return (
    <LineChart
      data={data}
      series={SERIES}
      ariaLabel={`Cases opened and resolved over the last ${data.length} periods`}
    />
  );
}
