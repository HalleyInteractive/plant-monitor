/*********************************************************************************
 * ESP32 Plant Monitoring System
 *
 * This firmware allows an ESP32 device to monitor up to 5 sensors (e.g., light, water),
 * store a 30-day history of readings, and communicate with a web application via
 * the Web Serial API. It can also act as a proxy to communicate with other
 * ESP32 devices using the ESP-NOW protocol.
 *
 * Features:
 * - Manages multiple sensors with configurable pins.
 * - Stores 30 days of sensor data in NVS.
 * - Communicates over Serial and ESP-NOW using a defined protocol.
 * - Can act as an end device or a proxy for other devices.
 * - Non-blocking sensor readings.
 * - Configuration persistence using NVS.
 *
 *********************************************************************************/

#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <Preferences.h>

// --- Configuration ---
#define FIRMWARE_VERSION "1.0.0"
#define MAX_SENSORS 5
#define HISTORY_DAYS 30
#define SENSOR_READ_INTERVAL 3600000 // Read sensors every hour (3600000 ms)

// --- NVS Configuration ---
Preferences preferences;
const char *NVS_NAMESPACE = "plant";

// --- Device Configuration ---
char plantName[32] = "My Plant";
char deviceName[32] = "Main Hub";
uint8_t deviceId[6]; // MAC address will be used as the device ID
bool isProxyDevice = false;

// --- Sensor Configuration ---
struct Sensor
{
  char name[16];
  int pin;
  int lastValue;
};

Sensor sensors[MAX_SENSORS] = {
    {"light", 34, 0},
    {"water", 35, 0},
    // Add more sensors here if needed
};
int numSensors = 2; // Current number of active sensors

// --- Sensor History ---
int sensorHistory[MAX_SENSORS][HISTORY_DAYS];
int historyWriteIndex = 0;

// --- ESP-NOW Configuration ---
esp_now_peer_info_t broadcastPeer;

// --- Communication Protocol ---
/*
 * The protocol uses simple text commands and responses.
 *
 * Request Format:
 * <command>:<target_device_id>:<payload>
 *
 * Response Format:
 * <response_code>:<source_device_id>:<payload>
 *
 * Commands:
 * CONNECT              - Acknowledge connection
 * GET_VERSION          - Get firmware version
 * GET_PINS             - Get sensor pin numbers
 * SET_PINS             - Set sensor pin numbers (payload: <sensor_index>,<pin>)
 * GET_PLANT_NAME       - Get the plant name
 * SET_PLANT_NAME       - Set the plant name (payload: <name>)
 * GET_CURRENT_VALUES   - Get current sensor values
 * GET_HISTORY          - Get sensor value history
 * SET_DEVICE_TYPE      - Set if this is a proxy device (payload: 0 or 1)
 * GET_DEVICE_ID        - Get the device's unique ID (MAC address)
 * GET_DEVICE_NAME      - Get the device name
 * SET_DEVICE_NAME      - Set the device name (payload: <name>)
 * LIST_DEVICES         - List other known ESP-NOW devices
 * PROXY                - Forward a command to another device over ESP-NOW
 *
 * Response Codes:
 * OK                   - Command successful
 * ERROR                - An error occurred
 */
enum Command
{
  CONNECT,
  GET_VERSION,
  GET_PINS,
  SET_PINS,
  GET_PLANT_NAME,
  SET_PLANT_NAME,
  GET_CURRENT_VALUES,
  GET_HISTORY,
  SET_DEVICE_TYPE,
  GET_DEVICE_ID,
  GET_DEVICE_NAME,
  SET_DEVICE_NAME,
  LIST_DEVICES,
  PROXY
};

// --- Function Prototypes ---
void setupWifi();
void setupEspNow();
void setupNvs();
void loadConfiguration();
void saveConfiguration();
void readSensors();
void handleSerialCommand(String command);
String getDeviceIdString();
void sendResponse(String code, String payload);
void onDataSent(const uint8_t *mac_addr, esp_now_send_status_t status);
void onDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len);

