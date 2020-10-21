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
 
/**
 * Plant Monitor
 * 
 * A small device you can plug in the soil of your plant, it will
 * record the amount of sunlight and water.
 * 
 * The circuit:
 * - ESP8266
 * - LRD
 * - LED
 * - Capacitive Soil Sensor
 * 
 * https://github.com/HalleyInteractive/plant-monitor
 */

#include <EEPROM.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <WiFiManager.h>
#include <FirebaseESP32.h>
#include <DateTime.h>
#include <ESPDateTime.h>
#include <DHT.h>

#define LED_RED GPIO_NUM_12
#define LED_GREEN GPIO_NUM_14
#define LED_BLUE GPIO_NUM_27
#define LDR_PIN GPIO_NUM_36
#define CSMS_PIN GPIO_NUM_39
#define DHT_PIN GPIO_NUM_13

#define uS_TO_S_FACTOR 1000000  /* Conversion factor for micro seconds to seconds */
#define CONFIG_PORTAL_GPIO GPIO_NUM_33

FirebaseData firebaseData;
bool shouldSaveConfig = false;
static RTC_NOINIT_ATTR int lastFirebaseCleanup;
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
  float humidity;
  float temperature; 
};

/**
 * Setup WifiManager and components.
 */
void setup() {
  Serial.begin(115200);
  EEPROM.begin(512);

  pinMode(LDR_PIN, INPUT);
  pinMode(CSMS_PIN, INPUT);
  pinMode(DHT_PIN, INPUT);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);

  setLEDColor(YELLOW);

  WiFiManager wifiManager;

  char firebaseProject[64] = "Firebase Project ID";
  char firebaseSecret[64] = "Firebase Secret";
  char timeToSleep[16] = "30";
  
  int pointer = 0x0F;
  pointer = readFromEEPROM(firebaseProject, pointer, 64);
  pointer = readFromEEPROM(firebaseSecret, pointer, 64);
  pointer = readFromEEPROM(timeToSleep, pointer, 16);
  
//  wifiManager.resetSettings(); // Reset WiFi settings for debugging.
  WiFiManagerParameter firebaseProjectParam("fbp", "Firebase Project", firebaseProject, 64);
  wifiManager.addParameter(&firebaseProjectParam);

  WiFiManagerParameter firebaseSecretParam("fbs", "Firebase Secret", firebaseSecret, 64);
  wifiManager.addParameter(&firebaseSecretParam);

  WiFiManagerParameter timeToSleepParam("tts", "Time to Sleep (Seconds)", timeToSleep, 16);
  wifiManager.addParameter(&timeToSleepParam);
  
  wifiManager.setSaveConfigCallback(saveConfigCallback);

  print_wakeup_reason();
  esp_sleep_wakeup_cause_t wakeup_reason;
  wakeup_reason = esp_sleep_get_wakeup_cause();

  int tts = atoi(timeToSleep);
  wifiManager.setConfigPortalTimeout(180);

  if(wakeup_reason == 1 || wakeup_reason == 2) {
    // If woken up by external interrupt signal we start the config portal.
    setLEDColor(BLUE);
    wifiManager.startConfigPortal("Plant", "TakeCareOfMe");
  } else if (tts <= 0) {
    Serial.println("Could not parse timeToSleep");
    setLEDColor(MAGENTA);
    wifiManager.startConfigPortal("Plant", "TakeCareOfMe");
  } else {
    wifiManager.autoConnect("Plant", "TakeCareOfMe");
  }
  
  setLEDColor(GREEN);
  if(shouldSaveConfig) {
    int pointer = 0x0F;
    strcpy(firebaseProject, firebaseProjectParam.getValue());
    pointer = writeToEEPROM(firebaseProject, pointer, 64);
    strcpy(firebaseSecret, firebaseSecretParam.getValue());
    pointer = writeToEEPROM(firebaseSecret, pointer, 64);
    strcpy(timeToSleep, timeToSleepParam.getValue());
    pointer = writeToEEPROM(timeToSleep, pointer, 16);
    tts = atoi(timeToSleep);
  }

  Serial.print("Firebase Project: ");
  Serial.println(firebaseProject);

  Serial.print("Firebase Secret: ");
  Serial.println(firebaseSecret);

  Serial.print("Time to Sleep (Seconds): ");
  Serial.println(timeToSleep);

  Firebase.begin(firebaseProject, firebaseSecret);
  Firebase.reconnectWiFi(true);
  
  SensorReading reading = readSensorData();
  Serial.print("SENSOR LIGHT: ");
  Serial.println(reading.light);
  Serial.print("SENSOR WATER: ");
  Serial.println(reading.water);
  Serial.print("SENSOR TEMPERATURE: ");
  Serial.println(reading.temperature, 2);
  Serial.print("SENSOR HUMIDITY: ");
  Serial.println(reading.humidity, 2);
  
  setLEDColor(CYAN);

  DateTime.setServer("nl.pool.ntp.org");
  DateTime.begin();
  if(!DateTime.isTimeValid()) {
    Serial.println("Failed to get time from server.");
    setESPSleepCycle(tts);
  } else {
    Serial.print("NOW: ");
    Serial.println(DateTime.now());
    int currentTimestamp = DateTime.now();
    
    String uuid = getUUID();
  
    Firebase.setMaxRetry(firebaseData, 3);
    Firebase.setMaxErrorQueue(firebaseData, 30);
    Firebase.setReadTimeout(firebaseData, 1000 * 60 * 10);
    Firebase.enableClassicRequest(firebaseData, true);
    
    sendSensorDataToFirestore(reading, currentTimestamp);
  
    if(currentTimestamp > (lastFirebaseCleanup + 86400)) {
      setIndexOnRules();
      clearFireStoreLogs(uuid, currentTimestamp);
    }
    
    setLEDColor(OFF);
    
    if(DEBUG_SENSORS == false) {
      setESPSleepCycle(tts);
    } else {
      setLEDColor(YELLOW);
    }
  }
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
 * Reads a char array from EEPROM.
 * @param param The parameter to write EEPROM data to.
 * @param start EEPROM memory location to start read from.
 * @param size Length of the parameter.
 * @return EEPROM pointer, start + size.
 */
