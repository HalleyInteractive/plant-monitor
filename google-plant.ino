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
 * Google Plant
 * 
 * A small device you can plug in the soil of your plant, it will
 * record signals such as the amount of sunlight and water.
 * 
 * The circuit:
 * - ESP8266
 * - LRD
 * - LED
 * - Capacitive Soil Sensor
 * 
 * https://github.com/HalleyInteractive/google-plant
 */

#include <EEPROM.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <WiFiManager.h>
#include <FirebaseESP32.h>

char firebaseProject[64] = "Firebase Project ID";
char firebaseSecret[64] = "Firebase Secret";
bool shouldSaveConfig = false;
bool shouldStartPortal = false;
long lastSensorReadMillis = 0;
int sensorReadDelay = 5000;

FirebaseData firebaseData;

#define LED_RED 12
#define LED_GREEN 14
#define LED_BLUE 27
#define LDR 36
#define CSMS 39
#define PORTAL_TRIGGER 26

/**
 * Setup WifiManager and components.
 */
void setup() {
  Serial.begin(9600);
  EEPROM.begin(512);

  pinMode(LDR, INPUT);
  pinMode(CSMS, INPUT);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);
  
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_BLUE, HIGH);

  WiFiManager wifiManager;
  
//  wifiManager.resetSettings(); // Reset WiFi settings for debugging.
  WiFiManagerParameter firebaseProjectParam("fbp", "Firebase Project", firebaseProject, 64);
  wifiManager.addParameter(&firebaseProjectParam);

  WiFiManagerParameter firebaseSecretParam("fbs", "Firebase Secret", firebaseSecret, 64);
  wifiManager.addParameter(&firebaseSecretParam);
  
  wifiManager.setSaveConfigCallback(saveConfigCallback);
  wifiManager.autoConnect("Plant", "googlePlant");
  
  int pointer = 0x0F;
  if(shouldSaveConfig) {
    strcpy(firebaseProject, firebaseProjectParam.getValue());
    pointer = writeToEEPROM(firebaseProject, pointer, 64);
    strcpy(firebaseSecret, firebaseSecretParam.getValue());
    pointer = writeToEEPROM(firebaseSecret, pointer, 64);
  } else {
    pointer = readFromEEPROM(firebaseProject, pointer, 64);
    pointer = readFromEEPROM(firebaseSecret, pointer, 64);
  }

  Serial.print("Firebase Project: ");
  Serial.println(firebaseProject);

  Serial.print("Firebase Secret: ");
  Serial.println(firebaseSecret);

  Firebase.begin(firebaseProject, firebaseSecret);
  Firebase.reconnectWiFi(true);
  Firebase.setMaxRetry(firebaseData, 3);
  Firebase.setMaxErrorQueue(firebaseData, 30);
  Firebase.enableClassicRequest(firebaseData, true);
  
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_BLUE, LOW);

  pinMode(PORTAL_TRIGGER, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PORTAL_TRIGGER), startConfigPortal, RISING);
}

void startConfigPortal() {
  Serial.println("Starting config portal");
  shouldStartPortal = true;
}

/**
 * Sets current timestamp in Firebase, reads it and 
 * returns value.
 * @return Current timestamp in seconds.
 */
int getTimestamp() {
  Firebase.setTimestamp(firebaseData,  "/current/timestamp");
  int currentTimestamp = firebaseData.intData();
  Serial.print("TIMESTAMP (Seconds): ");
  Serial.println(currentTimestamp);
  return currentTimestamp;
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
 * Arduino main event loop.
 */
void loop() {
  if(shouldStartPortal) {
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_BLUE, HIGH);
    
    shouldStartPortal = false;
    WiFiManager wifiManager;
    WiFiManagerParameter firebaseProjectParam("fbp", "Firebase Project", firebaseProject, 64);
    wifiManager.addParameter(&firebaseProjectParam);
  
    WiFiManagerParameter firebaseSecretParam("fbs", "Firebase Secret", firebaseSecret, 64);
    wifiManager.addParameter(&firebaseSecretParam);
    
    wifiManager.setSaveConfigCallback(saveConfigCallback);
    wifiManager.startConfigPortal("Plant", "googlePlant");
    
    int pointer = 0x0F;
    if(shouldSaveConfig) {
      strcpy(firebaseProject, firebaseProjectParam.getValue());
      pointer = writeToEEPROM(firebaseProject, pointer, 64);
      strcpy(firebaseSecret, firebaseSecretParam.getValue());
      pointer = writeToEEPROM(firebaseSecret, pointer, 64);
    } else {
      pointer = readFromEEPROM(firebaseProject, pointer, 64);
      pointer = readFromEEPROM(firebaseSecret, pointer, 64);
    }
    Serial.println("Restarting ESP");
    delay(1000);
    ESP.restart();
  }

  unsigned long currentMillis = millis();
  if(currentMillis - lastSensorReadMillis > sensorReadDelay) {
      Serial.println("Reading sensor values");
      digitalWrite(LED_GREEN, LOW);
      digitalWrite(LED_RED, HIGH);
      
      int currentTimestamp = getTimestamp();
     
      int lightReading = analogRead(LDR);
      int lightPercentage = map(lightReading, 0, 4095, 0, 100);
    
      int moistReading = analogRead(CSMS);
      int moistPercentage = map(moistReading, 0, 4095, 100, 0);
    
      Serial.print(lightPercentage);
      Serial.print("  ");
      Serial.println(moistPercentage); 

      FirebaseJson sensorReading;
      sensorReading.set("light", lightPercentage);
      sensorReading.set("water", moistPercentage);
      Firebase.set(firebaseData, "plant/" + String(currentTimestamp), sensorReading);
      digitalWrite(LED_GREEN, HIGH);
      digitalWrite(LED_RED, LOW);
      lastSensorReadMillis = millis();
  }
}
