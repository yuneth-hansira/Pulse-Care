/**
 * LiveChart.jsx
 * ─────────────
 * Reusable Recharts LineChart for the sensor dashboard.
 *
 * Props:
 *   title       string            — Chart heading
 *   data        Array<object>     — rolling sample array
 *   lines       Array<LineConfig> — { key, color, name }
 *   yDomain     [min|'auto', max|'auto']  — Y axis domain
 *   unit        string            — unit shown in tooltip
 *   paused      boolean           — shows a PAUSED badge
 *   height      number            — chart height (px, default 220)
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

/** Formats a server-side ts (ms) as mm:ss.t */
function fmtTs(ts) {
  if (ts === undefined || ts === null) return '';
  const d = new Date(ts);
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(Math.floor(d.getMilliseconds() / 100)); // tenths
  return `${mm}:${ss}.${ms}`;
}

/** Custom tooltip to keep it clean and dark */
function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-gray-400 mb-1">{fmtTs(label)}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</strong>{' '}
          <span className="text-gray-500">{unit}</span>
        </p>
      ))}
    </div>
  );
}

export default function LiveChart({
  title,
  data,
  lines,
  yDomain = ['auto', 'auto'],
  unit = '',
  paused = false,
  height = 220,
}) {
  // Only pass the last N points to Recharts (already sliced by windowSize in hook)
  const chartData = useMemo(() => data, [data]);
  const hasData   = chartData.length > 0;

  return (
    <div className="glass-card rounded-xl p-4 border border-white/5 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 tracking-wide">{title}</h2>
        <div className="flex items-center gap-2">
          {unit && (
            <span className="text-xs font-mono text-gray-500 bg-surface-700 px-2 py-0.5
                             rounded border border-white/5">
              {unit}
            </span>
          )}
          {paused && (
            <span className="text-xs font-semibold text-yellow-400 bg-yellow-400/10
                             border border-yellow-400/30 px-2 py-0.5 rounded">
              ⏸ PAUSED
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }} className="relative">
        {!hasData && (
          <div className="no-data-overlay rounded-lg">Waiting for data…</div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="ts"
              tickFormatter={fmtTs}
              tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              minTickGap={60}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              width={52}
            />
            <Tooltip
              content={<CustomTooltip unit={unit} />}
              isAnimationActive={false}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '4px', color: '#9ca3af' }}
              iconSize={8}
            />
            {lines.map(({ key, color, name }) => (
              <Line
                key={key}
                type="linear"
                dataKey={key}
                name={name}
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
