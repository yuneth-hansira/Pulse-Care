/**
 * StatCards.jsx
 * ─────────────
 * Row of numeric stat cards showing the current sensor values.
 * Each card has a colored accent, label, value, and unit.
 */

import { useMemo } from 'react';

/** Card descriptor: id, label, unit, color classes, value extractor */
const CARD_DEFS = [
  { id: 'ax',   label: 'Accel X',  unit: 'g',     color: 'blue',   key: 'ax' },
  { id: 'ay',   label: 'Accel Y',  unit: 'g',     color: 'indigo', key: 'ay' },
  { id: 'az',   label: 'Accel Z',  unit: 'g',     color: 'cyan',   key: 'az' },
  { id: 'gx',   label: 'Gyro X',   unit: '°/s',   color: 'purple', key: 'gx' },
  { id: 'gy',   label: 'Gyro Y',   unit: '°/s',   color: 'violet', key: 'gy' },
  { id: 'gz',   label: 'Gyro Z',   unit: '°/s',   color: 'fuchsia',key: 'gz' },
  { id: 'temp', label: 'Temp',     unit: '°C',    color: 'amber',  key: 'temp' },
];

/** Map color name → Tailwind classes (avoids dynamic class generation issues) */
const COLOR_MAP = {
  blue:    { border: 'border-blue-500/30',    text: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  indigo:  { border: 'border-indigo-500/30',  text: 'text-indigo-400',  bg: 'bg-indigo-500/10'  },
  cyan:    { border: 'border-cyan-500/30',    text: 'text-cyan-400',    bg: 'bg-cyan-500/10'    },
  purple:  { border: 'border-purple-500/30',  text: 'text-purple-400',  bg: 'bg-purple-500/10'  },
  violet:  { border: 'border-violet-500/30',  text: 'text-violet-400',  bg: 'bg-violet-500/10'  },
  fuchsia: { border: 'border-fuchsia-500/30', text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  amber:   { border: 'border-amber-500/30',   text: 'text-amber-400',   bg: 'bg-amber-500/10'   },
};

/**
 * @param {object}      props
 * @param {object|null} props.latest  – most recent sensor sample
 */
export default function StatCards({ latest }) {
  const cards = useMemo(() => CARD_DEFS, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
      {cards.map(({ id, label, unit, color, key }) => {
        const c   = COLOR_MAP[color];
        const val = latest?.[key];
        const display = val !== undefined
          ? (typeof val === 'number' ? val.toFixed(3) : val)
          : '—';

        return (
          <div
            key={id}
            id={`stat-card-${id}`}
            className={`glass-card rounded-xl p-4 border ${c.border} flex flex-col gap-1
                        hover:border-opacity-60 transition-all duration-200`}
          >
            {/* Colored dot accent */}
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-semibold tracking-wide uppercase ${c.text}`}>
                {label}
              </span>
              <span className={`w-2 h-2 rounded-full ${c.bg} ${c.text} border ${c.border}`} />
            </div>

            {/* Value */}
            <span className={`font-mono text-xl font-bold text-white transition-all`}>
              {display}
            </span>

            {/* Unit */}
            <span className="text-xs text-gray-500">{unit}</span>
          </div>
        );
      })}
    </div>
  );
}
