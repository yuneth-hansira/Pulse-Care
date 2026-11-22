import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

export default function ECGChart({ data, status }) {
    const chartData = {
        labels: Array(data.length || 1000).fill(''),
        datasets: [
            {
                label: 'ECG Waveform',
                data: data,
                borderColor: '#ef4444', // Tailwind red-500
                borderWidth: 1.5,
                pointRadius: 0, // Continuous smooth line
                tension: 0.1
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Disabled for 250Hz performance
        scales: {
            x: {
                display: false
            },
            y: {
                min: -1000,
                max: 1000,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)' // Faint white grid lines for dark mode
                },
                ticks: {
                    color: '#9ca3af' // Light gray axis numbers
                }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
        }
    };

    return (
        // Replaced bg-white with glass-card to match the dashboard theme
        <div className="glass-card rounded-xl p-5 border border-white/5 bg-[#1e2330]">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-gray-300">Live ECG</h2>

                <div className="flex space-x-4 items-center">
                    {/* Dark mode styled status badges */}
                    <span className={`px-3 py-1 rounded text-xs font-bold tracking-wider border ${status.leadsOff
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}>
                        {status.leadsOff ? 'LEADS OFF' : 'LEADS CONNECTED'}
                    </span>

                    <span className="text-xl font-bold text-red-500 font-mono">
                        {status.bpm} BPM
                    </span>
                </div>
            </div>

            <div className="h-64 w-full relative">
                <Line data={chartData} options={options} />
            </div>
        </div>
    );
}