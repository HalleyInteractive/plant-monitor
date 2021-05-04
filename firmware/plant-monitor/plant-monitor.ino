/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <ESPDateTime.h>
#include "nvs_flash.h"
#include "nvs.h"

#define LED_RED 12
#define LED_GREEN 14
#define LED_BLUE 27
#define LDR 36
#define CSMS 39

#define uS_TO_S_FACTOR 1000000  /* Conversion factor for micro seconds to seconds */
#define CONFIG_PORTAL_GPIO GPIO_NUM_33

FirebaseData firebaseData;
FirebaseAuth firebaseAuth;
FirebaseConfig firebaseConfig;

typedef uint32_t nvs_handle_t;
nvs_handle_t nvsHandle;

const bool DEBUG_SENSORS = false;

enum LedColor {
  OFF,
  RED,
  GREEN,
  BLUE,
  YELLOW,
  CYAN,
  MAGENTA
};

struct SensorReading {
  int light;
  int water;
};

/**
 * Setup WifiManager and components.
 */
void setup() {
  Serial.begin(115200);

  pinMode(LDR, INPUT);
  pinMode(CSMS, INPUT);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);

  printf("Opening NVS...");
  ESP_ERROR_CHECK(nvs_flash_init());
  ESP_ERROR_CHECK(nvs_open("storage", NVS_READWRITE, &nvsHandle));

  wifiSSID = getNVSStringEntry(&nvsHandle, 'wifiSSID');
  wifiPassword = getNVSStringEntry(&nvsHandle, 'wifiPassword');
  firebaseHost = getNVSStringEntry(&nvsHandle, 'fbHost');
  firebaseAPIKey = getNVSStringEntry(&nvsHandle, 'fbAPIKey');
  firebaseUsername = getNVSStringEntry(&nvsHandle, 'fbUsername');
  firebasePassword = getNVSStringEntry(&nvsHandle, 'fbPassword');

  setLEDColor(BLUE);
  WiFi.begin(wifiSSID, wifiPassword);
  while (WiFi.status() != WL_CONNECTED) {
      delay(1000);
      Serial.println("Establishing connection to WiFi..");
  }
  Serial.println("Connected to network");

  firebaseConfig.host = firebaseHost;
  firebaseConfig.api_key = firebaseAPIKey;
  firebaseConfig.token_status_callback = authTokenChangeHandler;

  firebaseAuth.user.email = firebaseUsername;
  firebaseAuth.user.password = firebasePassword;
  
  Firebase.begin(&firebaseConfig, &firebaseAuth);
  Firebase.reconnectWiFi(true);
}

char* getNVSStringEntry(nvs_handle_t *handle, string key) {
  size_t required_size;
  ESP_ERROR_CHECK(nvs_get_str(my_handle, key, NULL, &required_size));
  char* value = (char*)malloc(required_size);
  ESP_ERROR_CHECK(nvs_get_str(my_handle, key, value, &required_size));
  return value
}

/**
 * Firebase Auth Token Change Handler.
 */
void authTokenChangeHandler(struct token_info_t info) {
  Serial.printf("Auth token changed %d\r\n", info.status);
  if(info.status == token_status_ready) {
    readAndStoreSensorData();
  } else if (info.status == token_status_error) {
    Serial.printf("Token error: %s\r\n\r\n", getTokenError(info).c_str());
    Serial.println("Error connecting to Firebase...");
    int tts = getTTS();
    setESPSleepCycle(tts);
  }
}

int getTTS() {
  String uuid = getUUID();
  String mac = getMacAddress();
  String ttsPath = uuid + "/plants/" + mac + "/config/tts";
  if (Firebase.RTDB.getInt(&firebaseData, ttsPath.c_str())) {
    return firebaseData.intData();
  } else {
    Serial.print("Error getting TTS");
    Serial.println(firebaseData.errorReason());
    return 60;
  }
}


void readAndStoreSensorData() {
  SensorReading reading = readSensorData();
  Serial.print("SENSOR LIGHT: ");
  Serial.println(reading.light);
  Serial.print("SENSOR WATER: ");
  Serial.println(reading.water);
  
  setLEDColor(CYAN);

  DateTime.setServer("nl.pool.ntp.org");
  DateTime.begin();
  if(!DateTime.isTimeValid()) {
    Serial.println("Failed to get time from server.");
    setESPSleepCycle(60);
  } else {
    Serial.print("NOW: ");
    Serial.println(DateTime.now());
    int currentTimestamp = DateTime.now();
    
    String uuid = getUUID();

    Firebase.RTDB.setMaxRetry(&firebaseData, 3);
    Firebase.RTDB.setMaxErrorQueue(&firebaseData, 30);
    Firebase.RTDB.setReadTimeout(&firebaseData, 1000 * 60 * 10);
    Firebase.RTDB.enableClassicRequest(&firebaseData, true);
    
    sendSensorDataToFirestore(reading, currentTimestamp);
    setLEDColor(OFF);
    
    if(DEBUG_SENSORS == false) {
      int tts = getTTS();
      setESPSleepCycle(tts);
    } else {
      setLEDColor(YELLOW);
    }
  }
}

