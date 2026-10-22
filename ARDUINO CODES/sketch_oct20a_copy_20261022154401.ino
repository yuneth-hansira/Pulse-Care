```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>

// =====================================================
// WIFI CONFIGURATION
// =====================================================
const char* WIFI_SSID = "Ncavos";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// =====================================================
// MQTT CONFIGURATION
// =====================================================
const char* MQTT_SERVER = "192.168.129.161";
const int MQTT_PORT = 1883;

const char* MQTT_TOPIC = "pulse/mpu6050";
const char* MQTT_CLIENT_ID = "PulseCare-ESP32";

// =====================================================
// MPU6050 CONFIGURATION
// =====================================================
const int MPU_ADDR = 0x68;

const int SDA_PIN = 22;
const int SCL_PIN = 21;

const unsigned long READ_INTERVAL_MS = 2000;

int failCount = 0;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastReadTime = 0;

// =====================================================
// I2C ERROR DESCRIPTION
// =====================================================
const char* ackText(byte err) {
  switch (err) {
    case 0: return "ACK OK";
    case 1: return "FAIL: data too long";
    case 2: return "NACK on ADDRESS";
    case 3: return "NACK on DATA";
    case 4: return "FAIL: other I2C error";
    case 5: return "FAIL: timeout";
    default: return "unknown error";
  }
}

// =====================================================
// WRITE MPU6050 REGISTER
// =====================================================
bool writeReg(byte reg, byte val, const char* name) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);

  byte err = Wire.endTransmission(true);

  Serial.printf(
    "[WRITE %-12s reg=0x%02X val=0x%02X] -> %s\n",
    name, reg, val, ackText(err)
  );

  return err == 0;
}

// =====================================================
// READ MPU6050 REGISTER
// =====================================================
bool readReg(byte reg, byte &out, const char* name) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);

  byte err = Wire.endTransmission(false);

  if (err != 0) {
    Serial.printf(
      "[READ %-12s reg=0x%02X] -> %s\n",
      name, reg, ackText(err)
    );
    return false;
  }

  int n = Wire.requestFrom(MPU_ADDR, 1);

  if (n != 1) {
    Serial.printf(
      "[READ %-12s reg=0x%02X] -> NO DATA\n",
      name, reg
    );
    return false;
  }

  out = Wire.read();

  Serial.printf(
    "[READ %-12s reg=0x%02X] -> 0x%02X\n",
    name, reg, out
  );

  return true;
}

// =====================================================
// CHECK MPU6050 ADDRESS
// =====================================================
bool sensorResponds() {
  Wire.beginTransmission(MPU_ADDR);
  byte err = Wire.endTransmission();

  Serial.printf(
    "[ADDRESS 0x%02X] -> %s\n",
    MPU_ADDR, ackText(err)
  );

  return err == 0;
}

// =====================================================
// WAKE MPU6050
// =====================================================
bool wakeSensor() {
  bool ok = writeReg(0x6B, 0x00, "PWR_MGMT_1");

  delay(100);

  byte pwr = 0xFF;

  if (readReg(0x6B, pwr, "PWR_MGMT_1")) {
    if (pwr & 0x40) {
      Serial.println("WARNING: Sensor still in sleep mode");
      return false;
    }

    Serial.println("Sensor is awake");
    return ok;
  }

  return false;
}

// =====================================================
// CLEAR I2C BUS
// =====================================================
void clearBus() {
  pinMode(SDA_PIN, INPUT_PULLUP);
  pinMode(SCL_PIN, OUTPUT);

  digitalWrite(SCL_PIN, HIGH);
  delayMicroseconds(10);

  for (int i = 0; i < 9; i++) {
    if (digitalRead(SDA_PIN) == HIGH) {
      break;
    }

    digitalWrite(SCL_PIN, LOW);
    delayMicroseconds(10);

    digitalWrite(SCL_PIN, HIGH);
    delayMicroseconds(10);
  }

  // Generate STOP condition
  pinMode(SDA_PIN, OUTPUT);
  digitalWrite(SDA_PIN, LOW);
  delayMicroseconds(10);

  digitalWrite(SCL_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(SDA_PIN, HIGH);
  delayMicroseconds(10);

  pinMode(SDA_PIN, INPUT_PULLUP);

  Serial.printf(
    "Bus clear done (SDA is %s)\n",
    digitalRead(SDA_PIN) ? "HIGH" : "LOW"
  );
}

// =====================================================
// RECOVER I2C BUS
// =====================================================
bool recoverBus() {
  Serial.println(">>> Recovering I2C bus...");

  Wire.end();
  delay(50);

  clearBus();

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);

  delay(100);

  if (!sensorResponds()) {
    Serial.println(">>> Recovery failed");
    return false;
  }

  bool awake = wakeSensor();

  Serial.println(
    awake ? ">>> Recovery SUCCESS"
          : ">>> Recovery partial"
  );

  return awake;
}

// =====================================================
// HANDLE SENSOR FAILURE
// =====================================================
void handleFailure(const char* reason) {
  failCount++;

  Serial.printf(
    "!!! FAILURE #%d: %s\n",
    failCount, reason
  );

  recoverBus();

  if (failCount >= 5) {
    Serial.println(
      "Check sensor power, GND, SDA, SCL and wiring."
    );
  }
}

// =====================================================
// CONNECT TO WIFI
// =====================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.printf("Connecting to Wi-Fi: %s\n", WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startTime < 20000
  ) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected!");
    Serial.print("ESP32 IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection timed out; will retry.");
  }
}

// =====================================================
// CONNECT TO MQTT
// =====================================================
void connectMQTT() {
  if (mqttClient.connected()) {
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  Serial.print("Connecting to MQTT broker...");

  if (mqttClient.connect(MQTT_CLIENT_ID)) {
    Serial.println("connected!");

    mqttClient.publish(
      "pulse/status",
      "Pulse-Care ESP32 connected"
    );
  } else {
    Serial.print("failed, MQTT state = ");
    Serial.println(mqttClient.state());
  }
}

// =====================================================
// PUBLISH SENSOR DATA
// =====================================================
void publishSensorData(
  float ax,
  float ay,
  float az,
  float gx,
  float gy,
  float gz,
  float temp
) {
  if (!mqttClient.connected()) {
    Serial.println("MQTT disconnected; data not published.");
    return;
  }

  char payload[256];

  snprintf(
    payload,
    sizeof(payload),
    "{\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,"
    "\"gx\":%.3f,\"gy\":%.3f,\"gz\":%.3f,"
    "\"temp\":%.2f}",
    ax, ay, az, gx, gy, gz, temp
  );

  bool published = mqttClient.publish(
    MQTT_TOPIC,
    payload
  );

  if (published) {
    Serial.print("MQTT published: ");
    Serial.println(payload);
  } else {
    Serial.println("MQTT publish failed.");
  }
}

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=================================");
  Serial.println(" Pulse-Care MPU6050 MQTT System");
  Serial.println("=================================");

  // Start I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);

  Serial.println("=== MPU6050 communication test ===");

  int tries = 0;

  while (!sensorResponds() && tries < 3) {
    tries++;

    Serial.printf(
      "Sensor not responding (attempt %d/3)\n",
      tries
    );

    recoverBus();
    delay(300);
  }

  if (!sensorResponds()) {
    Serial.println(
      "WARNING: MPU6050 is not responding. "
      "Check wiring; readings will be retried."
    );
  } else {
    byte who = 0;

    if (readReg(0x75, who, "WHO_AM_I")) {
      Serial.printf("WHO_AM_I = 0x%02X\n", who);
    }

    wakeSensor();
  }

  // Configure MQTT
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setKeepAlive(30);
  mqttClient.setSocketTimeout(3);

  // Connect to network
  connectWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    connectMQTT();
  }

  Serial.println("=== Setup complete ===");
}

// =====================================================
// MAIN LOOP
// =====================================================
void loop() {
  // Maintain Wi-Fi
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Maintain MQTT
  if (!mqttClient.connected()) {
    connectMQTT();
  }

  mqttClient.loop();

  // Read sensor at the configured interval
  if (millis() - lastReadTime < READ_INTERVAL_MS) {
    delay(5);
    return;
  }

  lastReadTime = millis();

  // Select starting register
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);

  byte err = Wire.endTransmission(false);

  if (err != 0) {
    Serial.printf(
      "[DATA REQUEST] -> %s\n",
      ackText(err)
    );

    handleFailure("data request not acknowledged");
    return;
  }

  // Request accelerometer, temperature and gyroscope data
  int n = Wire.requestFrom(MPU_ADDR, 14, true);

  if (n != 14) {
    while (Wire.available()) {
      Wire.read();
    }

    Serial.printf(
      "[DATA READ] received %d of 14 bytes\n",
      n
    );

    handleFailure("incomplete data read");
    return;
  }

  // Read raw values
  int16_t axRaw = (int16_t)(
    ((uint16_t)Wire.read() << 8) | Wire.read()
  );

  int16_t ayRaw = (int16_t)(
    ((uint16_t)Wire.read() << 8) | Wire.read()
  );

  int16_t azRaw = (int16_t)(
    ((uint16_t)Wire.read() << 8) | Wire.read()
  );

  int16_t tempRaw = (int16_t)(
    ((uint16_t)Wire.read() << 8) | Wire.read()
  );

  int16_t gxRaw = (int16_t)(
    ((uint16_t)Wire.read() << 8) | Wire.read()
  );

  int16_t gyRaw = (int16_t)(
    ((uint16_t)Wire.read() << 8) | Wire.read()
  );

  int16_t gzRaw = (int16_t)(
    ((uint16_t)Wire.read() << 8) | Wire.read()
  );

  // Convert raw readings
  float ax = axRaw / 16384.0f;
  float ay = ayRaw / 16384.0f;
  float az = azRaw / 16384.0f;

  float gx = gxRaw / 131.0f;
  float gy = gyRaw / 131.0f;
  float gz = gzRaw / 131.0f;

  float temp = tempRaw / 340.0f + 36.53f;

  // Reject suspicious all-zero readings
  if (
    axRaw == 0 && ayRaw == 0 && azRaw == 0 &&
    gxRaw == 0 && gyRaw == 0 && gzRaw == 0 &&
    tempRaw == 0
  ) {
    handleFailure("all raw readings are zero");
    return;
  }

  // Successful sensor reading
  failCount = 0;

  Serial.printf(
    "Accel (g): X=%.3f Y=%.3f Z=%.3f\n",
    ax, ay, az
  );

  Serial.printf(
    "Gyro (deg/s): X=%.3f Y=%.3f Z=%.3f\n",
    gx, gy, gz
  );

  Serial.printf("Temperature: %.2f C\n", temp);

  // Publish sensor data through MQTT
  publishSensorData(
    ax, ay, az,
    gx, gy, gz,
    temp
  );

  Serial.println("---------------------------------");
}
```
