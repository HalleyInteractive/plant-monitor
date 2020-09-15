#include <EEPROM.h>
#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>

char google_sheet_id[40] = "GSID";

bool shouldSaveConfig = false;

void saveConfigCallback () {
  Serial.println("Should save config");
  shouldSaveConfig = true;
}

void setup() {
  Serial.begin(9600);
  EEPROM.begin(512);

  WiFiManager wifiManager;
  
//  wifiManager.resetSettings();
  WiFiManagerParameter google_sheet_id_param("gsid", "Google Sheet ID", google_sheet_id, 40);
  wifiManager.addParameter(&google_sheet_id_param);
  wifiManager.setSaveConfigCallback(saveConfigCallback);
  wifiManager.autoConnect("Plant", "googlePlant");
  
  int pointer = 0x0F;
  if(shouldSaveConfig) {
    Serial.println("Writing new config to EEPROM...");
    strcpy(google_sheet_id, google_sheet_id_param.getValue());
    pointer = writeToEEPROM(google_sheet_id, pointer, 40);
  } else {
    Serial.println("Reading config from EEPROM...");
    pointer = readFromEEPROM(google_sheet_id, pointer, 40);
  }

  Serial.print("GOOGLE SHEET ID: ");
  Serial.println(google_sheet_id);
}

int readFromEEPROM(char *param, int start, int size) {
  Serial.print("Reading from EEPROM: ");
  for(int i = 0; i < size; i++) {
    char inp = char(EEPROM.read(start+i));
    Serial.print(inp);
    param[i] = inp;
  }
  Serial.println(" from EEPROM");
}

int writeToEEPROM(char *param, int start, int size) {
  Serial.print("Writing: ");
  for(int i = 0; i < size; i++) {
    Serial.print(param[i]);
    EEPROM.write(start+i, param[i]);
  }
  Serial.println(" to EEPROM");
  EEPROM.commit();
  return start + size;
}

void loop() {
  
}
