/**
 * Happy Plant - ESP32 Plant Monitoring System
 * * This firmware allows an ESP32 to monitor plant sensors (light, water, etc.),
 * store a 30-day history of sensor readings, and communicate with a web application
 * via Serial and with other ESP32 devices via ESP-NOW.
 *
 * It can function as:
 * 1. An End Device: Directly connected to sensors, collecting data.
 * 2. A Proxy Device: Connected to a computer via USB, relaying commands from a
 * web app to other End Devices using ESP-NOW.
 *
 * --- Communication Protocol (v2) ---
 * The device communicates over Serial using a simple text-based protocol.
 *
 * Command Format (from App to ESP32):
 * <COMMAND>:<TARGET_DEVICE_ID>:<PAYLOAD>
 * - COMMAND: An action from the Command enum (e.g., GET_PLANT_NAME).
 * - TARGET_DEVICE_ID: The MAC address of the device the command is for.
 * 'broadcast' can be used for discovery.
 * - PAYLOAD: Optional data for the command (e.g., the new plant name).
 *
 * Response Format (from ESP32 to App):
 * <RESPONSE_CODE>:<SOURCE_DEVICE_ID>:<ORIGINAL_COMMAND>:<PAYLOAD>
 * - RESPONSE_CODE: "OK", "ERROR", "DISCOVERY_COMPLETE".
 * - SOURCE_DEVICE_ID: The MAC address of the responding device.
 * - ORIGINAL_COMMAND: The command this message is a response to.
 * - PAYLOAD: The data returned by the command.
 */

// --- LIBRARIES ---
#include <Arduino.h>
#include <esp_now.h>
#include <WiFi.h>
#include <Preferences.h> // For NVS

// --- CONSTANTS & DEFINITIONS ---
#define FIRMWARE_VERSION "1.1.0"
#define MAX_SENSORS 4
#define HISTORY_DAYS 30
#define MAX_PEERS 10

// NVS Namespace
Preferences preferences;
const char *nvsNamespace = "plant";

// --- SENSOR CONFIGURATION ---
struct Sensor
{
  char name[16];
  int pin;
  uint16_t lastValue;
  uint16_t history[HISTORY_DAYS];
};

Sensor sensors[MAX_SENSORS];
int numSensors = 2; // Initially, we have two sensors

// --- DEVICE CONFIGURATION ---
char plantName[32] = "My Plant";
char deviceName[32] = "Plant Monitor 1";
bool isProxy = false; // By default, it's an end device with sensors

// List of discovered peers for proxying
esp_now_peer_info_t discoveredPeers[MAX_PEERS];
int discoveredPeerCount = 0;
bool discoveryInProgress = false;

// Broadcast address for ESP-NOW
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// --- PROTOCOL DEFINITIONS ---
// This enum defines all possible commands in the protocol.
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
  DISCOVER_DEVICES,   // Internal command for ESP-NOW broadcast
  DISCOVERY_RESPONSE, // Internal command for ESP-NOW response
  PROXY               // Internal command to wrap a proxied message
};

// --- FUNCTION PROTOTYPES ---
String getDeviceIdString();
void sendResponse(String code, String command, String payload);
void onDataRecv(const esp_now_recv_info *info, const uint8_t *incomingData, int len);

// =================================================================
// SETUP
// =================================================================
void setup()
{
  Serial.begin(115200);

  // Initialize NVS
  preferences.begin(nvsNamespace, false);

  // Load configuration from NVS or set defaults
  loadConfiguration();

  // Setup WiFi in station mode for ESP-NOW
  WiFi.mode(WIFI_STA);
  Serial.println("Device MAC Address: " + getDeviceIdString());

  // Initialize ESP-NOW
  setupEspNow();

  // Initial log to show the device is ready
  Serial.println("Plant Monitor Initialized. Ready for commands.");
}

// =================================================================
// MAIN LOOP
// =================================================================
void loop()
{
  // Check for incoming serial commands
  if (Serial.available())
  {
    String commandString = Serial.readStringUntil('\n');
    handleSerialCommand(commandString);
  }

  // Periodically read sensors if not in proxy mode
  if (!isProxy)
  {
    // This part would contain the logic to read sensors every hour/day
    // For this example, we'll just use dummy data.
    // To prevent blocking, you'd use millis() for timing.
  }

  // A small delay to keep the loop from running too fast
  delay(100);
}

// =================================================================
// INITIALIZATION & CONFIGURATION
// =================================================================

/**
 * Loads device configuration from Non-Volatile Storage (NVS).
 * If values don't exist, it sets default values.
 */