int readFromEEPROM(char *param, int start, int size) {
  Serial.print("Reading from EEPROM: ");
  for(int i = 0; i < size; i++) {
    char chr = char(EEPROM.read(start+i));
    Serial.print(chr);
    param[i] = chr;
  }
  Serial.println(" from EEPROM");
  return start + size;
}

/**
 * Writes a char array to EEPROM.
 * @param param The parameter to to store.
 * @param start EEPROM memory location to start writing at.
 * @param size Length of the parameter.
 * @return EEPROM pointer, start + size.
 */
int writeToEEPROM(char *param, int start, int size) {
  Serial.print("Writing '");
  for(int i = 0; i < size; i++) {
    Serial.print(param[i]);
    EEPROM.write(start+i, param[i]);
  }
  Serial.println("' to EEPROM");
  EEPROM.commit();
  return start + size;
}

/**
 * Triggered by the WifiManager if config has changed and
 * we need to write parameters to EEPROM.
 */
void saveConfigCallback () {
  shouldSaveConfig = true;
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
 
  DHT dht(DHT_PIN, DHT22);
 
  int light = analogRead(LDR_PIN);
  int water = analogRead(CSMS_PIN);
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println(F("Failed to read from DHT sensor!"));
    humidity = 0.0;
    temperature = 0.0;
  }
  

  SensorReading reading = {
    light,
    water,
    humidity,
    temperature
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
  
  FirebaseJson sensorReading;
  sensorReading.set("light", reading.light);
  sensorReading.set("water", reading.water);
  sensorReading.set("humidity", reading.humidity);
  sensorReading.set("temperature", reading.temperature);
  sensorReading.set("timestamp", currentTimestamp);
  
  Firebase.updateNode(firebaseData, "plants/" + uuid + "/last_update/", sensorReading);
  Firebase.setJSON(firebaseData, "plants/" + uuid + "/logs/" + String(currentTimestamp) +"/", sensorReading);
}

/**
 * Deletes all logs for this device older then 24H.
 */
