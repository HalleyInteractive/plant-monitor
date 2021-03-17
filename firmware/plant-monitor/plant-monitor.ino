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
 * - ESP32
 * - LRD
 * - LED
 * - Capacitive Soil Sensor
 * 
 * https://github.com/HalleyInteractive/plant-monitor
 */

#include <FS.h>
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <SPIFFS.h>
#include <FirebaseESP32.h>
#include <DateTime.h>
#include <ESPDateTime.h>

#define LED_RED 12
#define LED_GREEN 14
#define LED_BLUE 27
#define LDR 36
#define CSMS 39

#define PLANT_SSID "HappyPlant"
#define PLANT_PASS "TakeCareOfMe"

#define uS_TO_S_FACTOR 1000000  /* Conversion factor for micro seconds to seconds */
#define CONFIG_PORTAL_GPIO GPIO_NUM_33

FirebaseData firebaseData;
FirebaseAuth firebaseAuth;
FirebaseConfig firebaseConfig;

bool shouldSaveConfig = false;
static RTC_NOINIT_ATTR int lastFirebaseCleanup;
const bool DEBUG_SENSORS = false;
String timeToSleep = "";

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

WiFiManager wifiManager;
WiFiManagerParameter paramDatabaseUrl("databaseUrl", "Firebase Database URL", "", 64);
WiFiManagerParameter paramApiKey("apiKey", "Firebase API Key", "", 64);
WiFiManagerParameter paramUsername("username", "Firebase Username", "", 64);
WiFiManagerParameter paramPassword("password", "Firebase Password", "", 64);
WiFiManagerParameter paramTimeToSleep("tts", "Time between reads", "", 16);

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
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);

  readConfig();

  if(timeToSleep == "") {
    timeToSleep = "30";
  }

  paramDatabaseUrl.setValue(firebaseConfig.host.c_str(), 128);
  paramApiKey.setValue(firebaseConfig.api_key.c_str(), 64);
  paramUsername.setValue(firebaseAuth.user.email.c_str(), 64);
  paramPassword.setValue(firebaseAuth.user.password.c_str(), 64);
  paramTimeToSleep.setValue(timeToSleep.c_str(), 16);

  wifiManager.addParameter(&paramDatabaseUrl);
  wifiManager.addParameter(&paramApiKey);
  wifiManager.addParameter(&paramUsername);
  wifiManager.addParameter(&paramPassword);
  wifiManager.addParameter(&paramTimeToSleep);
  
  wifiManager.setSaveConfigCallback(saveConfigCallback);

  print_wakeup_reason();
  esp_sleep_wakeup_cause_t wakeup_reason;
  wakeup_reason = esp_sleep_get_wakeup_cause();
  wifiManager.setConfigPortalTimeout(180);

  if(wakeup_reason == 1 || wakeup_reason == 2) {
    // If woken up by external interrupt signal we start the config portal.
    setLEDColor(BLUE);
    wifiManager.startConfigPortal(PLANT_SSID, PLANT_PASS);
  } else if (timeToSleep.toInt() <= 5) {
    Serial.println("Could not parse timeToSleep");
    setLEDColor(MAGENTA);
    wifiManager.startConfigPortal(PLANT_SSID, PLANT_PASS);
  } else {
    setLEDColor(BLUE);
    Serial.println("Auto Connect");
    wifiManager.autoConnect(PLANT_SSID, PLANT_PASS);
  }
  
  setLEDColor(GREEN);
  if(shouldSaveConfig) {
    Serial.println("Getting params from wifi manager to save");
    firebaseConfig.host = paramDatabaseUrl.getValue();
    firebaseConfig.api_key = paramApiKey.getValue();
    firebaseAuth.user.email = paramUsername.getValue();
    firebaseAuth.user.password = paramPassword.getValue();
    timeToSleep = paramTimeToSleep.getValue();
    
    saveConfig();
    shouldSaveConfig = false;
  }

  Serial.print("Time to Sleep (Seconds): ");
  Serial.println(timeToSleep);

  Firebase.begin(&firebaseConfig, &firebaseAuth);
  Firebase.reconnectWiFi(true);
  struct token_info_t info = Firebase.authTokenInfo();

  if (info.status == token_status_error) {
    Serial.printf("Token error: %s\n\n", getTokenError(info).c_str());
    Serial.println("Error connecting to Firebase...");
    wifiManager.startConfigPortal(PLANT_SSID, PLANT_PASS);
    delay(5000);
    ESP.restart();
  }
  
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
    setESPSleepCycle(timeToSleep.toInt());
  } else {
    Serial.print("NOW: ");
    Serial.println(DateTime.now());
    int currentTimestamp = DateTime.now();
    
    String uuid = getUUID();
    String mac = getMacAddress();
  
    Firebase.setMaxRetry(firebaseData, 3);
    Firebase.setMaxErrorQueue(firebaseData, 30);
    Firebase.setReadTimeout(firebaseData, 1000 * 60 * 10);
    Firebase.enableClassicRequest(firebaseData, true);
    
    sendSensorDataToFirestore(reading, currentTimestamp);
  
    if(currentTimestamp > (lastFirebaseCleanup + 86400)) {
      setIndexOnRules();
      clearFireStoreLogs(uuid, mac, currentTimestamp);
    }
    
    setLEDColor(OFF);
    
    if(DEBUG_SENSORS == false) {
      setESPSleepCycle(timeToSleep.toInt());
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
 * Triggered by the WifiManager if config has changed and
 * we need to write parameters to EEPROM.
 */
void saveConfigCallback () {
  shouldSaveConfig = true;
}

void readConfig(){
  // SPIFFS.format(); // Clean FS
  if (SPIFFS.begin(true)) {
    if (SPIFFS.exists("/happy_plant.json")) {
      File configFile = SPIFFS.open("/happy_plant.json", "r");
      if (configFile) {
        size_t size = configFile.size();
        std::unique_ptr<char[]> buf(new char[size]);
        configFile.readBytes(buf.get(), size);
        DynamicJsonDocument json(1024);
        auto deserializeError = deserializeJson(json, buf.get());
        serializeJson(json, Serial);
        if (!deserializeError) {
          firebaseConfig.host = (const char*)json["databaseUrl"];
          firebaseConfig.api_key = (const char*)json["apiKey"];
          firebaseAuth.user.email = (const char*)json["username"];
          firebaseAuth.user.password = (const char*)json["password"];
          timeToSleep = (const char*)json["tts"];
        } else {
          Serial.println("Failed to load json config");
        }
      }
    }
  } else {
    Serial.println("Failed to mount FS");
  }
}

void saveConfig() {
    DynamicJsonDocument json(1024);
    json["databaseUrl"] = firebaseConfig.host;
    json["apiKey"] = firebaseConfig.api_key;
    json["username"] = firebaseAuth.user.email;
    json["password"] = firebaseAuth.user.password;
    json["tts"] = timeToSleep;

    File configFile = SPIFFS.open("/happy_plant.json", "w");
    if (!configFile) {
      Serial.println("Failed to open config file for writing");
    }
    serializeJson(json, Serial);
    serializeJson(json, configFile);
    configFile.close();
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
  
  Firebase.updateNode(firebaseData, uuid + "/plants/" + mac + "/last_update/", sensorReading);
  Firebase.setJSON(firebaseData, uuid + "/plants/" + mac + "/logs/" + String(currentTimestamp) +"/", sensorReading);
}

/**
 * Deletes all logs for this device older then 24H.
 */
void clearFireStoreLogs(String uuid, String mac, int currentTimestamp) {
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
  
  if(Firebase.getJSON(logsData, uuid + "/plants/" + mac + "/logs", query)) {
    FirebaseJson &oldLogs = logsData.jsonObject();
    size_t len = oldLogs.iteratorBegin();
    String key, value = "";
    int type = 0;
    for(size_t i = 0; i < len; i++) {
      oldLogs.iteratorGet(i, type, key, value);
      if(key != "water" && key != "light" && key != "timestamp") {
        Serial.println("DELETE: " + uuid + "/plants/" + mac + "/logs/" + key);
        Firebase.deleteNode(firebaseData, uuid + "/plants/" + mac + "/logs/" + key);
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
    json.get(timestampIndex, "rules/$uid/plants/$mac/logs/.indexOn");
    if(timestampIndex.success) {
      if(timestampIndex.stringValue == "timestamp") {
        Serial.println("Timestamp index in place");
        setTimestampIndex = false;
      }
    }

    if(setTimestampIndex) {
      Serial.println("Timestamp index not found, adding it to the rules");
      json.set("rules/$uid/plants/$mac/logs/.indexOn", "timestamp");
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
     Serial.print("Water:  "); Serial.print(reading.water); Serial.println("");
  }
}
