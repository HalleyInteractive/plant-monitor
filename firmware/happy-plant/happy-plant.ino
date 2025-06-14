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
 * --- Communication Protocol (v4 - Refined) ---
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
 *
 * Examples:
 * Note: <DEVICE_ID> is the MAC address of the ESP32 (e.g., 1A2B3C4D5E6F).

CONNECT: Handshake to confirm the device is ready.
Command: CONNECT:
Response: OK:<DEVICE_ID>:CONNECT:Ready

GET_VERSION: Get the current firmware version.
Command: GET_VERSION:
Response: OK:<DEVICE_ID>:GET_VERSION:1.5.0-refined

GET_DEVICE_ID: Get the unique device ID (MAC address).
Command: GET_DEVICE_ID:
Response: OK:<DEVICE_ID>:GET_DEVICE_ID:<DEVICE_ID>

GET_PLANT_NAME: Get the stored name of the plant.
Command: GET_PLANT_NAME:
Response: OK:<DEVICE_ID>:GET_PLANT_NAME:My Plant

SET_PLANT_NAME: Set a new name for the plant.
Command: SET_PLANT_NAME:Fiddle Leaf Fig
Response: OK:<DEVICE_ID>:SET_PLANT_NAME:Plant name set to Fiddle Leaf Fig

GET_DEVICE_NAME: Get the stored name of the device itself.
Command: GET_DEVICE_NAME:
Response: OK:<DEVICE_ID>:GET_DEVICE_NAME:Plant Monitor

SET_DEVICE_NAME: Set a new name for the device.
Command: SET_DEVICE_NAME:Office Sensor 1
Response: OK:<DEVICE_ID>:SET_DEVICE_NAME:Device name set to Office Sensor 1

GET_PIN: Get the GPIO pin for a specific sensor.
Command: GET_PIN:light
Response: OK:<DEVICE_ID>:GET_PIN:36

SET_PIN: Set a new GPIO pin for a specific sensor.
Command: SET_PIN:water,33
Response: OK:<DEVICE_ID>:SET_PIN:Pin for water updated to 33

GET_CURRENT_VALUE: Get a live reading from a specific sensor.
Command: GET_CURRENT_VALUE:light
Response: OK:<DEVICE_ID>:GET_CURRENT_VALUE:2150

GET_HISTORY: Get the 30-day reading history for a specific sensor.
Command: GET_HISTORY:water
Response: OK:<DEVICE_ID>:GET_HISTORY:1833,1845,1830,...,1900 (30 comma-separated values)

READ_SENSORS: Force a sensor read and store the values to NVS history.
Command: READ_SENSORS:
Response: OK:<DEVICE_ID>:READ_SENSORS:Forced history update complete.
 */

// --- LIBRARIES ---
#include <Arduino.h>
#include <WiFi.h>        // Required for getting the device MAC address
#include <Preferences.h> // For storing settings in Non-Volatile Storage (NVS)

// --- CONSTANTS & DEFINITIONS ---
#define FIRMWARE_VERSION "1.5.0-refined"
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
  GET_PIN,
  SET_PIN,
  GET_PLANT_NAME,
  SET_PLANT_NAME,
  GET_CURRENT_VALUE,
  GET_HISTORY,
  GET_DEVICE_ID,
  GET_DEVICE_NAME,
  SET_DEVICE_NAME,
  READ_SENSORS
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
int getSensorIndexByName(String name);

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
  sensors[0].pin = preferences.getInt("pin_light", 36);

  // Sensor 1: Water (Capacitive Soil Moisture Sensor)
  strcpy(sensors[1].name, "water");
  sensors[1].pin = preferences.getInt("pin_water", 39);

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
  else if (cmdStr == "GET_PIN")
  {
    int sensorIndex = getSensorIndexByName(payload);
    if (sensorIndex != -1)
    {
      sendResponse("OK", cmdStr, String(sensors[sensorIndex].pin));
    }
    else
    {
      sendResponse("ERROR", cmdStr, "Unknown sensor name");
    }
  }
  else if (cmdStr == "SET_PIN")
  {
    int commaIndex = payload.indexOf(',');
    if (commaIndex > 0)
    {
      String sensorName = payload.substring(0, commaIndex);
      int sensorIndex = getSensorIndexByName(sensorName);
      if (sensorIndex != -1)
      {
        int newPin = payload.substring(commaIndex + 1).toInt();
        if (newPin > 0)
        {
          sensors[sensorIndex].pin = newPin;
          char pinKey[16];
          sprintf(pinKey, "pin_%s", sensors[sensorIndex].name);
          preferences.putInt(pinKey, newPin);
          initializeSensorPins(); // Re-initialize pins
          sendResponse("OK", cmdStr, "Pin for " + sensorName + " updated to " + String(newPin));
        }
        else
        {
          sendResponse("ERROR", cmdStr, "Invalid pin number");
        }
      }
      else
      {
        sendResponse("ERROR", cmdStr, "Unknown sensor name");
      }
    }
    else
    {
      sendResponse("ERROR", cmdStr, "Invalid payload. Expected: <sensor_name>,<pin>");
    }
  }
  else if (cmdStr == "READ_SENSORS")
  {
    // Manually trigger the history update and NVS storage
    updateAndStoreHistory();
    sendResponse("OK", cmdStr, "Forced history update complete.");
  }
  else if (cmdStr == "GET_CURRENT_VALUE")
  {
    int sensorIndex = getSensorIndexByName(payload);
    if (sensorIndex != -1)
    {
      // Run a fresh, lightweight read for the specific sensor
      sensors[sensorIndex].lastValue = analogRead(sensors[sensorIndex].pin);
      sendResponse("OK", cmdStr, String(sensors[sensorIndex].lastValue));
    }
    else
    {
      sendResponse("ERROR", cmdStr, "Unknown sensor name");
    }
  }
  else if (cmdStr == "GET_HISTORY")
  {
    int sensorIndex = getSensorIndexByName(payload);
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
 * Returns the index of a sensor based on its name.
 * @param name The name of the sensor (e.g., "light").
 * @return The index in the sensors array or -1 if not found.
 */
int getSensorIndexByName(String name)
{
  for (int i = 0; i < numSensors; i++)
  {
    if (name.equalsIgnoreCase(sensors[i].name))
    {
      return i;
    }
  }
  return -1;
}

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