void loadConfiguration()
{
  // Load Plant Name
  String storedPlantName = preferences.getString("plantName", "My Plant");
  storedPlantName.toCharArray(plantName, sizeof(plantName));

  // Load Device Name
  String storedDeviceName = preferences.getString("deviceName", "Plant Monitor");
  storedDeviceName.toCharArray(deviceName, sizeof(deviceName));

  // Load Device Type
  isProxy = preferences.getBool("isProxy", false);

  // Setup default sensors
  strcpy(sensors[0].name, "light");
  sensors[0].pin = 34;
  strcpy(sensors[1].name, "water");
  sensors[1].pin = 35;

  // In a real application, you would load sensor history from NVS as well
}

/**
 * Initializes ESP-NOW, registers callbacks, and adds the broadcast peer.
 */
void setupEspNow()
{
  if (esp_now_init() != ESP_OK)
  {
    Serial.println("Error initializing ESP-NOW");
    return;
  }

  // Register the receive callback
  esp_now_register_recv_cb(onDataRecv);

  // Register for a send callback to get the status of transmitted data (optional)
  // esp_now_register_send_cb(onDataSent);

  // Add broadcast peer for discovery
  esp_now_peer_info_t broadcastPeer = {};
  memcpy(broadcastPeer.peer_addr, broadcastAddress, 6);
  broadcastPeer.channel = 0;
  broadcastPeer.encrypt = false;

  if (esp_now_add_peer(&broadcastPeer) != ESP_OK)
  {
    Serial.println("Failed to add broadcast peer");
  }
}

// =================================================================
// COMMAND HANDLING
// =================================================================

/**
 * Parses and executes a command received from the Serial port.
 * @param commandString The full command string (e.g., "GET_PLANT_NAME:broadcast:")
 */
void handleSerialCommand(String commandString)
{
  commandString.trim();
  if (commandString.length() == 0)
    return;

  // Parse command: <CMD>:<TARGET>:<PAYLOAD>
  String cmdStr, targetId, payload;
  int firstColon = commandString.indexOf(':');
  int secondColon = commandString.indexOf(':', firstColon + 1);

  if (firstColon > 0 && secondColon > 0)
  {
    cmdStr = commandString.substring(0, firstColon);
    targetId = commandString.substring(firstColon + 1, secondColon);
    payload = commandString.substring(secondColon + 1);
  }
  else
  {
    sendResponse("ERROR", "UNKNOWN", "Invalid command format");
    return;
  }

  // If the target is this device or broadcast, handle it locally.
  // Otherwise, proxy it over ESP-NOW.
  if (targetId.equalsIgnoreCase(getDeviceIdString()) || targetId.equalsIgnoreCase("broadcast"))
  {
    executeCommand(cmdStr, payload, nullptr);
  }
  else
  {
    // This is a command for another device, proxy it
    proxyCommand(commandString, targetId);
  }
}

/**
 * Executes a command on the local device.
 * @param cmdStr The command to execute.
 * @param payload The associated data for the command.
 * @param sourceMac The MAC address of the original sender (for ESP-NOW).
 */
void executeCommand(String cmdStr, String payload, const uint8_t *sourceMac)
{
  if (cmdStr == "GET_VERSION")
  {
    sendResponse("OK", cmdStr, FIRMWARE_VERSION);
  }
  else if (cmdStr == "GET_DEVICE_ID")
  {
    sendResponse("OK", cmdStr, getDeviceIdString());
  }
  else if (cmdStr == "GET_PLANT_NAME")
  {
    sendResponse("OK", cmdStr, plantName);
  }
  else if (cmdStr == "SET_PLANT_NAME")
  {
    payload.toCharArray(plantName, sizeof(plantName));
    preferences.putString("plantName", plantName);
    sendResponse("OK", cmdStr, "Plant name set to " + payload);
  }
  else if (cmdStr == "GET_DEVICE_NAME")
  {
    sendResponse("OK", cmdStr, deviceName);
  }
  else if (cmdStr == "SET_DEVICE_NAME")
  {
    payload.toCharArray(deviceName, sizeof(deviceName));
    preferences.putString("deviceName", deviceName);
    sendResponse("OK", cmdStr, "Device name set to " + payload);
  }
  else if (cmdStr == "GET_CURRENT_VALUES")
  {
    String values = "";
    for (int i = 0; i < numSensors; i++)
    {
      // In a real scenario, you'd call analogRead(sensors[i].pin) here
      sensors[i].lastValue = random(500, 3500); // Dummy data
      values += String(sensors[i].lastValue) + (i == numSensors - 1 ? "" : ",");
    }
    sendResponse("OK", cmdStr, values);
  }
  else if (cmdStr == "LIST_DEVICES")
  {
    // Broadcast a discovery request over ESP-NOW
    String discoverMsg = "DISCOVER_DEVICES:" + getDeviceIdString() + ":";
    esp_now_send(broadcastAddress, (uint8_t *)discoverMsg.c_str(), discoverMsg.length());
    discoveryInProgress = true;
    discoveredPeerCount = 0;
    delay(2000); // Wait 2 seconds for responses
    discoveryInProgress = false;

    String peerList = "";
    for (int i = 0; i < discoveredPeerCount; i++)
    {
      // Here you would look up the device name from a stored list
      peerList += macToString(discoveredPeers[i].peer_addr) + "," + "DiscoveredDevice" + String(i);
      if (i < discoveredPeerCount - 1)
        peerList += ";";
    }
    sendResponse("DISCOVERY_COMPLETE", cmdStr, peerList);
  }
  else if (cmdStr == "DISCOVER_DEVICES")
  {
    // This is a response to a discovery request
    String responseMsg = "DISCOVERY_RESPONSE:" + getDeviceIdString() + ":" + deviceName;
    uint8_t targetMac[6];
    stringToMac(payload, targetMac);
    esp_now_send(targetMac, (uint8_t *)responseMsg.c_str(), responseMsg.length());
  }
  // Other commands (GET_PINS, SET_PINS, GET_HISTORY, etc.) would be implemented here
  else
  {
    sendResponse("ERROR", cmdStr, "Unknown command");
  }
}

