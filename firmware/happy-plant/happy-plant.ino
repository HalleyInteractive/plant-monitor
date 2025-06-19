/**
 * Happy Plant - ESP32 Plant Monitoring System (Enhanced v4)
 *
 * This firmware allows an ESP32 to monitor plant sensors (light, water),
 * store a 30-day history of sensor readings persistently in NVS, and
 * communicate with a web application via the Serial port.
 *
 * This version uses a simplified protocol. The device ID has been removed
 * from responses, and the colon (:) is only used for commands that send a payload.
 *
 * --- AVAILABLE COMMANDS ---
 *
 * **System & Device Commands:**
 * - CONNECT:                Handshake to confirm the device is ready.
 * - GET_VERSION:            Get the current firmware version.
 * - GET_PLANT_NAME:         Get the stored name of the plant.
 * - SET_PLANT_NAME:         Set a new name for the plant. (e.g., "SET_PLANT_NAME:My New Plant")
 * - READ_SENSORS:           Force a sensor read and store all values to NVS history.
 *
 * **Light Sensor Commands:**
 * - GET_PIN_LIGHT:          Get the GPIO pin for the light sensor.
 * - SET_PIN_LIGHT:          Set a new GPIO pin for the light sensor. (e.g., "SET_PIN_LIGHT:32")
 * - GET_CURRENT_VALUE_LIGHT:Get a live reading from the light sensor.
 * - GET_HISTORY_LIGHT:      Get the 30-day reading history for the light sensor.
 *
 * **Water Sensor Commands:**
 * - GET_PIN_WATER:          Get the GPIO pin for the water sensor.
 * - SET_PIN_WATER:          Set a new GPIO pin for the water sensor. (e.g., "SET_PIN_WATER:33")
 * - GET_CURRENT_VALUE_WATER:Get a live reading from the water sensor.
 * - GET_HISTORY_WATER:      Get the 30-day reading history for the water sensor.
 *
 * --- Communication Protocol (v6 - Simplified) ---
 * The device communicates over Serial using a simple text-based protocol.
 *
 * Command Format (from App to ESP32):
 * For commands without data: <COMMAND>
 * For commands with data:    <COMMAND>:<PAYLOAD>
 *
 * Response Format (from ESP32 to App):
 * <RESPONSE_CODE>:<ORIGINAL_COMMAND>:<PAYLOAD>
 * - RESPONSE_CODE: "OK" or "ERROR".
 * - ORIGINAL_COMMAND: The command this message is a response to.
 * - PAYLOAD: The data returned by the command.
 *
 * Examples:
 *
 * Command: CONNECT
 * Response: OK:CONNECT:Ready
 *
 * Command: SET_PLANT_NAME:Fiddle Leaf Fig
 * Response: OK:SET_PLANT_NAME:Plant name set to Fiddle Leaf Fig
 *
 * Command: GET_PIN_LIGHT
 * Response: OK:GET_PIN_LIGHT:36
 *
 * Command: SET_PIN_WATER:33
 * Response: OK:SET_PIN_WATER:Pin for water updated to 33
 */

// --- LIBRARIES ---
#include <Arduino.h>
#include <Preferences.h> // For storing settings in Non-Volatile Storage (NVS)

// --- CONSTANTS & DEFINITIONS ---
#define FIRMWARE_VERSION "1.7.0-simplified"
#define MAX_SENSORS 4
#define HISTORY_DAYS 30
#define HOURLY_READ_INTERVAL 3600000 // 1 hour in milliseconds

// NVS Namespace
Preferences preferences;
const char *nvsNamespace = "plant";

// --- SENSOR CONFIGURATION ---
// Sensor indices are now constants for clarity
const int LIGHT_SENSOR_INDEX = 0;
const int WATER_SENSOR_INDEX = 1;

struct Sensor
{
  char name[16];
  int pin;
  uint16_t lastValue;
  uint16_t history[HISTORY_DAYS];
};

Sensor sensors[MAX_SENSORS];
int numSensors = 2; // We have a light and water sensor

// --- DEVICE CONFIGURATION ---
char plantName[32] = "My Plant";
char deviceName[32] = "Plant Monitor";

// --- TIMING ---
unsigned long lastHourlyUpdate = 0;

// --- FUNCTION PROTOTYPES ---
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

  preferences.begin(nvsNamespace, false);

  loadConfiguration();
  initializeSensorPins();

  Serial.println("Plant Monitor Initialized. Ready for commands.");

  readSensorValues();
  lastHourlyUpdate = millis();
}

// =================================================================
// MAIN LOOP
// =================================================================
void loop()
{
  if (Serial.available())
  {
    String commandString = Serial.readStringUntil('\n');
    handleSerialCommand(commandString);
  }

  if (millis() - lastHourlyUpdate >= HOURLY_READ_INTERVAL)
  {
    updateAndStoreHistory();
    lastHourlyUpdate = millis();
  }
  delay(100);
}

// =================================================================
// INITIALIZATION & CONFIGURATION
// =================================================================

void loadConfiguration()
{
  String storedPlantName = preferences.getString("plantName", "My Plant");
  storedPlantName.toCharArray(plantName, sizeof(plantName));

  String storedDeviceName = preferences.getString("deviceName", "Plant Monitor");
  storedDeviceName.toCharArray(deviceName, sizeof(deviceName));

  // --- Sensor Setup ---
  strcpy(sensors[LIGHT_SENSOR_INDEX].name, "light");
  sensors[LIGHT_SENSOR_INDEX].pin = preferences.getInt("pin_light", 36);

  strcpy(sensors[WATER_SENSOR_INDEX].name, "water");
  sensors[WATER_SENSOR_INDEX].pin = preferences.getInt("pin_water", 39);

  Serial.println("Loading history from NVS...");
  for (int i = 0; i < numSensors; i++)
  {
    char historyKey[24];
    sprintf(historyKey, "hist_%s", sensors[i].name);
    memset(sensors[i].history, 0, sizeof(sensors[i].history));
    preferences.getBytes(historyKey, sensors[i].history, sizeof(sensors[i].history));
  }
}

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

