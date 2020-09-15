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
 
/*
  Google Plant

  A small device you can plug in the soil of your plant, it will
  record signals such as the amount of sunlight and water.

  The circuit:
  * ESP8266
  * LRD
  * LED
  * Capacitive Soil Sensor

  https://github.com/HalleyInteractive/google-plant
*/

#include <EEPROM.h>
#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>

char googleSheetId[40] = "Google Sheet ID";
bool shouldSaveConfig = false;

/**
 * Setup WifiManager and components.
 */
void setup() {
  Serial.begin(9600);
  EEPROM.begin(512);

  WiFiManager wifiManager;
  
//  wifiManager.resetSettings(); // Reset WiFi settings for debugging.
  WiFiManagerParameter googleSheetIdParam("gsid", "Google Sheet ID", googleSheetId, 40);
  wifiManager.addParameter(&googleSheetIdParam);
  wifiManager.setSaveConfigCallback(saveConfigCallback);
  wifiManager.autoConnect("Plant", "googlePlant");
  
  int pointer = 0x0F;
  if(shouldSaveConfig) {
    strcpy(googleSheetId, googleSheetIdParam.getValue());
    pointer = writeToEEPROM(googleSheetId, pointer, 40);
  } else {
    pointer = readFromEEPROM(googleSheetId, pointer, 40);
  }

  Serial.print("Google Sheet ID: ");
  Serial.println(googleSheetId);
}

/**
    Reads a char array from EEPROM.
    @param param The parameter to write EEPROM data to.
    @param start EEPROM memory location to start read from.
    @param size Length of the parameter.
    @return EEPROM pointer, start + size.
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
    Writes a char array to EEPROM.
    @param param The parameter to to store.
    @param start EEPROM memory location to start writing at.
    @param size Length of the parameter.
    @return EEPROM pointer, start + size.
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


void loop() {
  
}
