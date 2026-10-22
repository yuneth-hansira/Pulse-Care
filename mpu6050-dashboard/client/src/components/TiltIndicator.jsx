/**
 * TiltIndicator.jsx
 * ─────────────────
 * A 3-D CSS-transformed box that rotates in real time to reflect the
 * roll and pitch angles computed from the accelerometer.
 *
 * Formulas:
 *   roll  = atan2(ay, az)               (rotation around X axis)
 *   pitch = atan2(-ax, √(ay² + az²))    (rotation around Y axis)
 *
 * The six faces of the cube are labeled with sensor axes so the
 * user can quickly see which way the board is facing.
 */

import { useMemo } from 'react';

const RAD2DEG = 180 / Math.PI;

/**
 * @param {object}      props
 * @param {object|null} props.latest  — most recent sensor sample
 */
export default function TiltIndicator({ latest }) {
  const { roll, pitch } = useMemo(() => {
    if (!latest) return { roll: 0, pitch: 0 };
    const { ax, ay, az } = latest;
    const roll  = Math.atan2(ay, az)                              * RAD2DEG;
    const pitch = Math.atan2(-ax, Math.sqrt(ay * ay + az * az))  * RAD2DEG;
    return { roll, pitch };
  }, [latest]);

  // CSS 3-D transform: rotateX applies pitch, rotateZ applies roll
  const transform = `rotateX(${-pitch.toFixed(1)}deg) rotateZ(${roll.toFixed(1)}deg)`;

  return (
    <div className="glass-card rounded-xl p-5 border border-white/5 flex flex-col items-center gap-4">
      <h2 className="text-sm font-semibold text-gray-300 tracking-wide self-start">
        Tilt Indicator
      </h2>

      {/* 3-D scene */}
      <div className="perspective-container flex items-center justify-center" style={{ width: 160, height: 160 }}>
        <div
          className="tilt-box-wrapper"
          style={{ transform }}
          aria-label={`Roll: ${roll.toFixed(1)}°, Pitch: ${pitch.toFixed(1)}°`}
        >
          <div className="tilt-face front  text-blue-300">FRONT</div>
          <div className="tilt-face back   text-purple-300">BACK</div>
          <div className="tilt-face right  text-cyan-300">RIGHT</div>
          <div className="tilt-face left   text-cyan-300">LEFT</div>
          <div className="tilt-face top    text-green-300">TOP</div>
          <div className="tilt-face bottom text-amber-300">BTM</div>
        </div>
      </div>

      {/* Numeric readout */}
      <div className="w-full grid grid-cols-2 gap-3">
        <AngleDisplay label="Roll"  value={roll}  color="text-blue-400" />
        <AngleDisplay label="Pitch" value={pitch} color="text-cyan-400" />
      </div>
    </div>
  );
}

function AngleDisplay({ label, value, color }) {
  return (
    <div className="bg-surface-700 rounded-lg px-3 py-2 border border-white/5 text-center">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`font-mono font-bold text-lg ${color}`}>
        {value.toFixed(1)}°
      </div>
    </div>
  );
}
