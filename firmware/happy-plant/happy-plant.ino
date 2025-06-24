/**
 * Happy Plant - ESP32 Plant Monitoring System (Enhanced v6)
 *
 * This firmware allows an ESP32 to monitor plant sensors (light, water),
 * store a 30-day history of sensor readings persistently in NVS, and
 * communicate with a web application via the Serial port.
 *
 * All sensor values (current and historical) are mapped to a 0-100 scale
 * based on a customizable input range (default 0-4095).
 *
 * The water sensor readings are INVERTED. A low raw value (wet) maps to 100,
 * and a high raw value (dry) maps to 0.
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
 * - GET_CURRENT_VALUE_LIGHT:Get a live reading from the light sensor, mapped to 0-100.
 * - GET_HISTORY_LIGHT:      Get the 30-day reading history for the light sensor (0-100 scale).
 * - GET_RANGE_LIGHT:        Get the custom mapping range for the light sensor. (Response: "min,max")
 * - SET_RANGE_LIGHT:        Set the custom mapping range. (e.g., "SET_RANGE_LIGHT:0,4000")
 * - SET_MIN_MAP_LIGHT:      Set the current light sensor reading as the minimum for mapping.
 * - SET_MAX_MAP_LIGHT:      Set the current light sensor reading as the maximum for mapping.
 *
 * **Water Sensor Commands:**
 * - GET_PIN_WATER:          Get the GPIO pin for the water sensor.
 * - SET_PIN_WATER:          Set a new GPIO pin for the water sensor. (e.g., "SET_PIN_WATER:33")
 * - GET_CURRENT_VALUE_WATER:Get a live reading from the water sensor, mapped to 0-100 (inverted).
 * - GET_HISTORY_WATER:      Get the 30-day reading history for the water sensor (0-100 scale, inverted).
 * - GET_RANGE_WATER:        Get the custom mapping range for the water sensor. (Response: "min,max")
 * - SET_RANGE_WATER:        Set the custom mapping range. (e.g., "SET_RANGE_WATER:1200,3300")
 * - SET_MIN_MAP_WATER:      Set the current water sensor reading as the minimum for mapping (wet condition).
 * - SET_MAX_MAP_WATER:      Set the current water sensor reading as the maximum for mapping (dry condition).
 *
 * --- Communication Protocol (v7 - Mapped) ---
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
 */

// --- LIBRARIES ---
#include <Arduino.h>
#include <Preferences.h> // For storing settings in Non-Volatile Storage (NVS)

// --- CONSTANTS & DEFINITIONS ---
#define FIRMWARE_VERSION "1.9.1-calibration"
#define MAX_SENSORS 4
#define HISTORY_DAYS 30
#define HOURLY_READ_INTERVAL 3600000 // 1 hour in milliseconds
#define ANALOG_MAX 4095

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
  char key_suffix; // Suffix for NVS keys ('l', 'w')
  int pin;
  uint16_t lastValue;             // Mapped value (0-100)
  uint16_t history[HISTORY_DAYS]; // Mapped values (0-100)
  uint16_t range_min;             // Custom min for mapping (raw value)
  uint16_t range_max;             // Custom max for mapping (raw value)
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
uint16_t getMappedValue(int sensorIndex, uint16_t rawValue);