/**
 * Forwards a command string to a target device over ESP-NOW.
 * @param commandString The full command to forward.
 * @param targetId The MAC address of the target device.
 */
void proxyCommand(String commandString, String targetId)
{
  uint8_t targetMac[6];
  if (!stringToMac(targetId, targetMac))
  {
    sendResponse("ERROR", "PROXY", "Invalid target MAC address");
    return;
  }

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, targetMac, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;

  // Add peer if not already present
  if (!esp_now_is_peer_exist(targetMac))
  {
    if (esp_now_add_peer(&peerInfo) != ESP_OK)
    {
      sendResponse("ERROR", "PROXY", "Failed to add peer for proxying");
      return;
    }
  }

  // Send the original command string over ESP-NOW
  esp_err_t result = esp_now_send(targetMac, (const uint8_t *)commandString.c_str(), commandString.length());

  if (result != ESP_OK)
  {
    sendResponse("ERROR", "PROXY", "Failed to send proxy message");
  }
}

// =================================================================
// ESP-NOW CALLBACKS
// =================================================================

/**
 * Callback function that is executed when ESP-NOW data is received.
 */
void onDataRecv(const esp_now_recv_info *info, const uint8_t *incomingData, int len)
{
  char buffer[len + 1];
  memcpy(buffer, incomingData, len);
  buffer[len] = '\0';
  String message = String(buffer);

  // All ESP-NOW messages are treated like Serial commands
  // This allows devices to command each other using the same protocol.

  // If this device is a proxy, it just forwards the response to the Serial port.
  // Otherwise, it processes the command itself.
  if (isProxy)
  {
    // A proxy's job is to forward responses back to the web app
    Serial.println(message);
  }
  else
  {
    // An end device needs to parse and execute the command
    String cmdStr, targetId, payload;
    int firstColon = message.indexOf(':');
    int secondColon = message.indexOf(':', firstColon + 1);

    if (firstColon > 0 && secondColon > 0)
    {
      cmdStr = message.substring(0, firstColon);
      targetId = message.substring(firstColon + 1, secondColon);
      payload = message.substring(secondColon + 1);

      // Execute the command received over ESP-NOW
      if (targetId.equalsIgnoreCase(getDeviceIdString()) || targetId.equalsIgnoreCase("broadcast"))
      {
        executeCommand(cmdStr, payload, info->src_addr);
      }
    }
  }
}

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

/**
 * Returns the device's WiFi MAC address as a String.
 */
String getDeviceIdString()
{
  return WiFi.macAddress();
}

/**
 * Sends a formatted response over the Serial port.
 * @param code The response code (e.g., "OK").
 * @param command The original command this is a response to.
 * @param payload The data payload of the response.
 */
void sendResponse(String code, String command, String payload)
{
  Serial.println(code + ":" + getDeviceIdString() + ":" + command + ":" + payload);
}

/**
 * Converts a MAC address string to a uint8_t array.
 * @param macStr The string to convert (e.g., "AA:BB:CC:DD:EE:FF").
 * @param macArr The output array.
 * @return True on success, false on failure.
 */
bool stringToMac(String macStr, uint8_t *macArr)
{
  if (sscanf(macStr.c_str(), "%hhx:%hhx:%hhx:%hhx:%hhx:%hhx", &macArr[0], &macArr[1], &macArr[2], &macArr[3], &macArr[4], &macArr[5]) == 6)
  {
    return true;
  }
  return false;
}

/**
 * Converts a MAC address from a uint8_t array to a String.
 */
String macToString(const uint8_t *macArr)
{
  char mac_char[18];
  sprintf(mac_char, "%02X:%02X:%02X:%02X:%02X:%02X", macArr[0], macArr[1], macArr[2], macArr[3], macArr[4], macArr[5]);
  return String(mac_char);
}