// --- Setup ---
void setup()
{
  Serial.begin(115200);
  while (!Serial)
  {
    ; // wait for serial port to connect. Needed for native USB
  }
  Serial.println("ESP32 Plant Monitor Initializing...");

  WiFi.macAddress(deviceId);

  setupNvs();
  loadConfiguration();

  setupWifi();
  setupEspNow();

  // Configure sensor pins
  for (int i = 0; i < numSensors; i++)
  {
    pinMode(sensors[i].pin, INPUT);
  }

  Serial.println("Initialization complete.");
  sendResponse("OK", "Device ready. ID: " + getDeviceIdString());
}

// --- Main Loop ---
unsigned long lastSensorRead = 0;

void loop()
{
  // Handle incoming serial commands
  if (Serial.available())
  {
    String command = Serial.readStringUntil('\n');
    command.trim();
    handleSerialCommand(command);
  }

  // Read sensors at the specified interval
  if (millis() - lastSensorRead >= SENSOR_READ_INTERVAL)
  {
    readSensors();
    lastSensorRead = millis();
  }

  // Non-blocking delay
  delay(10);
}

// --- Setup Functions ---

void setupWifi()
{
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
}

void setupEspNow()
{
  if (esp_now_init() != ESP_OK)
  {
    Serial.println("Error initializing ESP-NOW");
    return;
  }

  esp_now_register_send_cb(onDataSent);
  esp_now_register_recv_cb(onDataRecv);

  // Add broadcast peer
  memcpy(broadcastPeer.peer_addr, &broadcastAddress, 6);
  broadcastPeer.channel = 0;
  broadcastPeer.encrypt = false;

  if (esp_now_add_peer(&broadcastPeer) != ESP_OK)
  {
    Serial.println("Failed to add broadcast peer");
    return;
  }
}

void setupNvs()
{
  preferences.begin(NVS_NAMESPACE, false);
}

// --- Configuration Management ---

void loadConfiguration()
{
  preferences.getString("plantName", plantName, sizeof(plantName));
  preferences.getString("deviceName", deviceName, sizeof(deviceName));
  isProxyDevice = preferences.getBool("isProxy", false);

  for (int i = 0; i < numSensors; i++)
  {
    String pinKey = "pin" + String(i);
    sensors[i].pin = preferences.getInt(pinKey.c_str(), sensors[i].pin);
  }

  // Load sensor history
  for (int i = 0; i < numSensors; i++)
  {
    String historyKey = "hist" + String(i);
    preferences.getBytes(historyKey.c_str(), sensorHistory[i], sizeof(int) * HISTORY_DAYS);
  }
  historyWriteIndex = preferences.getInt("histIndex", 0);
}

void saveConfiguration()
{
  preferences.putString("plantName", plantName);
  preferences.putString("deviceName", deviceName);
  preferences.putBool("isProxy", isProxyDevice);

  for (int i = 0; i < numSensors; i++)
  {
    String pinKey = "pin" + String(i);
    preferences.putInt(pinKey.c_str(), sensors[i].pin);
  }
}

void saveHistory()
{
  for (int i = 0; i < numSensors; i++)
  {
    String historyKey = "hist" + String(i);
    preferences.putBytes(historyKey.c_str(), sensorHistory[i], sizeof(int) * HISTORY_DAYS);
  }
  preferences.putInt("histIndex", historyWriteIndex);
}

// --- Sensor Functions ---

void readSensors()
{
  Serial.println("Reading sensors...");
  for (int i = 0; i < numSensors; i++)
  {
    sensors[i].lastValue = analogRead(sensors[i].pin);
    sensorHistory[i][historyWriteIndex] = sensors[i].lastValue;
  }

  historyWriteIndex = (historyWriteIndex + 1) % HISTORY_DAYS;
  saveHistory(); // Save history after each read
}

// --- Communication ---

