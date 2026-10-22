/**
 * App.jsx
 * ───────
 * Root application component.
 *
 * Layout (top → bottom):
 *   1. StatusBar   — header + connection status + stale-data warning
 *   2. Controls    — pause, clear, window size, CSV download
 *   3. StatCards   — 7 numeric value cards
 *   4. Charts row  — Accelerometer | Gyroscope | Temperature charts
 *   5. Bottom row  — TiltIndicator + Tilt legend
 */

import { useSensorSocket } from './hooks/useSensorSocket';
import StatusBar     from './components/StatusBar';
import StatCards     from './components/StatCards';
import LiveChart     from './components/LiveChart';
import TiltIndicator from './components/TiltIndicator';
import Controls      from './components/Controls';

// ── Chart axis definitions ────────────────────────────────────────────────────
const ACCEL_LINES = [
  { key: 'ax', color: '#3b82f6', name: 'Accel X' },
  { key: 'ay', color: '#10b981', name: 'Accel Y' },
  { key: 'az', color: '#f59e0b', name: 'Accel Z' },
];

const GYRO_LINES = [
  { key: 'gx', color: '#8b5cf6', name: 'Gyro X' },
  { key: 'gy', color: '#06b6d4', name: 'Gyro Y' },
  { key: 'gz', color: '#ec4899', name: 'Gyro Z' },
];

const TEMP_LINES = [
  { key: 'temp', color: '#ef4444', name: 'Temperature' },
];

export default function App() {
  const {
    data,
    latest,
    connected,
    serialConnected,
    mock,
    samplesPerSecond,
    paused,
    togglePause,
    clearData,
    windowSize,
    setWindowSize,
  } = useSensorSocket({ defaultWindowSize: 200 });

  return (
    <div className="min-h-screen bg-surface-900 text-gray-100 p-4 md:p-6 font-sans">
      {/* ── 1. Header / status bar ────────────────────────────────────── */}
      <StatusBar
        connected={connected}
        serialConnected={serialConnected}
        mock={mock}
        latest={latest}
        samplesPerSecond={samplesPerSecond}
      />

      {/* ── 2. Controls ──────────────────────────────────────────────── */}
      <Controls
        paused={paused}
        togglePause={togglePause}
        clearData={clearData}
        windowSize={windowSize}
        setWindowSize={setWindowSize}
        data={data}
      />

      {/* ── 3. Stat cards ────────────────────────────────────────────── */}
      <StatCards latest={latest} />

      {/* ── 4. Charts ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Accelerometer */}
        <LiveChart
          title="Accelerometer"
          data={data}
          lines={ACCEL_LINES}
          yDomain={[-2, 2]}
          unit="g"
          paused={paused}
          height={220}
        />

        {/* Gyroscope */}
        <LiveChart
          title="Gyroscope"
          data={data}
          lines={GYRO_LINES}
          yDomain={['auto', 'auto']}
          unit="°/s"
          paused={paused}
          height={220}
        />

        {/* Temperature */}
        <LiveChart
          title="Temperature"
          data={data}
          lines={TEMP_LINES}
          yDomain={['auto', 'auto']}
          unit="°C"
          paused={paused}
          height={220}
        />
      </div>

      {/* ── 5. Bottom row: Tilt indicator + info card ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Tilt 3-D box */}
        <TiltIndicator latest={latest} />

        {/* Quick-reference info card */}
        <div className="glass-card rounded-xl p-5 border border-white/5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Signal Reference</h2>
          <div className="space-y-3">
            <InfoRow
              label="ax / ay / az"
              desc="Linear acceleration (gravity included). Flat & still → az ≈ −1 g."
              color="text-blue-400"
            />
            <InfoRow
              label="gx / gy / gz"
              desc="Angular velocity in deg/s. Near 0 when stationary."
              color="text-purple-400"
            />
            <InfoRow
              label="temp"
              desc="On-chip die temperature in °C. Typically 30–40 °C."
              color="text-red-400"
            />
            <InfoRow
              label="Roll / Pitch"
              desc="Tilt angles from accelerometer only. Roll = atan2(ay, az), Pitch = atan2(-ax, √(ay²+az²))."
              color="text-cyan-400"
            />
          </div>

          {/* Data format */}
          <div className="mt-5 p-3 rounded-lg bg-surface-800 border border-white/5">
            <p className="text-xs text-gray-500 mb-1.5 font-semibold uppercase tracking-wide">
              Expected JSON (115200 baud)
            </p>
            <code className="text-xs font-mono text-green-400 break-all">
              {`{"ax":-0.103,"ay":-0.551,"az":-0.743,"gx":-11.25,"gy":0.64,"gz":0.46,"temp":30.9}`}
            </code>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-600 mt-2 pb-2">
        MPU6050 Dashboard · ESP32 → USB Serial → Node.js → React
      </footer>
    </div>
  );
}

/** Small descriptor row for the reference card */
function InfoRow({ label, desc, color }) {
  return (
    <div className="flex gap-3">
      <code className={`text-xs font-mono font-semibold ${color} min-w-[80px] pt-0.5`}>
        {label}
      </code>
      <span className="text-xs text-gray-400 leading-relaxed">{desc}</span>
    </div>
  );
}
