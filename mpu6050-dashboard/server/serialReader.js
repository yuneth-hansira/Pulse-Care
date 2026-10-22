/**
 * serialReader.js
 * ---------------
 * Opens the configured COM port, attaches a readline parser, and emits
 * parsed sensor samples via the provided callback.
 *
 * Resilience strategy:
 *  - If the port cannot be opened, logs the error and retries after RETRY_MS.
 *  - If the port disconnects unexpectedly, closes cleanly and retries.
 *  - Malformed / non-JSON lines are silently dropped — the process never crashes
 *    due to bad serial data.
 */

const { SerialPort }         = require('serialport');
const { ReadlineParser }     = require('@serialport/parser-readline');

const RETRY_MS = 3000; // milliseconds between reconnection attempts

// Required field names every valid sample must have
const REQUIRED_FIELDS = ['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'temp'];

/**
 * Validates that a parsed object contains all required numeric fields.
 * @param {object} obj
 * @returns {boolean}
 */
function isValidSample(obj) {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    REQUIRED_FIELDS.every(f => typeof obj[f] === 'number')
  );
}

/**
 * Starts the serial reader.
 *
 * @param {object}   options
 * @param {string}   options.port        - Serial port path (e.g. 'COM14')
 * @param {number}   options.baudRate    - Baud rate (e.g. 115200)
 * @param {function} options.onSample    - Called with a valid sample object
 * @param {function} options.onStatus    - Called with { serialConnected, port, mock }
 * @returns {{ stop: function }}          - Call stop() to shut down
 */
function startSerialReader({ port, baudRate, onSample, onStatus }) {
  let serialPort = null;
  let retryTimer = null;
  let stopped    = false;

  function reportStatus(connected) {
    onStatus({ serialConnected: connected, port, mock: false });
  }

  function cleanup() {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (serialPort) {
      try { serialPort.close(); } catch (_) { /* ignore */ }
      serialPort = null;
    }
  }

  function connect() {
    if (stopped) return;

    console.log(`[Serial] Attempting to open ${port} @ ${baudRate} baud…`);

    const sp = new SerialPort({ path: port, baudRate, autoOpen: false });
    serialPort = sp;

    const parser = sp.pipe(new ReadlineParser({ delimiter: '\n' }));

    // ── Line handler ──────────────────────────────────────────────────────────
    parser.on('data', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let obj;
      try {
        obj = JSON.parse(trimmed);
      } catch (_) {
        // Not valid JSON — silently ignore
        return;
      }

      if (!isValidSample(obj)) return; // Missing fields — silently ignore

      onSample({ ...obj, ts: Date.now() });
    });

    // ── Open port ─────────────────────────────────────────────────────────────
    sp.open((err) => {
      if (err) {
        console.error(`[Serial] Cannot open ${port}: ${err.message}`);
        reportStatus(false);
        cleanup();
        if (!stopped) {
          console.log(`[Serial] Retrying in ${RETRY_MS / 1000}s…`);
          retryTimer = setTimeout(connect, RETRY_MS);
        }
        return;
      }

      console.log(`[Serial] ✓ Connected to ${port}`);
      reportStatus(true);
    });

    // ── Disconnect handler ────────────────────────────────────────────────────
    sp.on('close', () => {
      if (stopped) return;
      console.warn(`[Serial] Port ${port} closed unexpectedly.`);
      reportStatus(false);
      cleanup();
      console.log(`[Serial] Retrying in ${RETRY_MS / 1000}s…`);
      retryTimer = setTimeout(connect, RETRY_MS);
    });

    sp.on('error', (err) => {
      console.error(`[Serial] Error on ${port}: ${err.message}`);
      // close event will fire next and trigger the retry
    });
  }

  connect();

  return {
    stop() {
      stopped = true;
      cleanup();
    },
  };
}

/**
 * Lists all available serial ports.
 * @returns {Promise<Array<{ path, manufacturer, serialNumber, pnpId }>>}
 */
async function listPorts() {
  const ports = await SerialPort.list();
  return ports.map(({ path, manufacturer, serialNumber, pnpId }) => ({
    path,
    manufacturer: manufacturer || null,
    serialNumber: serialNumber || null,
    pnpId: pnpId || null,
  }));
}

module.exports = { startSerialReader, listPorts };
