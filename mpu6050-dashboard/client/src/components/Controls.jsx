/**
 * Controls.jsx
 * ────────────
 * Dashboard control bar.
 *
 * Features:
 *  • Pause / Resume live graph updates
 *  • Clear all buffered data
 *  • Window-size selector (100 / 200 / 500 points)
 *  • Download visible data as CSV
 */

import { useCallback } from 'react';

const WINDOW_OPTIONS = [
  { label: '100 pts', value: 100 },
  { label: '200 pts', value: 200 },
  { label: '500 pts', value: 500 },
];

/**
 * Converts the visible data array to a CSV string and triggers a download.
 * @param {Array<object>} data
 */
function downloadCSV(data) {
  if (!data.length) return;

  const keys = ['ts', 'ax', 'ay', 'az', 'gx', 'gy', 'gz', 'temp'];
  const header = keys.join(',');
  const rows = data.map(row =>
    keys.map(k => {
      const v = row[k];
      if (k === 'ts') return new Date(v).toISOString();
      return v !== undefined ? v : '';
    }).join(',')
  );

  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `mpu6050_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {object}   props
 * @param {boolean}  props.paused
 * @param {function} props.togglePause
 * @param {function} props.clearData
 * @param {number}   props.windowSize
 * @param {function} props.setWindowSize
 * @param {Array}    props.data           — currently visible data (for CSV)
 */
export default function Controls({
  paused,
  togglePause,
  clearData,
  windowSize,
  setWindowSize,
  data,
}) {
  const handleDownload = useCallback(() => downloadCSV(data), [data]);

  return (
    <div className="glass-card rounded-xl px-5 py-3 border border-white/5 mb-4
                    flex flex-wrap items-center gap-3">

      {/* ── Pause / Resume ────────────────────────────────── */}
      <button
        id="btn-pause-resume"
        onClick={togglePause}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    border transition-all duration-150 active:scale-95
                    ${paused
                      ? 'bg-green-500/15 border-green-500/40 text-green-400 hover:bg-green-500/25'
                      : 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/25'
                    }`}
      >
        {paused ? '▶ Resume' : '⏸ Pause'}
      </button>

      {/* ── Clear ─────────────────────────────────────────── */}
      <button
        id="btn-clear"
        onClick={clearData}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                   bg-red-500/10 border border-red-500/30 text-red-400
                   hover:bg-red-500/20 transition-all duration-150 active:scale-95"
      >
        🗑 Clear
      </button>

      {/* ── Window size selector ───────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Window:</span>
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {WINDOW_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              id={`btn-window-${value}`}
              onClick={() => setWindowSize(value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                          ${windowSize === value
                            ? 'bg-blue-600 text-white'
                            : 'bg-surface-700 text-gray-400 hover:bg-surface-600'
                          }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Download CSV ───────────────────────────────────── */}
      <button
        id="btn-download-csv"
        onClick={handleDownload}
        disabled={!data.length}
        className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                   bg-blue-600/15 border border-blue-500/40 text-blue-400
                   hover:bg-blue-600/25 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-150 active:scale-95"
      >
        ⬇ Download CSV
      </button>
    </div>
  );
}