// Command Handler Prototypes
void handleGetPin(int sensorIndex, String cmdStr);
void handleSetPin(int sensorIndex, String cmdStr, String payload);
void handleGetCurrentValue(int sensorIndex, String cmdStr);
void handleGetHistory(int sensorIndex, String cmdStr);
void handleGetRange(int sensorIndex, String cmdStr);
void handleSetRange(int sensorIndex, String cmdStr, String payload);
void handleSetMinMap(int sensorIndex, String cmdStr);
void handleSetMaxMap(int sensorIndex, String cmdStr);

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

  readSensorValues(); // Perform an initial read to populate lastValue
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

  // --- Initialize Sensor Config Data ---
  strcpy(sensors[LIGHT_SENSOR_INDEX].name, "light");
  sensors[LIGHT_SENSOR_INDEX].key_suffix = 'l';

  strcpy(sensors[WATER_SENSOR_INDEX].name, "water");
  sensors[WATER_SENSOR_INDEX].key_suffix = 'w';

  // --- Load Config for each sensor ---
  for (int i = 0; i < numSensors; i++)
  {
    // Load Pin
    char pinKey[16];
    sprintf(pinKey, "pin_%s", sensors[i].name);
    int defaultPin = (i == LIGHT_SENSOR_INDEX) ? 36 : 39;
    sensors[i].pin = preferences.getInt(pinKey, defaultPin);

    // Load Range
    char rangeMinKey[20], rangeMaxKey[20];
    sprintf(rangeMinKey, "range_min_%c", sensors[i].key_suffix);
    sprintf(rangeMaxKey, "range_max_%c", sensors[i].key_suffix);
    sensors[i].range_min = preferences.getUInt(rangeMinKey, 0);
    sensors[i].range_max = preferences.getUInt(rangeMaxKey, ANALOG_MAX);

    // Load History
    char historyKey[24];
    sprintf(historyKey, "hist_%s", sensors[i].name);
    memset(sensors[i].history, 0, sizeof(sensors[i].history));
    preferences.getBytes(historyKey, sensors[i].history, sizeof(sensors[i].history));
  }
  Serial.println("Sensor configuration and history loaded from NVS.");
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

/**
 * Maps a raw sensor value to a 0-100 scale using the sensor's custom range.
 * For the water sensor, this mapping is INVERTED (low raw value = 100, high raw value = 0).
 * @param sensorIndex The index of the sensor in the global array.
 * @param rawValue The raw analog reading (0-4095).
 * @return The mapped value, constrained between 0 and 100.
 */
uint16_t getMappedValue(int sensorIndex, uint16_t rawValue)
{
  if (sensorIndex < 0 || sensorIndex >= numSensors)
  {
    return 0; // Should not happen
  }

  uint16_t min_range = sensors[sensorIndex].range_min;
  uint16_t max_range = sensors[sensorIndex].range_max;

  // If min and max are the same, prevent division by zero.
  // This creates a simple binary threshold.
  if (min_range >= max_range)
  {
    if (sensorIndex == WATER_SENSOR_INDEX)
    {
      // Inverted threshold for water
      return (rawValue <= min_range) ? 100 : 0;
    }
    else
    {
      // Normal threshold for light
      return (rawValue <= min_range) ? 0 : 100;
    }
  }

  long mapped;
  if (sensorIndex == WATER_SENSOR_INDEX)
  {
    // Invert the mapping for water: wet (low raw) is 100, dry (high raw) is 0
    mapped = map(rawValue, min_range, max_range, 100, 0);
  }
  else
  {
    // Normal mapping for other sensors (light)
    mapped = map(rawValue, min_range, max_range, 0, 100);
  }

  return constrain(mapped, 0, 100);
}

/**
 * Reads the raw value from each sensor and stores the MAPPED (0-100) value
 * in the 'lastValue' field for that sensor.
 */
void readSensorValues()
{
  Serial.println("Reading and mapping sensor values...");
  for (int i = 0; i < numSensors; i++)
  {
    uint16_t rawValue = analogRead(sensors[i].pin);
    sensors[i].lastValue = getMappedValue(i, rawValue);
  }
}

/**
 * Reads the latest sensor values, shifts the history, adds the new mapped
 * value to history, and persists the history to NVS.
 */
