/**
 * Happy Plant - ESP32 Plant Monitoring System (Enhanced v2)
 *
 * This firmware allows an ESP32 to monitor plant sensors (light, water),
 * store a 30-day history of sensor readings persistently in NVS, and
 * communicate with a web application via the Serial port.
 *
 * This version adds persistent history storage to NVS and optimizes NVS writes
 * to only occur once per hour, reducing flash memory wear. The logic for
 * reading sensor values is now separate from storing them in history.
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
#define FIRMWARE_VERSION "1.4.0-persistent"
#define MAX_SENSORS 4
#define HISTORY_DAYS 30
#define HOURLY_READ_INTERVAL 3600000 // 1 hour in milliseconds (60 * 60 * 1000)
// For testing, you can use a shorter interval, e.g., 10 seconds: #define HOURLY_READ_INTERVAL 10000

// NVS Namespace
Preferences preferences;
const char *nvsNamespace = "plant";

// --- SENSOR CONFIGURATION ---
struct Sensor
{
  char name[16];
  int pin;
  uint16_t lastValue;
  // We store the most recent reading at index 0
  uint16_t history[HISTORY_DAYS];
};

Sensor sensors[MAX_SENSORS];
int numSensors = 2; // We have a light and water sensor

// --- DEVICE CONFIGURATION ---
char plantName[32] = "My Plant";
char deviceName[32] = "Plant Monitor";

// --- TIMING ---
unsigned long lastHourlyUpdate = 0;

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
  SET_DEVICE_NAME,
  READ_SENSORS // New internal command for on-demand reading
};

// --- FUNCTION PROTOTYPES ---
String getDeviceIdString();
void sendResponse(String code, String command, String payload);
void handleSerialCommand(String commandString);
void executeCommand(String cmdStr, String payload);
void loadConfiguration();
void initializeSensorPins();
void readSensorValues();
void updateAndStoreHistory();

// =================================================================
// SETUP
// =================================================================
void setup()
{
  Serial.begin(115200);

  // Initialize NVS
  preferences.begin(nvsNamespace, false);

  // Load configuration from NVS, including persistent history
  loadConfiguration();

  // Initialize sensor pins
  initializeSensorPins();

  // Set WiFi to station mode to get the MAC address.
  // The ESP32 doesn't need to connect to a network.
  WiFi.mode(WIFI_STA);
  Serial.println("Device MAC Address: " + getDeviceIdString());

  // Initial log to show the device is ready
  Serial.println("Plant Monitor Initialized. Ready for commands.");

  // Perform an initial sensor read on startup, but don't store it,
  // as the history is already loaded.
  readSensorValues();
  lastHourlyUpdate = millis();
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

  // Check if it's time for the hourly history update
  if (millis() - lastHourlyUpdate >= HOURLY_READ_INTERVAL)
  {
    updateAndStoreHistory();
    lastHourlyUpdate = millis(); // Reset the timer
  }

  // A small delay to keep the loop from running too fast
  delay(100);
}

// =================================================================
// INITIALIZATION & CONFIGURATION
// =================================================================

/**
 * Loads device configuration from Non-Volatile Storage (NVS).
 * This now includes loading the persistent sensor history.
 */
void loadConfiguration()
{
  // Load Plant Name
  String storedPlantName = preferences.getString("plantName", "My Plant");
  storedPlantName.toCharArray(plantName, sizeof(plantName));

  // Load Device Name
  String storedDeviceName = preferences.getString("deviceName", "Plant Monitor");
  storedDeviceName.toCharArray(deviceName, sizeof(deviceName));

  // --- Sensor Setup ---
  // Sensor 0: Light (LDR)
  strcpy(sensors[0].name, "light");
  sensors[0].pin = preferences.getInt("lightPin", 36);

  // Sensor 1: Water (Capacitive Soil Moisture Sensor)
  strcpy(sensors[1].name, "water");
  sensors[1].pin = preferences.getInt("waterPin", 39);

  // Load sensor history from NVS
  Serial.println("Loading history from NVS...");
  for (int i = 0; i < numSensors; i++)
  {
    char historyKey[24];
    sprintf(historyKey, "hist_%s", sensors[i].name);

    // getBytes will fill the history array. If the key doesn't exist,
    // it will not modify the array, so we initialize it to 0s first.
    memset(sensors[i].history, 0, sizeof(sensors[i].history));
    preferences.getBytes(historyKey, sensors[i].history, sizeof(sensors[i].history));
  }
}

/**
 * Sets the pin mode for all configured sensors.
 */
void initializeSensorPins()
{
  for (int i = 0; i < numSensors; i++)
  {
    pinMode(sensors[i].pin, INPUT);
  }
}

