/**
 * useSensorSocket.js
 * ──────────────────
 * Custom React hook that:
 *  1. Connects directly to the Mosquitto MQTT broker via WebSockets.
 *  2. Maintains a rolling data buffer for MPU6050 (configurable size).
 *  3. Maintains a fixed 1000-point rolling buffer for the ECG waveform.
 *  4. Throttles state updates to ≤10 Hz so Recharts/Chart.js stays smooth.
 *  5. Supports pause/resume — data keeps buffering when paused.
 *  6. Exposes a stable API to the rest of the app.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import mqtt from 'mqtt';

const MQTT_URL = 'ws://10.30.7.32:9001';
const TOPIC_MPU = 'pulse/mpu6050';
const TOPIC_ECG = 'pulse/ecg';
const TOPIC_ECG_STATUS = 'pulse/ecg_status';
const TOPIC_MAX = 'pulse/max30102';

const THROTTLE_MS = 100;
const RATE_WINDOW_MS = 5000;
const ECG_WINDOW_SIZE = 1000; // 4 seconds at 250 Hz

export function useSensorSocket({ defaultWindowSize = 200 } = {}) {
  // MPU Refs
  const bufferRef = useRef([]);
  // ECG Refs (pre-fill with zeros to prevent empty chart crashes)
  const ecgBufferRef = useRef(Array(ECG_WINDOW_SIZE).fill(0));

  const pausedRef = useRef(false);
  const lastFlushRef = useRef(0);
  const timestampsRef = useRef([]);
  const windowSizeRef = useRef(defaultWindowSize);

  // Connection State
  const [connected, setConnected] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const [mock, setMock] = useState(false);
  const [paused, setPaused] = useState(false);
  const [windowSize, setWindowSize] = useState(defaultWindowSize);
  const [samplesPerSecond, setSamplesPerSecond] = useState(0);

  // MAX30102 State
  const [maxData, setMaxData] = useState({ online: false, finger: false, hr: null, spo2: null, ir: 0, ts: 0 });

  // MPU Data State
  const [data, setData] = useState([]);
  const [latest, setLatest] = useState(null);

  // ECG Data State
  const [ecgData, setEcgData] = useState(Array(ECG_WINDOW_SIZE).fill(0));
  const [ecgStatus, setEcgStatus] = useState({ bpm: '--', leadsOff: true, ts: 0 });

  useEffect(() => {
    windowSizeRef.current = windowSize;
  }, [windowSize]);

  // Flush buffers to React state at a controlled frame rate (10 Hz)
  const flush = useCallback(() => {
    const now = Date.now();
    if (now - lastFlushRef.current < THROTTLE_MS) {
      return;
    }
    lastFlushRef.current = now;

    // Flush MPU6050 Data
    const mpuBuffer = bufferRef.current;
    if (mpuBuffer.length > 0) {
      setData(mpuBuffer.slice(-windowSizeRef.current));
      setLatest(mpuBuffer[mpuBuffer.length - 1]);
    }

    // Flush ECG Data
    setEcgData([...ecgBufferRef.current]);

    // Calculate throughput
    const cutoff = now - RATE_WINDOW_MS;
    const recentTimestamps = timestampsRef.current.filter(
      timestamp => timestamp > cutoff
    );
    timestampsRef.current = recentTimestamps;
    setSamplesPerSecond(
      Number((recentTimestamps.length / (RATE_WINDOW_MS / 1000)).toFixed(1))
    );
  }, []);

  useEffect(() => {
    const timer = setInterval(flush, THROTTLE_MS);
    return () => clearInterval(timer);
  }, [flush]);

  useEffect(() => {
    console.log('[MQTT] Connecting to:', MQTT_URL);

    const client = mqtt.connect(MQTT_URL, {
      clientId: `pulse_care_web_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 3000,
    });

    client.on('connect', () => {
      console.log('[MQTT] Connected to Mosquitto via WebSockets');
      setConnected(true);

      // Subscribe to all hardware topics
      const topics = [TOPIC_MPU, TOPIC_ECG, TOPIC_ECG_STATUS, TOPIC_MAX];
      client.subscribe(topics, error => {
        if (error) {
          console.error('[MQTT] Subscription failed:', error);
          return;
        }
        console.log('[MQTT] Subscribed to topics:', topics.join(', '));
      });
    });

    client.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
    client.on('offline', () => {
      console.warn('[MQTT] Client offline');
      setConnected(false);
      setSerialConnected(false);
    });
    client.on('error', error => console.error('[MQTT] Connection error:', error.message));
    client.on('close', () => {
      setConnected(false);
      setSerialConnected(false);
    });

    client.on('message', (topic, message) => {
      try {
        const parsed = JSON.parse(message.toString());

        // ==============================
        // MPU6050 HANDLING
        // ==============================
        if (topic === TOPIC_MPU) {
          const requiredFields = ['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'temp', 'ts'];
          const valid = requiredFields.every(
            field => Object.prototype.hasOwnProperty.call(parsed, field) && Number.isFinite(Number(parsed[field]))
          );

          if (!valid) return;

          // Correctly formatted object with hardware timestamp
          const sample = {
            ax: Number(parsed.ax), ay: Number(parsed.ay), az: Number(parsed.az),
            gx: Number(parsed.gx), gy: Number(parsed.gy), gz: Number(parsed.gz),
            temp: Number(parsed.temp),
            ts: Number(parsed.ts), // <-- Now pulling the hardware time
          };

          if (!pausedRef.current) {
            bufferRef.current.push(sample);
            if (bufferRef.current.length > 2000) bufferRef.current.shift();
          }

          timestampsRef.current.push(Date.now()); // Keep Date.now() here for the frontend throughput calculation
          setLatest(sample);
          setSerialConnected(true);
        }

        // ==============================
        // ECG HANDLING (Waveform Batch)
        // ==============================
        else if (topic === TOPIC_ECG) {
          if (parsed.s && Array.isArray(parsed.s)) {
            if (!pausedRef.current) {
              ecgBufferRef.current = ecgBufferRef.current.concat(parsed.s);
              if (ecgBufferRef.current.length > ECG_WINDOW_SIZE) {
                ecgBufferRef.current = ecgBufferRef.current.slice(-ECG_WINDOW_SIZE);
              }
            }
          }

          if (parsed.bpm !== undefined) {
            setEcgStatus(prev => ({
              ...prev,
              bpm: parsed.bpm,
              leadsOff: parsed.off === 'true' || parsed.off === true,
              ts: parsed.ts ? Number(parsed.ts) : prev.ts
            }));
          }
          setSerialConnected(true);
        }

        // ==============================
        // ECG HANDLING (Status 1Hz)
        // ==============================
        else if (topic === TOPIC_ECG_STATUS) {
          setEcgStatus(prev => ({
            ...prev,
            bpm: parsed.bpm || '--',
            leadsOff: parsed.leadsOff === true || parsed.leadsOff === 'true'
          }));
          setSerialConnected(true);
        }

        // ==============================
        // MAX30102 HANDLING
        // ==============================
        else if (topic === TOPIC_MAX) {
          setMaxData({
            online: parsed.online === true || parsed.online === 'true',
            finger: parsed.finger === true || parsed.finger === 'true',
            hr: parsed.hr !== 'null' ? Number(parsed.hr) : null,
            spo2: parsed.spo2 !== 'null' ? Number(parsed.spo2) : null,
            ir: Number(parsed.ir) || 0,
            ts: parsed.ts ? Number(parsed.ts) : 0
          });
          setSerialConnected(true);
        }

      } catch (error) {
        console.error('[MQTT] Could not parse message:', error);
      }
    });

    return () => {
      client.end(true);
    };
  }, [flush]);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(value => !value);
  }, []);

  const clearData = useCallback(() => {
    bufferRef.current = [];
    ecgBufferRef.current = Array(ECG_WINDOW_SIZE).fill(0);
    timestampsRef.current = [];

    setData([]);
    setLatest(null);
    setEcgData(Array(ECG_WINDOW_SIZE).fill(0));
    setEcgStatus({ bpm: '--', leadsOff: true, ts: 0 });
    setMaxData({ online: false, finger: false, hr: null, spo2: null, ir: 0, ts: 0 });
    setSamplesPerSecond(0);
  }, []);

  const handleSetWindowSize = useCallback(size => {
    const safeSize = Math.max(1, Math.min(2000, Number(size) || 200));
    windowSizeRef.current = safeSize;
    setWindowSize(safeSize);
    setData(bufferRef.current.slice(-safeSize));
  }, []);

  return {
    data, latest, ecgData, ecgStatus, maxData,
    connected, serialConnected, mock, samplesPerSecond,
    paused, togglePause, clearData, windowSize, setWindowSize,
  };
}