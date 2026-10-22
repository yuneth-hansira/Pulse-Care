/**
 * mockData.js
 * -----------
 * Generates realistic fake MPU6050 sensor readings at 10 Hz.
 *
 * Accelerometer: gravitational vector near (0, 0, 1) g, rotated slowly through
 *   a sine wave so roll/pitch indicators move on screen, plus small Gaussian noise.
 * Gyroscope:     mostly near zero with occasional brief spikes.
 * Temperature:   drifts around 30 °C with tiny noise.
 */

let t = 0; // Time counter (incremented each tick)

/**
 * Returns a single Gaussian-distributed random number (Box-Muller transform).
 * @param {number} mean
 * @param {number} std  standard deviation
 */
function randn(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Creates one mock sensor sample with a server timestamp.
 * @returns {{ ax, ay, az, gx, gy, gz, temp, ts }}
 */
function generateMockSample() {
  t += 1;

  // Slow sine/cosine roll gives visually interesting 3-D motion
  const rollRad  = 0.3 * Math.sin(t * 0.02);   // ± ~17 °
  const pitchRad = 0.2 * Math.sin(t * 0.013);  // ± ~11 °

  // Gravity vector projected through roll then pitch
  const ax = parseFloat((-Math.sin(pitchRad)                         + randn(0, 0.008)).toFixed(4));
  const ay = parseFloat(( Math.sin(rollRad) * Math.cos(pitchRad)     + randn(0, 0.008)).toFixed(4));
  const az = parseFloat(( Math.cos(rollRad) * Math.cos(pitchRad)     + randn(0, 0.008)).toFixed(4));

  // Gyro: occasional spike (1 % chance per axis) otherwise low noise
  const spike = () => Math.random() < 0.01 ? randn(0, 40) : 0;
  const gx = parseFloat((randn(0, 0.5) + spike()).toFixed(2));
  const gy = parseFloat((randn(0, 0.5) + spike()).toFixed(2));
  const gz = parseFloat((randn(0, 0.5) + spike()).toFixed(2));

  // Temperature drifts around 30 °C
  const temp = parseFloat((30 + 0.5 * Math.sin(t * 0.005) + randn(0, 0.05)).toFixed(2));

  return { ax, ay, az, gx, gy, gz, temp, ts: Date.now() };
}

module.exports = { generateMockSample };