void updateAndStoreHistory()
{
  Serial.println("Updating history and storing to NVS...");
  readSensorValues(); // This gets the mapped values into lastValue

  for (int i = 0; i < numSensors; i++)
  {
    // Shift history array to make space for the new reading
    for (int j = HISTORY_DAYS - 1; j > 0; j--)
    {
      sensors[i].history[j] = sensors[i].history[j - 1];
    }
    // Add the new mapped value to the start of the history
    sensors[i].history[0] = sensors[i].lastValue;

    // Save the updated history buffer to NVS
    char historyKey[24];
    sprintf(historyKey, "hist_%s", sensors[i].name);
    preferences.putBytes(historyKey, sensors[i].history, sizeof(sensors[i].history));
  }
  Serial.println("Sensor history updated and stored.");
}

// ================================================================
// COMMAND HANDLING
// ================================================================

void handleSerialCommand(String commandString)
{
  commandString.trim();
  if (commandString.length() == 0)
    return;

  String cmdStr, payload;
  int firstColon = commandString.indexOf(':');

  if (firstColon != -1)
  {
    cmdStr = commandString.substring(0, firstColon);
    payload = commandString.substring(firstColon + 1);
  }
  else
  {
    cmdStr = commandString;
    payload = "";
  }

  executeCommand(cmdStr, payload);
}

// --- Generic Command Handlers for Sensors ---

void handleGetPin(int sensorIndex, String cmdStr)
{
  sendResponse("OK", cmdStr, String(sensors[sensorIndex].pin));
}

void handleSetPin(int sensorIndex, String cmdStr, String payload)
{
  int newPin = payload.toInt();
  if (newPin > 0)
  {
    sensors[sensorIndex].pin = newPin;
    char pinKey[16];
    sprintf(pinKey, "pin_%s", sensors[sensorIndex].name);
    preferences.putInt(pinKey, newPin);
    initializeSensorPins();
    sendResponse("OK", cmdStr, "Pin for " + String(sensors[sensorIndex].name) + " updated to " + String(newPin));
  }
  else
  {
    sendResponse("ERROR", cmdStr, "Invalid pin number");
  }
}

void handleGetCurrentValue(int sensorIndex, String cmdStr)
{
  uint16_t rawValue = analogRead(sensors[sensorIndex].pin);
  uint16_t mappedValue = getMappedValue(sensorIndex, rawValue);
  sensors[sensorIndex].lastValue = mappedValue;
  sendResponse("OK", cmdStr, String(mappedValue));
}

void handleGetHistory(int sensorIndex, String cmdStr)
{
  String historyPayload = "";
  for (int i = 0; i < HISTORY_DAYS; i++)
  {
    historyPayload += String(sensors[sensorIndex].history[i]);
    if (i < HISTORY_DAYS - 1)
      historyPayload += ",";
  }
  sendResponse("OK", cmdStr, historyPayload);
}

void handleGetRange(int sensorIndex, String cmdStr)
{
  String range = String(sensors[sensorIndex].range_min) + "," + String(sensors[sensorIndex].range_max);
  sendResponse("OK", cmdStr, range);
}

void handleSetRange(int sensorIndex, String cmdStr, String payload)
{
  int commaIndex = payload.indexOf(',');
  if (commaIndex != -1)
  {
    String minStr = payload.substring(0, commaIndex);
    String maxStr = payload.substring(commaIndex + 1);
    int minVal = minStr.toInt();
    int maxVal = maxStr.toInt();

    if (minVal >= 0 && maxVal <= ANALOG_MAX && minVal < maxVal)
    {
      sensors[sensorIndex].range_min = minVal;
      sensors[sensorIndex].range_max = maxVal;
      char minKey[20], maxKey[20];
      sprintf(minKey, "range_min_%c", sensors[sensorIndex].key_suffix);
      sprintf(maxKey, "range_max_%c", sensors[sensorIndex].key_suffix);
      preferences.putUInt(minKey, minVal);
      preferences.putUInt(maxKey, maxVal);
      sendResponse("OK", cmdStr, String(sensors[sensorIndex].name) + " sensor range set to " + payload);
    }
    else
    {
      sendResponse("ERROR", cmdStr, "Invalid range. Use format min,max where 0 <= min < max <= 4095.");
    }
  }
  else
  {
    sendResponse("ERROR", cmdStr, "Invalid payload format. Use: min,max");
  }
}

