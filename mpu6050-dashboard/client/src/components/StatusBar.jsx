/**
 * StatusBar.jsx
 * ─────────────
 * Top header + status strip for the dashboard.
 *
 * Shows:
 *  • Title and subtitle
 *  • Server connected indicator
 *  • Sensor (serial) connected indicator
 *  • MOCK DATA badge when in mock mode
 *  • Last update timestamp
 *  • Samples/second throughput
 *  • Red warning banner when no data for >3 seconds
 */

import { useEffect, useState } from 'react';

/** Formats a Date.now() timestamp as HH:MM:SS.mmm */
function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false }) +
         '.' + String(d.getMilliseconds()).padStart(3, '0');
}

const STALE_MS = 3000; // warn if no data for this long

/**
 * @param {object} props
 * @param {boolean} props.connected
 * @param {boolean} props.serialConnected
 * @param {boolean} props.mock
 * @param {object|null} props.latest
 * @param {number} props.samplesPerSecond
 */
export default function StatusBar({
  connected,
  serialConnected,
  mock,
  latest,
  samplesPerSecond,
}) {
  const [stale, setStale] = useState(false);

  // Staleness check — runs every second
  useEffect(() => {
    const id = setInterval(() => {
      const age = latest ? Date.now() - latest.ts : Infinity;
      setStale(age > STALE_MS);
    }, 1000);
    return () => clearInterval(id);
  }, [latest]);

  return (
    <>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="glass-card rounded-xl px-6 py-4 mb-4 flex flex-wrap items-center justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-3">
          {/* Sensor icon */}
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-lg">
            📡
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">MPU6050 Live Dashboard</h1>
            <p className="text-xs text-gray-500 font-mono">ESP32 → USB Serial → WebSocket → React</p>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {/* Server */}
          <StatusIndicator
            label="Server"
            on={connected}
            onText="Connected"
            offText="Disconnected"
          />
          {/* Sensor */}
          <StatusIndicator
            label="Sensor"
            on={serialConnected}
            onText="Live"
            offText="No signal"
          />

          {/* Mock badge */}
          {mock && (
            <span className="px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40
                             text-yellow-400 text-xs font-semibold tracking-wide animate-pulse-slow">
              MOCK DATA
            </span>
          )}

          {/* Throughput */}
          <div className="flex items-center gap-1.5 text-gray-400 text-xs font-mono bg-surface-700
                          px-3 py-1.5 rounded-lg border border-white/5">
            <span className="text-blue-400">⚡</span>
            <span>{samplesPerSecond} Hz</span>
          </div>

          {/* Last update */}
          <div className="flex items-center gap-1.5 text-gray-400 text-xs font-mono bg-surface-700
                          px-3 py-1.5 rounded-lg border border-white/5">
            <span className="text-gray-500">🕐</span>
            <span>{formatTime(latest?.ts)}</span>
          </div>
        </div>
      </header>

      {/* ── Stale data warning banner ───────────────────────────────── */}
      {stale && connected && (
        <div className="mb-4 px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/30
                        text-red-400 text-sm flex items-center gap-3 animate-fade-in">
          <span className="text-base">⚠️</span>
          <span>
            <strong>No data received for more than 3 seconds.</strong>{' '}
            {mock
              ? 'Mock generator may have stalled — check the server console.'
              : 'Check that the ESP32 is connected, the COM port is correct, and the Arduino Serial Monitor is closed.'}
          </span>
        </div>
      )}
    </>
  );
}

/**
 * A small dot + label status pill.
 */
function StatusIndicator({ label, on, onText, offText }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`status-dot ${on ? 'connected' : 'disconnected'} ${!on ? 'pulse' : ''}`} />
      <span className="text-gray-400 text-xs">
        <span className="text-gray-500 mr-1">{label}:</span>
        <span className={on ? 'text-green-400 font-medium' : 'text-red-400'}>
          {on ? onText : offText}
        </span>
      </span>
    </div>
  );
}