void readSensorValues()
{
  Serial.println("Reading current sensor values...");
  for (int i = 0; i < numSensors; i++)
  {
    sensors[i].lastValue = analogRead(sensors[i].pin);
  }
}

void updateAndStoreHistory()
{
  Serial.println("Updating history and storing to NVS...");
  readSensorValues();

  for (int i = 0; i < numSensors; i++)
  {
    for (int j = HISTORY_DAYS - 1; j > 0; j--)
    {
      sensors[i].history[j] = sensors[i].history[j - 1];
    }
    sensors[i].history[0] = sensors[i].lastValue;

    char historyKey[24];
    sprintf(historyKey, "hist_%s", sensors[i].name);
    preferences.putBytes(historyKey, sensors[i].history, sizeof(sensors[i].history));
  }
  Serial.println("Sensor history updated and stored.");
}

// =================================================================
// COMMAND HANDLING
// =================================================================

void handleSerialCommand(String commandString)
{
  commandString.trim();
  if (commandString.length() == 0)
    return;

  String cmdStr, payload;
  int firstColon = commandString.indexOf(':');

  if (firstColon != -1)
  {
    // Command has a payload
    cmdStr = commandString.substring(0, firstColon);
    payload = commandString.substring(firstColon + 1);
  }
  else
  {
    // Command does not have a payload
    cmdStr = commandString;
    payload = "";
  }

  executeCommand(cmdStr, payload);
}

void executeCommand(String cmdStr, String payload)
{
  // --- System Commands ---
  if (cmdStr == "CONNECT")
  {
    sendResponse("OK", cmdStr, "Ready");
  }
  else if (cmdStr == "GET_VERSION")
  {
    sendResponse("OK", cmdStr, FIRMWARE_VERSION);
  }
  else if (cmdStr == "READ_SENSORS")
  {
    updateAndStoreHistory();
    sendResponse("OK", cmdStr, "Forced history update complete.");
  }
  // --- Device Configuration Commands ---
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
  // --- Light Sensor Commands ---
  else if (cmdStr == "GET_PIN_LIGHT")
  {
    sendResponse("OK", cmdStr, String(sensors[LIGHT_SENSOR_INDEX].pin));
  }
  else if (cmdStr == "SET_PIN_LIGHT")
  {
    int newPin = payload.toInt();
    if (newPin > 0)
    {
      sensors[LIGHT_SENSOR_INDEX].pin = newPin;
      preferences.putInt("pin_light", newPin);
      initializeSensorPins();
      sendResponse("OK", cmdStr, "Pin for light updated to " + String(newPin));
    }
    else
    {
      sendResponse("ERROR", cmdStr, "Invalid pin number");
    }
  }
  else if (cmdStr == "GET_CURRENT_VALUE_LIGHT")
  {
    sensors[LIGHT_SENSOR_INDEX].lastValue = analogRead(sensors[LIGHT_SENSOR_INDEX].pin);
    sendResponse("OK", cmdStr, String(sensors[LIGHT_SENSOR_INDEX].lastValue));
  }
  else if (cmdStr == "GET_HISTORY_LIGHT")
  {
    String historyPayload = "";
    for (int i = 0; i < HISTORY_DAYS; i++)
    {
      historyPayload += String(sensors[LIGHT_SENSOR_INDEX].history[i]);
      if (i < HISTORY_DAYS - 1)
        historyPayload += ",";
    }
    sendResponse("OK", cmdStr, historyPayload);
  }
  // --- Water Sensor Commands ---
  else if (cmdStr == "GET_PIN_WATER")
  {
    sendResponse("OK", cmdStr, String(sensors[WATER_SENSOR_INDEX].pin));
  }
  else if (cmdStr == "SET_PIN_WATER")
  {
    int newPin = payload.toInt();
    if (newPin > 0)
    {
      sensors[WATER_SENSOR_INDEX].pin = newPin;
      preferences.putInt("pin_water", newPin);
      initializeSensorPins();
      sendResponse("OK", cmdStr, "Pin for water updated to " + String(newPin));
    }
    else
    {
      sendResponse("ERROR", cmdStr, "Invalid pin number");
    }
  }
  else if (cmdStr == "GET_CURRENT_VALUE_WATER")
  {
    sensors[WATER_SENSOR_INDEX].lastValue = analogRead(sensors[WATER_SENSOR_INDEX].pin);
    sendResponse("OK", cmdStr, String(sensors[WATER_SENSOR_INDEX].lastValue));
  }
  else if (cmdStr == "GET_HISTORY_WATER")
  {
    String historyPayload = "";
    for (int i = 0; i < HISTORY_DAYS; i++)
    {
      historyPayload += String(sensors[WATER_SENSOR_INDEX].history[i]);
      if (i < HISTORY_DAYS - 1)
        historyPayload += ",";
    }
    sendResponse("OK", cmdStr, historyPayload);
  }
  else
  {
    sendResponse("ERROR", cmdStr, "Unknown command");
  }
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

/**
 * Sends a formatted response over the Serial port.
 * @param code The response code (e.g., "OK").
 * @param command The original command this is a response to.
 * @param payload The data payload of the response.
 */
void sendResponse(String code, String command, String payload)
{
  Serial.println(code + ":" + command + ":" + payload);
}