void handleSetMinMap(int sensorIndex, String cmdStr)
{
  uint16_t rawValue = analogRead(sensors[sensorIndex].pin);
  if (rawValue < sensors[sensorIndex].range_max)
  {
    sensors[sensorIndex].range_min = rawValue;
    char minKey[20];
    sprintf(minKey, "range_min_%c", sensors[sensorIndex].key_suffix);
    preferences.putUInt(minKey, rawValue);
    sendResponse("OK", cmdStr, String(sensors[sensorIndex].name) + " sensor min range set to " + String(rawValue));
  }
  else
  {
    sendResponse("ERROR", cmdStr, "New min (" + String(rawValue) + ") must be less than current max (" + String(sensors[sensorIndex].range_max) + ").");
  }
}

void handleSetMaxMap(int sensorIndex, String cmdStr)
{
  uint16_t rawValue = analogRead(sensors[sensorIndex].pin);
  if (rawValue > sensors[sensorIndex].range_min)
  {
    sensors[sensorIndex].range_max = rawValue;
    char maxKey[20];
    sprintf(maxKey, "range_max_%c", sensors[sensorIndex].key_suffix);
    preferences.putUInt(maxKey, rawValue);
    sendResponse("OK", cmdStr, String(sensors[sensorIndex].name) + " sensor max range set to " + String(rawValue));
  }
  else
  {
    sendResponse("ERROR", cmdStr, "New max (" + String(rawValue) + ") must be greater than current min (" + String(sensors[sensorIndex].range_min) + ").");
  }
}

/**
 * Parses the command string and calls the appropriate handler.
 */
void executeCommand(String cmdStr, String payload)
{
  // --- System & Device Commands ---
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
  else if (cmdStr == "GET_PLANT_NAME")
  {
    sendResponse("OK", cmdStr, plantName);
  }
  else if (cmdStr == "SET_PLANT_NAME")
  {
    payload.toCharArray(plantName, sizeof(plantName));
    preferences.putString("plantName", plantName);
    sendResponse("OK", cmdStr, payload);
  }
  // --- Sensor Commands ---
  else
  {
    int sensorIndex = -1;
    String baseCmd = cmdStr;

    if (cmdStr.endsWith("_LIGHT"))
    {
      sensorIndex = LIGHT_SENSOR_INDEX;
      baseCmd = cmdStr.substring(0, cmdStr.lastIndexOf("_LIGHT"));
    }
    else if (cmdStr.endsWith("_WATER"))
    {
      sensorIndex = WATER_SENSOR_INDEX;
      baseCmd = cmdStr.substring(0, cmdStr.lastIndexOf("_WATER"));
    }

    if (sensorIndex != -1)
    {
      if (baseCmd == "GET_PIN")
        handleGetPin(sensorIndex, cmdStr);
      else if (baseCmd == "SET_PIN")
        handleSetPin(sensorIndex, cmdStr, payload);
      else if (baseCmd == "GET_CURRENT_VALUE")
        handleGetCurrentValue(sensorIndex, cmdStr);
      else if (baseCmd == "GET_HISTORY")
        handleGetHistory(sensorIndex, cmdStr);
      else if (baseCmd == "GET_RANGE")
        handleGetRange(sensorIndex, cmdStr);
      else if (baseCmd == "SET_RANGE")
        handleSetRange(sensorIndex, cmdStr, payload);
      else if (baseCmd == "SET_MIN_MAP")
        handleSetMinMap(sensorIndex, cmdStr);
      else if (baseCmd == "SET_MAX_MAP")
        handleSetMaxMap(sensorIndex, cmdStr);
      else
        sendResponse("ERROR", cmdStr, "Unknown sensor command");
    }
    else
    {
      sendResponse("ERROR", cmdStr, "Unknown command");
    }
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