void handleSerialCommand(String command)
{
  int cmdEnd = command.indexOf(':');
  String cmdStr = command.substring(0, cmdEnd);

  int targetEnd = command.indexOf(':', cmdEnd + 1);
  String targetIdStr = command.substring(cmdEnd + 1, targetEnd);
  String payload = command.substring(targetEnd + 1);

  // If the command is for this device
  if (targetIdStr == getDeviceIdString() || targetIdStr == "broadcast")
  {
    if (cmdStr == "CONNECT")
    {
      sendResponse("OK", "Connected to " + getDeviceIdString());
    }
    else if (cmdStr == "GET_VERSION")
    {
      sendResponse("OK", FIRMWARE_VERSION);
    }
    else if (cmdStr == "GET_PINS")
    {
      String pins = "";
      for (int i = 0; i < numSensors; i++)
      {
        pins += String(sensors[i].pin) + (i == numSensors - 1 ? "" : ",");
      }
      sendResponse("OK", pins);
    }
    else if (cmdStr == "SET_PINS")
    {
      int commaIndex = payload.indexOf(',');
      int sensorIndex = payload.substring(0, commaIndex).toInt();
      int pin = payload.substring(commaIndex + 1).toInt();
      if (sensorIndex < numSensors)
      {
        sensors[sensorIndex].pin = pin;
        pinMode(pin, INPUT);
        saveConfiguration();
        sendResponse("OK", "Pin for sensor " + String(sensorIndex) + " set to " + String(pin));
      }
      else
      {
        sendResponse("ERROR", "Invalid sensor index.");
      }
    }
    else if (cmdStr == "GET_PLANT_NAME")
    {
      sendResponse("OK", plantName);
    }
    else if (cmdStr == "SET_PLANT_NAME")
    {
      strncpy(plantName, payload.c_str(), sizeof(plantName) - 1);
      saveConfiguration();
      sendResponse("OK", "Plant name set to " + String(plantName));
    }
    else if (cmdStr == "GET_CURRENT_VALUES")
    {
      String values = "";
      for (int i = 0; i < numSensors; i++)
      {
        values += String(sensors[i].lastValue) + (i == numSensors - 1 ? "" : ",");
      }
      sendResponse("OK", values);
    }
    else if (cmdStr == "GET_HISTORY")
    {
      String historyStr = "";
      for (int i = 0; i < numSensors; i++)
      {
        historyStr += sensors[i].name;
        historyStr += ":";
        for (int j = 0; j < HISTORY_DAYS; j++)
        {
          historyStr += String(sensorHistory[i][j]) + (j == HISTORY_DAYS - 1 ? "" : ",");
        }
        if (i < numSensors - 1)
          historyStr += ";";
      }
      sendResponse("OK", historyStr);
    }
    else if (cmdStr == "GET_DEVICE_ID")
    {
      sendResponse("OK", getDeviceIdString());
    }
    // ... Implement other commands
    else
    {
      sendResponse("ERROR", "Unknown command");
    }
  }
  else if (isProxyDevice)
  {
    // Proxy command to another device
    uint8_t peer_addr[6];
    sscanf(targetIdStr.c_str(), "%2hhx:%2hhx:%2hhx:%2hhx:%2hhx:%2hhx", &peer_addr[0], &peer_addr[1], &peer_addr[2], &peer_addr[3], &peer_addr[4], &peer_addr[5]);

    esp_now_peer_info_t peerInfo;
    memcpy(peerInfo.peer_addr, peer_addr, 6);
    peerInfo.channel = 0;
    peerInfo.encrypt = false;

    if (esp_now_add_peer(&peerInfo) != ESP_OK)
    {
      sendResponse("ERROR", "Failed to add peer for proxying");
      return;
    }

    esp_now_send(peer_addr, (uint8_t *)command.c_str(), command.length());
  }
}

String getDeviceIdString()
{
  char macStr[18];
  snprintf(macStr, sizeof(macStr), "%02x:%02x:%02x:%02x:%02x:%02x",
           deviceId[0], deviceId[1], deviceId[2], deviceId[3], deviceId[4], deviceId[5]);
  return String(macStr);
}

void sendResponse(String code, String payload)
{
  Serial.println(code + ":" + getDeviceIdString() + ":" + payload);
}

void onDataSent(const uint8_t *mac_addr, esp_now_send_status_t status)
{
  // Optional: log if data was sent successfully
}

void onDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len)
{
  char buffer[len + 1];
  memcpy(buffer, incomingData, len);
  buffer[len] = 0;
  String message = String(buffer);

  // If this device is connected to serial, forward the response
  if (Serial)
  {
    Serial.println(message);
  }
}
