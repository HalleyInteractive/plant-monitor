/**
 * Happy Plant - ESP32 Plant Monitoring System (Simplified)
 *
 * This firmware allows an ESP32 to monitor plant sensors (light, water, etc.),
 * store a 30-day history of sensor readings, and communicate with a web application
 * via the Serial port.
 *
 * This version is focused on a single device and does not include ESP-NOW or
 * multi-device proxy functionality.
 *
 * --- Communication Protocol (v3 - Simplified) ---
 * The device communicates over Serial using a simple text-based protocol.
 *
 * Command Format (from App to ESP32):
 * <COMMAND>:<PAYLOAD>
 * - COMMAND: An action from the Command enum (e.g., GET_PLANT_NAME).
 * - PAYLOAD: Optional data for the command (e.g., the new plant name).
 *
 * Response Format (from ESP32 to App):
 * <RESPONSE_CODE>:<SOURCE_DEVICE_ID>:<ORIGINAL_COMMAND>:<PAYLOAD>
 * - RESPONSE_CODE: "OK" or "ERROR".
 * - SOURCE_DEVICE_ID: The MAC address of the responding device.
 * - ORIGINAL_COMMAND: The command this message is a response to.
 * - PAYLOAD: The data returned by the command.
 */

// --- LIBRARIES ---
#include <Arduino.h>
#include <WiFi.h>        // Required for getting the device MAC address
#include <Preferences.h> // For storing settings in Non-Volatile Storage (NVS)

// --- CONSTANTS & DEFINITIONS ---
#define FIRMWARE_VERSION "1.2.0-simplified"
#define MAX_SENSORS 4
#define HISTORY_DAYS 30

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
char deviceName[32] = "Plant Monitor";

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
  GET_DEVICE_ID,
  GET_DEVICE_NAME,
  SET_DEVICE_NAME
};

// --- FUNCTION PROTOTYPES ---
String getDeviceIdString();
void sendResponse(String code, String command, String payload);
void handleSerialCommand(String commandString);
void executeCommand(String cmdStr, String payload);
void loadConfiguration();

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

  // Set WiFi to station mode to get the MAC address.
  // The ESP32 doesn't need to connect to a network.
  WiFi.mode(WIFI_STA);
  Serial.println("Device MAC Address: " + getDeviceIdString());

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

  // This part would contain the logic to read sensors every hour/day.
  // For this example, we'll just use dummy data.
  // To prevent blocking, you'd use millis() for timing in a real application.

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

  // Setup default sensors
  strcpy(sensors[0].name, "light");
  sensors[0].pin = 34;
  strcpy(sensors[1].name, "water");
  sensors[1].pin = 35;

  // In a real application, you would load sensor history from NVS as well
}

// =================================================================
// COMMAND HANDLING
// =================================================================

/**
 * Parses and executes a command received from the Serial port.
 * @param commandString The full command string (e.g., "GET_PLANT_NAME:")
 */
void handleSerialCommand(String commandString)
{
  commandString.trim();
  if (commandString.length() == 0)
    return;

  // Parse command: <CMD>:<PAYLOAD>
  String cmdStr, payload;
  int firstColon = commandString.indexOf(':');

  if (firstColon > -1)
  { // Check if a colon exists
    cmdStr = commandString.substring(0, firstColon);
    payload = commandString.substring(firstColon + 1);
  }
  else
  {
    sendResponse("ERROR", "UNKNOWN", "Invalid command format. Expected <COMMAND>:<PAYLOAD>");
    return;
  }

  // All commands are executed locally
  executeCommand(cmdStr, payload);
}

/**
 * Executes a command on the local device.
 * @param cmdStr The command to execute.
 * @param payload The associated data for the command.
 */
void executeCommand(String cmdStr, String payload)
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
      sensors[i].lastValue = random(500, 3500); // Dummy data for demonstration
      values += String(sensors[i].lastValue) + (i == numSensors - 1 ? "" : ",");
    }
    sendResponse("OK", cmdStr, values);
  }
  // Other commands (GET_PINS, SET_PINS, GET_HISTORY, etc.) would be implemented here
  else
  {
    sendResponse("ERROR", cmdStr, "Unknown command");
  }
}

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

/**
 * Returns the device's WiFi MAC address as a String.
 * This serves as a unique identifier for the device.
 */
String getDeviceIdString()
{
  String macAddress = WiFi.macAddress();
  macAddress.replace(":", ""); // Remove all colons
  return macAddress;
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