void clearFireStoreLogs(String uuid, int currentTimestamp) {
  Serial.println("Clean up Firestore logs...");
  lastFirebaseCleanup = currentTimestamp;
  int deleteUntil = (currentTimestamp - 86400);
  Serial.print("DELETE ALL UNTIL: ");
  Serial.println(deleteUntil);
  
  QueryFilter query;
  query.orderBy("timestamp");
  query.startAt(0);
  query.endAt(deleteUntil);
  query.limitToFirst(50);

  FirebaseData logsData;
  Firebase.setMaxRetry(logsData, 3);
  Firebase.setMaxErrorQueue(logsData, 30);
  Firebase.enableClassicRequest(logsData, true);
  Firebase.setReadTimeout(logsData, 1000 * 60 * 10);
  
  if(Firebase.getJSON(logsData, "plants/" + uuid + "/logs", query)) {
    FirebaseJson &oldLogs = logsData.jsonObject();
    size_t len = oldLogs.iteratorBegin();
    String key, value = "";
    int type = 0;
    for(size_t i = 0; i < len; i++) {
      oldLogs.iteratorGet(i, type, key, value);
      if(key != "water" && key != "light" && key != "timestamp") {
        Serial.println("DELETE: plants/" + uuid + "/logs/" + key);
        Firebase.deleteNode(firebaseData, "plants/" + uuid + "/logs/" + key);
      }
    }
    oldLogs.iteratorEnd();
    if(len >= 50) {
      lastFirebaseCleanup = 0;
    }
  } else {
    Serial.println(logsData.errorReason());
  }
  query.clear();
}

/** 
 * Checks if rules have .indexOn timestamp for all plants.
 * If not this rule will be added.
 */
void setIndexOnRules() {
  FirebaseData rulesData;
  if(Firebase.getRules(rulesData)) {
    
    FirebaseJson &json = rulesData.jsonObject();
    bool setTimestampIndex = true;
    FirebaseJsonData timestampIndex;
    json.get(timestampIndex, "rules/plants/$uid/logs/.indexOn");
    if(timestampIndex.success) {
      if(timestampIndex.stringValue == "timestamp") {
        Serial.println("Timestamp index in place");
        setTimestampIndex = false;
      }
    }

    if(setTimestampIndex) {
      Serial.println("Timestamp index not found, adding it to the rules");
      json.set("rules/plants/$uid/logs/.indexOn", "timestamp");
      String rules = "";
      json.toString(rules, true);
      if(!Firebase.setRules(rulesData, rules)) {
        Serial.println("Could not save Firebase Rules");
        Serial.println("Reason: " + rulesData.errorReason());
      }
    }
    
  } else {
    Serial.println("Could not load Firebase Rules");
    Serial.println("Reason: " + rulesData.errorReason());
  }
}

/**
 * Returns string of the WiFi mac address
 * bytes.
 * @return String of WiFi mac address.
 */
String getUUID() {
  byte mac[6];
  WiFi.macAddress(mac);
  String uuid = 
    "uuid" + 
    String(mac[0], HEX) + 
    String(mac[1], HEX) + 
    String(mac[2], HEX) + 
    String(mac[3], HEX) + 
    String(mac[4], HEX) + 
    String(mac[5], HEX);
  return uuid;
}

/**
 * Method to print the reason by which ESP32
 * has been awaken from sleep.
 */
void print_wakeup_reason(){
  esp_sleep_wakeup_cause_t wakeup_reason;

  wakeup_reason = esp_sleep_get_wakeup_cause();

  switch(wakeup_reason)
  {
    case 1  : Serial.println("Wakeup caused by external signal using RTC_IO"); break;
    case 2  : Serial.println("Wakeup caused by external signal using RTC_CNTL"); break;
    case 3  : Serial.println("Wakeup caused by timer"); break;
    case 4  : Serial.println("Wakeup caused by touchpad"); break;
    case 5  : Serial.println("Wakeup caused by ULP program"); break;
    default : Serial.println("Wakeup was not caused by deep sleep"); break;
  }
}

/**
 * Arduino main event loop.
 */
void loop() {
  if(DEBUG_SENSORS) {
    SensorReading reading = readSensorData();
     Serial.print("Light:  "); Serial.print(reading.light); Serial.print("  ");
     Serial.print("Water:  "); Serial.print(reading.water); Serial.print("  ");
     Serial.print("Humidity:  "); Serial.print(reading.humidity); Serial.print("  ");
     Serial.print("Temperature:  "); Serial.print(reading.temperature); Serial.println("");
  }
}