/* The helper function to get the token error string */
String getTokenError(struct token_info_t info) {
    String s = "code: ";
    s += String(info.error.code);
    s += ", message: ";
    s += info.error.message.c_str();
    return s;
}

/**
 * Puts the ESP into deep sleep, setting interupt and timer
 * to wake up the ESP.
 */
void setESPSleepCycle(int tts) {
  esp_err_t rtc_gpio_pulldown_en(CONFIG_PORTAL_GPIO);
  esp_sleep_enable_ext0_wakeup(CONFIG_PORTAL_GPIO, HIGH);
  esp_sleep_enable_timer_wakeup(tts * uS_TO_S_FACTOR);
  Serial.println("Setup ESP32 to sleep for every " + String(tts) + " Seconds");
  esp_deep_sleep_start();
}

/**
 * Changes color of the  RGB LED.
 * @param color LedColor Value.
 */
void setLEDColor(LedColor color) {
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_BLUE, LOW);
  
  switch(color) {
    case RED:
      digitalWrite(LED_RED, HIGH);
      break;
    case GREEN:
      digitalWrite(LED_GREEN, HIGH);
      break;
    case BLUE:
      digitalWrite(LED_BLUE, HIGH);
      break;
    case YELLOW:
      digitalWrite(LED_RED, HIGH);
      digitalWrite(LED_GREEN, HIGH);
      break;
    case CYAN:
      digitalWrite(LED_GREEN, HIGH);
      digitalWrite(LED_BLUE, HIGH);
      break;
    case MAGENTA:
      digitalWrite(LED_RED, HIGH);
      digitalWrite(LED_BLUE, HIGH);
      break;
  }
}

/**
 * Reads the LDR and Capacitive Soil Sensor data.
 * @return SensorReading
 */
SensorReading readSensorData() {
  Serial.println("Reading sensor values");
  setLEDColor(RED);
 
  int light = analogRead(LDR);
  int water = analogRead(CSMS);
  

  SensorReading reading = {
    light,
    water
  };
   
  return reading;
}

/**
 * Sends Sensor Reading data to Firestore.
 * @param reading with sensor values.
 */
void sendSensorDataToFirestore(SensorReading reading, int currentTimestamp) {
  Serial.println("Send Data to Firestore");
  setLEDColor(YELLOW);

  String uuid = getUUID();
  String mac = getMacAddress();
  
  FirebaseJson sensorReading;
  sensorReading.set("light", reading.light);
  sensorReading.set("water", reading.water);
  sensorReading.set("timestamp", currentTimestamp);
  
  String lastUpdatePath = uuid + "/plants/" + mac + "/last_update/";
  Firebase.RTDB.updateNode(&firebaseData, lastUpdatePath.c_str(), &sensorReading);

  String logsPath = uuid + "/plants/" + mac + "/logs/" + String(currentTimestamp) + "/";
  Firebase.RTDB.setJSON(&firebaseData, logsPath.c_str(), &sensorReading);
}

/**
 * Returns string authenticated Firebase User.
 * @return String of authenticated user.
 */
String getUUID() {
  return firebaseAuth.token.uid.c_str();
}

/**
 * Returns string of the WiFi mac address bytes.
 * @return String of WiFi mac address.
 */
String getMacAddress() {
  byte mac[6];
  WiFi.macAddress(mac);
  String macStr = 
    "mac" + 
    String(mac[0], HEX) + 
    String(mac[1], HEX) + 
    String(mac[2], HEX) + 
    String(mac[3], HEX) + 
    String(mac[4], HEX) + 
    String(mac[5], HEX);
  return macStr;
}

/**
 * Arduino main event loop.
 */
void loop() {
  if(DEBUG_SENSORS) {
    SensorReading reading = readSensorData();
     Serial.print("Light:  "); Serial.print(reading.light); Serial.print("  ");
     Serial.print("Water:  "); Serial.print(reading.water); Serial.println("");
  }
}