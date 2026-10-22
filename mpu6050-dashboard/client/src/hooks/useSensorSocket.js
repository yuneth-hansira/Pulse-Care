/**
 * useSensorSocket.js
 * ──────────────────
 * Custom React hook that:
 *  1. Connects to the Node.js Socket.IO server.
 *  2. Maintains a rolling data buffer (configurable size).
 *  3. Accepts server history on first connect so charts fill immediately.
 *  4. Throttles state updates to ≤10 Hz so Recharts stays smooth.
 *  5. Supports pause/resume — data keeps buffering when paused.
 *  6. Exposes a stable API to the rest of the app.
 *
 * Exposed values:
 *   data             Array<sample>   — visible window (windowSize points)
 *   latest           object|null     — most recent sample
 *   connected        boolean         — WebSocket connected
 *   serialConnected  boolean         — physical sensor connected
 *   mock             boolean         — server is in mock mode
 *   samplesPerSecond number          — measured throughput
 *   paused           boolean
 *   togglePause      () => void
 *   clearData        () => void
 *   windowSize       number
 *   setWindowSize    (n: number) => void
 */


import { useEffect, useRef, useState, useCallback } from 'react';
import mqtt from 'mqtt';

const MQTT_URL = 'ws://10.30.7.32:9001';
const MQTT_TOPIC = 'pulse/mpu6050';

const THROTTLE_MS = 100;
const RATE_WINDOW_MS = 5000;

export function useSensorSocket({ defaultWindowSize = 200 } = {}) {
  const bufferRef = useRef([]);
  const pausedRef = useRef(false);
  const lastFlushRef = useRef(0);
  const timestampsRef = useRef([]);
  const windowSizeRef = useRef(defaultWindowSize);

  const [connected, setConnected] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const [mock, setMock] = useState(false);
  const [paused, setPaused] = useState(false);
  const [windowSize, setWindowSize] = useState(defaultWindowSize);
  const [data, setData] = useState([]);
  const [latest, setLatest] = useState(null);
  const [samplesPerSecond, setSamplesPerSecond] = useState(0);

  useEffect(() => {
    windowSizeRef.current = windowSize;
  }, [windowSize]);

  const flush = useCallback(() => {
    const now = Date.now();

    if (now - lastFlushRef.current < THROTTLE_MS) {
      return;
    }

    lastFlushRef.current = now;

    const buffer = bufferRef.current;

    if (buffer.length > 0) {
      setData(buffer.slice(-windowSizeRef.current));
      setLatest(buffer[buffer.length - 1]);
    }

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
      console.log('[MQTT] Connected to Mosquitto');

      setConnected(true);

      client.subscribe(MQTT_TOPIC, error => {
        if (error) {
          console.error('[MQTT] Subscription failed:', error);
          return;
        }

        console.log('[MQTT] Subscribed to:', MQTT_TOPIC);
      });
    });

    client.on('reconnect', () => {
      console.log('[MQTT] Reconnecting...');
    });

    client.on('offline', () => {
      console.warn('[MQTT] Client offline');
      setConnected(false);
      setSerialConnected(false);
    });

    client.on('error', error => {
      console.error('[MQTT] Connection error:', error.message);
    });

    client.on('close', () => {
      setConnected(false);
      setSerialConnected(false);
    });

    client.on('message', (topic, message) => {
      if (topic !== MQTT_TOPIC) {
        return;
      }

      try {
        const parsed = JSON.parse(message.toString());

        const requiredFields = [
          'ax', 'ay', 'az',
          'gx', 'gy', 'gz',
          'temp',
        ];

        const valid = requiredFields.every(
          field =>
            Object.prototype.hasOwnProperty.call(parsed, field) &&
            Number.isFinite(Number(parsed[field]))
        );

        if (!valid) {
          console.warn('[MQTT] Invalid sensor payload:', parsed);
          return;
        }

        const sample = {
          ax: Number(parsed.ax),
          ay: Number(parsed.ay),
          az: Number(parsed.az),
          gx: Number(parsed.gx),
          gy: Number(parsed.gy),
          gz: Number(parsed.gz),
          temp: Number(parsed.temp),
          ts: Date.now(),
        };

        console.log('[MQTT] Sensor data:', sample);

        if (!pausedRef.current) {
          bufferRef.current.push(sample);

          if (bufferRef.current.length > 2000) {
            bufferRef.current.shift();
          }
        }

        timestampsRef.current.push(Date.now());
        setLatest(sample);

        // The MQTT connection can be healthy even if no sensor data arrives.
        setSerialConnected(true);

        flush();
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
    timestampsRef.current = [];

    setData([]);
    setLatest(null);
    setSamplesPerSecond(0);
  }, []);

  const handleSetWindowSize = useCallback(size => {
    const safeSize = Math.max(1, Math.min(2000, Number(size) || 200));

    windowSizeRef.current = safeSize;
    setWindowSize(safeSize);
    setData(bufferRef.current.slice(-safeSize));
  }, []);

  return {
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
    setWindowSize: handleSetWindowSize,
  };
}


