# MPU6050 Live Dashboard

Real-time accelerometer / gyroscope / temperature dashboard for an **MPU6050** sensor read by an **ESP32 DevKit V1** over USB serial.

```
MPU6050 ──I2C──▶ ESP32 ──USB Serial──▶ Node.js server ──WebSocket──▶ React dashboard
                         (JSON lines)    (serialport +                 (Recharts /
                                          Socket.IO)                   Tailwind CSS)
```

---

## Project Structure

```
mpu6050-dashboard/
├── package.json          ← root: concurrently scripts
├── README.md
├── server/
│   ├── package.json
│   ├── .env              ← SERIAL_PORT, BAUD_RATE, PORT, MOCK
│   ├── index.js          ← Express + Socket.IO server
│   ├── serialReader.js   ← serial port bridge with auto-retry
│   └── mockData.js       ← realistic fake data generator
└── client/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── index.css
        ├── App.jsx
        ├── hooks/
        │   └── useSensorSocket.js   ← Socket.IO + rolling buffer hook
        └── components/
            ├── StatusBar.jsx        ← header, indicators, stale-data banner
            ├── StatCards.jsx        ← 7 current-value cards
            ├── LiveChart.jsx        ← reusable Recharts line chart
            ├── TiltIndicator.jsx    ← CSS 3-D tilt box
            └── Controls.jsx         ← pause, clear, window, CSV
```

---

## Quick Start

### 1 · Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18 LTS or later |
| npm | 9+ |
| Git (optional) | any |

### 2 · Install all dependencies

```bash
# From the project root (mpu6050-dashboard/)
npm run install:all
```

This runs `npm install` in the root, `/server`, and `/client` in one shot.

### 3 · Configure the serial port

Open **`server/.env`** and set the correct COM port:

```dotenv
SERIAL_PORT=COM14      # Windows example
# SERIAL_PORT=/dev/ttyUSB0   # Linux
# SERIAL_PORT=/dev/tty.usbserial-0001  # macOS

BAUD_RATE=115200
PORT=4000
MOCK=false
```

### 4 · Run in development (mock mode — no hardware needed)

```bash
# Option A: keep MOCK=false and the server auto-falls back to mock
npm run dev

# Option B: force mock mode explicitly
# Edit server/.env → MOCK=true
npm run dev
```

Both server (`:4000`) and client (`:5173`) start together.  
Open **http://localhost:5173** in your browser.

### 5 · Run with the real sensor

1. Plug in the ESP32 via USB.
2. Make sure the **Arduino Serial Monitor is closed** (only one app can own a COM port).
3. Set `MOCK=false` in `server/.env`.
4. Run:

```bash
npm run dev
```

---

## How to Find the COM Port

**Windows**

```
Device Manager → Ports (COM & LPT) → look for "Silicon Labs CP210x" or "CH340"
```
Or list ports through the dashboard REST API once the server is running:

```
GET http://localhost:4000/api/ports
```

**macOS / Linux**

```bash
ls /dev/tty.usb*     # macOS
ls /dev/ttyUSB*      # Linux
```

---

## Switching Between Mock and Real Mode

| Scenario | `server/.env` | Result |
|----------|--------------|--------|
| No hardware, forced mock | `MOCK=true` | Fake data immediately |
| No hardware, auto-fallback | `MOCK=false` (default) | Real mode attempted; falls back to mock after 3 s if port unavailable |
| Real hardware | `MOCK=false` + correct `SERIAL_PORT` | Live sensor data |

The dashboard header shows a **MOCK DATA** badge (yellow) whenever the server is generating fake data.

---

## Expected JSON Format

The server expects **one JSON object per line** at `BAUD_RATE` baud:

```json
{"ax":-0.103,"ay":-0.551,"az":-0.743,"gx":-11.25,"gy":0.64,"gz":0.46,"temp":30.9}
```

| Field | Unit | Description |
|-------|------|-------------|
| `ax` `ay` `az` | g | Linear acceleration (gravity-included) |
| `gx` `gy` `gz` | °/s | Angular velocity |
| `temp` | °C | MPU6050 on-chip die temperature |

> Lines that are not valid JSON or are missing any of these fields are **silently ignored** — the server never crashes on bad input.

### Arduino sketch change (required for real mode)

In your ESP32 sketch, replace the Serial output section inside `loop()` with:

```cpp
// Good reading
failCount = 0;
Serial.printf(
  "{\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,\"gx\":%.2f,\"gy\":%.2f,\"gz\":%.2f,\"temp\":%.2f}\n",
  ax / 16384.0, ay / 16384.0, az / 16384.0,
  gx / 131.0,  gy / 131.0,  gz / 131.0,
  tmp / 340.0 + 36.53
);
delay(100);  // 10 Hz
```

- Set `READ_INTERVAL_MS = 100` (10 readings per second).  
- Remove or comment out any other `Serial.print` debug lines — the server ignores them, but they slow the stream.

---

## REST API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server liveness, uptime, buffer size, current status |
| `GET /api/latest` | Most recent sensor sample (HTTP 204 if none yet) |
| `GET /api/history?limit=200` | Last N samples (max 500) |
| `GET /api/ports` | All available serial ports on the host |

---

## Socket.IO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `sensor:data` | server → client | Single sample `{ax,ay,az,gx,gy,gz,temp,ts}` |
| `sensor:history` | server → client (on connect) | Array of last 500 samples |
| `sensor:status` | server → client | `{serialConnected, port, mock}` |

---

## npm Scripts

| Script | What it does |
|--------|-------------|
| `npm run install:all` | Install all workspace dependencies |
| `npm run dev` | Start server + client in parallel (development) |
| `npm run start` | Start server (production) + client dev server |
| `npm run dev --prefix server` | Server only |
| `npm run dev --prefix client` | Client only |

---

## Troubleshooting

### ❌ "Error: Access denied, cannot open /dev/ttyUSB0" or "Access denied opening COM14"

**COM port is busy.** Close the **Arduino Serial Monitor** (or any other terminal program using the port), then restart the server.

### ❌ Dashboard shows "MOCK DATA" but MOCK=false

The server could not open the serial port and switched to mock fallback automatically.  
Check:
1. The ESP32 is plugged in.
2. `SERIAL_PORT` in `server/.env` matches Device Manager exactly.
3. No other program has the port open.

### ❌ Charts update but values look wrong

Make sure your Arduino sketch outputs the exact JSON format shown above.  
Open the server terminal — it logs every line it receives.  
Remove debug `Serial.print` statements from the sketch.

### ❌ "Cannot find module 'serialport'"

Run `npm run install:all` from the project root, not from inside `/server`.

### ❌ Vite proxy error (ECONNREFUSED :4000)

The Node server must be running before you open the browser.  
Use `npm run dev` from the root — it starts both in parallel.

### ❌ Port 4000 or 5173 already in use

Change `PORT=4001` in `server/.env` and update the proxy target in `client/vite.config.js` to match.

---

## Sensor & Formulas

```
Roll  = atan2(ay, az)               × (180/π)   degrees
Pitch = atan2(-ax, √(ay²+az²))     × (180/π)   degrees
```

These are **accelerometer-only** angles (no gyro fusion).  
They are accurate when the sensor is stationary; add complementary/Kalman filtering for dynamic motion.

---

## License

MIT — use freely.