// =================================================================
// SENSOR READING & HISTORY MANAGEMENT
// =================================================================

/**
 * Reads data from all configured sensors into the `lastValue` field.
 * This function DOES NOT modify history or write to NVS.
 */
void readSensorValues()
{
  Serial.println("Reading current sensor values...");
  for (int i = 0; i < numSensors; i++)
  {
    sensors[i].lastValue = analogRead(sensors[i].pin);
  }
}

/**
 * Updates the in-memory history with the latest sensor readings
 * and persists the new history to NVS. This is the "heavy" operation
 * that should only be called periodically.
 */
void updateAndStoreHistory()
{
  Serial.println("Updating history and storing to NVS...");
  // First, get the fresh sensor readings
  readSensorValues();

  for (int i = 0; i < numSensors; i++)
  {
    // Shift history data one day back
    for (int j = HISTORY_DAYS - 1; j > 0; j--)
    {
      sensors[i].history[j] = sensors[i].history[j - 1];
    }

    // Store the new value at the beginning of the history array
    sensors[i].history[0] = sensors[i].lastValue;

    // Create a key for this sensor's history (e.g., "hist_light")
    char historyKey[24];
    sprintf(historyKey, "hist_%s", sensors[i].name);

    // Write the entire history array to NVS for this sensor
    preferences.putBytes(historyKey, sensors[i].history, sizeof(sensors[i].history));
  }
  Serial.println("Sensor history updated and stored.");
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

  if (firstColon != -1)
  {
    cmdStr = commandString.substring(0, firstColon);
    payload = commandString.substring(firstColon + 1);
  }
  else
  {
    // Support for commands without payload, e.g. "GET_VERSION:"
    cmdStr = commandString.substring(0, commandString.length() - 1);
    payload = "";
  }

  executeCommand(cmdStr, payload);
}

/**
 * Executes a command on the local device.
 * @param cmdStr The command to execute.
 * @param payload The associated data for the command.
 */
void executeCommand(String cmdStr, String payload)
{
  if (cmdStr == "CONNECT")
  {
    sendResponse("OK", cmdStr, "Ready");
  }
  else if (cmdStr == "GET_VERSION")
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
  else if (cmdStr == "GET_PINS")
  {
    String pins = String(sensors[0].pin) + "," + String(sensors[1].pin);
    sendResponse("OK", cmdStr, pins);
  }
  else if (cmdStr == "SET_PINS")
  {
    int commaIndex = payload.indexOf(',');
    if (commaIndex > 0)
    {
      String lightPinStr = payload.substring(0, commaIndex);
      String waterPinStr = payload.substring(commaIndex + 1);
      int lightPin = lightPinStr.toInt();
      int waterPin = waterPinStr.toInt();

      if (lightPin > 0 && waterPin > 0)
      {
        sensors[0].pin = lightPin;
        sensors[1].pin = waterPin;
        preferences.putInt("lightPin", lightPin);
        preferences.putInt("waterPin", waterPin);
        initializeSensorPins(); // Re-initialize pins with new numbers
        sendResponse("OK", cmdStr, "Pins updated to light=" + String(lightPin) + ", water=" + String(waterPin));
      }
      else
      {
        sendResponse("ERROR", cmdStr, "Invalid pin numbers");
      }
    }
    else
    {
      sendResponse("ERROR", cmdStr, "Invalid payload. Expected: lightPin,waterPin");
    }
  }
  else if (cmdStr == "READ_SENSORS")
  {
    // Manually trigger the history update and NVS storage
    updateAndStoreHistory();
    sendResponse("OK", cmdStr, "Forced history update complete.");
  }
  else if (cmdStr == "GET_CURRENT_VALUES")
  {
    // Run a fresh, lightweight read without storing to history/NVS
    readSensorValues();
    String values = "";
    for (int i = 0; i < numSensors; i++)
    {
      values += String(sensors[i].lastValue) + (i == numSensors - 1 ? "" : ",");
    }
    sendResponse("OK", cmdStr, values);
  }
  else if (cmdStr == "GET_HISTORY")
  {
    int sensorIndex = -1;
    if (payload == "light")
      sensorIndex = 0;
    if (payload == "water")
      sensorIndex = 1;

    if (sensorIndex != -1)
    {
      String historyPayload = "";
      for (int i = 0; i < HISTORY_DAYS; i++)
      {
        historyPayload += String(sensors[sensorIndex].history[i]);
        if (i < HISTORY_DAYS - 1)
        {
          historyPayload += ",";
        }
      }
      sendResponse("OK", cmdStr, historyPayload);
    }
    else
    {
      sendResponse("ERROR", cmdStr, "Unknown sensor name. Use 'light' or 'water'.");
    }
  }
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
