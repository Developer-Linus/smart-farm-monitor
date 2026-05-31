/**
 * Smart Farm ESP32-CAM Firmware
 * 
 * Hardware:
 *   - AI-Thinker ESP32-CAM
 *   - DHT22 on GPIO 13
 *   - Capacitive soil moisture sensor on GPIO 34 (ADC)
 *   - Relay (irrigation pump) on GPIO 12
 * 
 * Libraries required (install via Arduino Library Manager):
 *   - DHT sensor library by Adafruit
 *   - Adafruit Unified Sensor
 *   - ArduinoJson by Benoit Blanchon
 *   - ESP32 board package (espressif/arduino-esp32)
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"

// ── WiFi credentials ──────────────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ── Server ────────────────────────────────────────────────────────────────────
const char* SERVER_IP   = "192.168.1.100";   // IP of the PC running Flask
const int   SERVER_PORT = 5000;

// ── Pin definitions ───────────────────────────────────────────────────────────
#define DHT_PIN          13
#define DHT_TYPE         DHT22
#define SOIL_SENSOR_PIN  34    // ADC1 channel 6
#define RELAY_PIN        12    // LOW = pump ON (active-low relay)

// ── Intervals ─────────────────────────────────────────────────────────────────
const unsigned long SENSOR_INTERVAL_MS = 5000;   //  5 s
const unsigned long CAMERA_INTERVAL_MS = 30000;  // 30 s

// ── Soil moisture calibration ─────────────────────────────────────────────────
// Measure raw ADC: submerge sensor → note value (WET), dry sensor → note value (DRY)
const int SOIL_DRY = 3200;   // raw ADC when completely dry
const int SOIL_WET = 1200;   // raw ADC when fully wet

// ── AI-Thinker ESP32-CAM pin map ──────────────────────────────────────────────
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastSensorTime = 0;
unsigned long lastCameraTime = 0;

// ── Camera init ───────────────────────────────────────────────────────────────
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_VGA;   // 640×480 – good balance
  config.jpeg_quality = 12;              // 0-63, lower = better quality
  config.fb_count     = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }
  Serial.println("Camera ready");
  return true;
}

// ── WiFi connect ──────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi failed – will retry");
  }
}

// ── Read soil moisture (0-100 %) ──────────────────────────────────────────────
int readSoilMoisture() {
  int raw = analogRead(SOIL_SENSOR_PIN);
  // Map: DRY → 0%, WET → 100%
  int pct = map(raw, SOIL_DRY, SOIL_WET, 0, 100);
  return constrain(pct, 0, 100);
}

// ── Send sensor data ──────────────────────────────────────────────────────────
void sendSensorData(float temp, float hum, int soilPct) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/api/sensors";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["temperature"]   = temp;
  doc["humidity"]      = hum;
  doc["soil_moisture"] = soilPct;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code > 0) {
    String resp = http.getString();
    Serial.println("Sensor POST " + String(code) + ": " + resp);

    // Parse irrigation command from server response
    StaticJsonDocument<256> respDoc;
    if (!deserializeJson(respDoc, resp)) {
      bool irrigate = respDoc["irrigate"] | false;
      digitalWrite(RELAY_PIN, irrigate ? LOW : HIGH);  // active-low relay
      Serial.println(irrigate ? "Pump ON" : "Pump OFF");
    }
  } else {
    Serial.println("Sensor POST failed: " + http.errorToString(code));
  }
  http.end();
}

// ── Capture and send leaf image ───────────────────────────────────────────────
void sendLeafImage() {
  if (WiFi.status() != WL_CONNECTED) return;

  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return;
  }

  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/api/leaf-image";
  http.begin(url);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("Content-Length", String(fb->len));

  int code = http.POST(fb->buf, fb->len);
  if (code > 0) {
    Serial.println("Image POST " + String(code) + ": " + http.getString());
  } else {
    Serial.println("Image POST failed: " + http.errorToString(code));
  }
  http.end();
  esp_camera_fb_return(fb);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);   // pump OFF initially (active-low)

  dht.begin();
  initCamera();
  connectWiFi();

  Serial.println("Smart Farm ESP32 ready");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost – reconnecting…");
    connectWiFi();
  }

  unsigned long now = millis();

  // ── Sensor reading ──
  if (now - lastSensorTime >= SENSOR_INTERVAL_MS) {
    lastSensorTime = now;

    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();
    int   soil = readSoilMoisture();

    if (isnan(temp) || isnan(hum)) {
      Serial.println("DHT read failed");
    } else {
      Serial.printf("Temp: %.1f°C  Hum: %.1f%%  Soil: %d%%\n", temp, hum, soil);
      sendSensorData(temp, hum, soil);
    }
  }

  // ── Camera capture ──
  if (now - lastCameraTime >= CAMERA_INTERVAL_MS) {
    lastCameraTime = now;
    Serial.println("Capturing leaf image…");
    sendLeafImage();
  }
}
