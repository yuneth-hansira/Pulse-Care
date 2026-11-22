import React from 'react';

export default function SpO2Card({ maxData }) {
    const { online, finger, hr, spo2 } = maxData;

    let statusColor = 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    let statusText = 'WAITING FOR DATA';

    if (!online) {
        statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';
        statusText = 'SENSOR OFFLINE (I2C ERROR)';
    } else if (!finger) {
        statusColor = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
        statusText = 'NO FINGER DETECTED';
    } else {
        statusColor = 'bg-green-500/10 text-green-400 border-green-500/20';
        statusText = 'READING STABLE';
    }

    return (
        <div className="glass-card rounded-xl p-5 border border-white/5 bg-[#1e2330] flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
                <h2 className="text-sm font-semibold text-gray-300">Pulse Oximeter (MAX30102)</h2>
                <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider border ${statusColor}`}>
                    {statusText}
                </span>
            </div>

            <div className="flex items-end space-x-6 mt-4">
                <div>
                    <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Blood Oxygen</p>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-4xl font-bold text-cyan-400 font-mono">
                            {spo2 ? spo2 : '--'}
                        </span>
                        <span className="text-lg text-cyan-600 font-bold">%</span>
                    </div>
                </div>

                <div>
                    <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Optical HR</p>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-bold text-pink-400 font-mono">
                            {hr ? hr : '--'}
                        </span>
                        <span className="text-sm text-pink-600 font-bold">BPM</span>
                    </div>
                </div>
            </div>
        </div>
    );
}