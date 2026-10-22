/**
 * index.js  –  MPU6050 Dashboard Server
 * ───────────────────────────────────────────────────────────────────────────
 * Express + Socket.IO server that bridges a USB serial port (MPU6050 via
 * ESP32) to browser clients in real time.
 *
 * Data flow:
 *   ESP32 (USB) → serialReader.js → in-memory ring buffer
 *                                  → Socket.IO broadcast  ("sensor:data")
 *                                  → REST /api/latest | /api/history
 *
 * Fall-back:
 *   If the serial port cannot be opened (or MOCK=true in .env), mockData.js
 *   is used to generate realistic fake readings at 10 Hz.
 */

require('dotenv').config();

const express       = require('express');
const http          = require('http');
const { Server }    = require('socket.io');
const cors          = require('cors');

const { startSerialReader, listPorts } = require('./serialReader');
const { generateMockSample }           = require('./mockData');

// ── Configuration ─────────────────────────────────────────────────────────────
const SERIAL_PORT  = process.env.SERIAL_PORT  || 'COM14';
const BAUD_RATE    = parseInt(process.env.BAUD_RATE || '115200', 10);
const HTTP_PORT    = parseInt(process.env.PORT      || '4000',   10);
const FORCE_MOCK   = process.env.MOCK === 'true';

const HISTORY_SIZE = 500;   // samples kept in memory
const MOCK_HZ      = 10;    // mock data frequency

// ── App setup ─────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// ── State ─────────────────────────────────────────────────────────────────────
/** @type {Array<object>} Rolling ring-buffer of the last HISTORY_SIZE samples */
const history = [];

/** Current connection status object broadcast to clients */
let statusState = { serialConnected: false, port: SERIAL_PORT, mock: FORCE_MOCK };

/** Whether we are currently in mock mode (could be set at runtime after a port failure) */
let mockActive  = FORCE_MOCK;

/** Reference to the mock setInterval timer */
let mockTimer   = null;

/** Reference returned by startSerialReader — lets us stop it later */
let serialHandle = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Pushes a sample into the history ring-buffer and broadcasts it.
 * @param {object} sample
 */
function ingestSample(sample) {
  history.push(sample);
  if (history.length > HISTORY_SIZE) history.shift();
  io.emit('sensor:data', sample);
}

/**
 * Updates and broadcasts the connection status.
 * @param {Partial<typeof statusState>} patch
 */
function setStatus(patch) {
  statusState = { ...statusState, ...patch };
  io.emit('sensor:status', statusState);
  console.log('[Status]', statusState);
}

// ── Mock mode ─────────────────────────────────────────────────────────────────
function startMock() {
  if (mockTimer) return; // already running
  mockActive = true;
  console.log('[Mock] Starting fake data generator at', MOCK_HZ, 'Hz');
  setStatus({ serialConnected: false, mock: true });

  mockTimer = setInterval(() => {
    ingestSample(generateMockSample());
  }, 1000 / MOCK_HZ);
}

function stopMock() {
  if (mockTimer) { clearInterval(mockTimer); mockTimer = null; }
  mockActive = false;
}

// ── Serial mode ───────────────────────────────────────────────────────────────
function startSerial() {
  serialHandle = startSerialReader({
    port: SERIAL_PORT,
    baudRate: BAUD_RATE,
    onSample: (sample) => {
      // If we were in mock fallback, stop it now that serial is working
      if (mockActive && !FORCE_MOCK) stopMock();
      ingestSample(sample);
    },
    onStatus: ({ serialConnected }) => {
      if (!serialConnected && !FORCE_MOCK) {
        // Serial failed or disconnected → activate mock fallback
        console.log('[Server] Serial unavailable — switching to mock mode');
        startMock();
      } else if (serialConnected) {
        stopMock();
        setStatus({ serialConnected: true, mock: false });
      } else {
        setStatus({ serialConnected: false, mock: false });
      }
    },
  });
}

// ── Socket.IO connections ─────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Send current status immediately
  socket.emit('sensor:status', statusState);

  // Send buffered history so the charts fill on connect
  if (history.length > 0) {
    socket.emit('sensor:history', history);
  }

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ── REST API ──────────────────────────────────────────────────────────────────
/**
 * GET /api/health
 * Returns server liveness and current status.
 */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    historyLength: history.length,
    status: statusState,
  });
});

/**
 * GET /api/latest
 * Returns the most recently received sample.
 */
app.get('/api/latest', (_req, res) => {
  if (history.length === 0) return res.status(204).end();
  res.json(history[history.length - 1]);
});

/**
 * GET /api/history?limit=200
 * Returns the last N samples (default 200, max 500).
 */
app.get('/api/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '200', 10), HISTORY_SIZE);
  res.json(history.slice(-limit));
});

/**
 * GET /api/ports
 * Lists all available serial ports on the host machine.
 */
app.get('/api/ports', async (_req, res) => {
  try {
    const ports = await listPorts();
    res.json(ports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
server.listen(HTTP_PORT, () => {
  console.log(`\n🚀 MPU6050 Dashboard Server running at http://localhost:${HTTP_PORT}`);
  console.log(`   Serial port : ${SERIAL_PORT} @ ${BAUD_RATE} baud`);
  console.log(`   Mock mode   : ${FORCE_MOCK ? 'FORCED ON' : 'auto-fallback'}\n`);

  if (FORCE_MOCK) {
    startMock();
  } else {
    startSerial();
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down…');
  stopMock();
  if (serialHandle) serialHandle.stop();
  server.close(() => process.exit(0));
});
