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
#define FIRMWARE_VERSION "1.9.0-calibration"
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

  // --- Light Sensor Setup ---
  strcpy(sensors[LIGHT_SENSOR_INDEX].name, "light");
  sensors[LIGHT_SENSOR_INDEX].pin = preferences.getInt("pin_light", 36);
  sensors[LIGHT_SENSOR_INDEX].range_min = preferences.getUInt("range_min_l", 0);
  sensors[LIGHT_SENSOR_INDEX].range_max = preferences.getUInt("range_max_l", ANALOG_MAX);

  // --- Water Sensor Setup ---
  strcpy(sensors[WATER_SENSOR_INDEX].name, "water");
  sensors[WATER_SENSOR_INDEX].pin = preferences.getInt("pin_water", 39);
  sensors[WATER_SENSOR_INDEX].range_min = preferences.getUInt("range_min_w", 0);
  sensors[WATER_SENSOR_INDEX].range_max = preferences.getUInt("range_max_w", ANALOG_MAX);

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
    uint16_t rawValue = analogRead(sensors[LIGHT_SENSOR_INDEX].pin);
    uint16_t mappedValue = getMappedValue(LIGHT_SENSOR_INDEX, rawValue);
    sensors[LIGHT_SENSOR_INDEX].lastValue = mappedValue;
    sendResponse("OK", cmdStr, String(mappedValue));
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
  else if (cmdStr == "GET_RANGE_LIGHT")
  {
    String range = String(sensors[LIGHT_SENSOR_INDEX].range_min) + "," + String(sensors[LIGHT_SENSOR_INDEX].range_max);
    sendResponse("OK", cmdStr, range);
  }
  else if (cmdStr == "SET_RANGE_LIGHT")
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
        sensors[LIGHT_SENSOR_INDEX].range_min = minVal;
        sensors[LIGHT_SENSOR_INDEX].range_max = maxVal;
        preferences.putUInt("range_min_l", minVal);
        preferences.putUInt("range_max_l", maxVal);
        sendResponse("OK", cmdStr, "Light sensor range set to " + payload);
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
  else if (cmdStr == "SET_MIN_MAP_LIGHT")
  {
    uint16_t rawValue = analogRead(sensors[LIGHT_SENSOR_INDEX].pin);
    if (rawValue < sensors[LIGHT_SENSOR_INDEX].range_max)
    {
      sensors[LIGHT_SENSOR_INDEX].range_min = rawValue;
      preferences.putUInt("range_min_l", rawValue);
      sendResponse("OK", cmdStr, "Light sensor min range set to " + String(rawValue));
    }
    else
    {
      sendResponse("ERROR", cmdStr, "New min (" + String(rawValue) + ") must be less than current max (" + String(sensors[LIGHT_SENSOR_INDEX].range_max) + ").");
    }
  }
  else if (cmdStr == "SET_MAX_MAP_LIGHT")
  {
    uint16_t rawValue = analogRead(sensors[LIGHT_SENSOR_INDEX].pin);
    if (rawValue > sensors[LIGHT_SENSOR_INDEX].range_min)
    {
      sensors[LIGHT_SENSOR_INDEX].range_max = rawValue;
      preferences.putUInt("range_max_l", rawValue);
      sendResponse("OK", cmdStr, "Light sensor max range set to " + String(rawValue));
    }
    else
    {
      sendResponse("ERROR", cmdStr, "New max (" + String(rawValue) + ") must be greater than current min (" + String(sensors[LIGHT_SENSOR_INDEX].range_min) + ").");
    }
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
    uint16_t rawValue = analogRead(sensors[WATER_SENSOR_INDEX].pin);
    uint16_t mappedValue = getMappedValue(WATER_SENSOR_INDEX, rawValue);
    sensors[WATER_SENSOR_INDEX].lastValue = mappedValue;
    sendResponse("OK", cmdStr, String(mappedValue));
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
  else if (cmdStr == "GET_RANGE_WATER")
  {
    String range = String(sensors[WATER_SENSOR_INDEX].range_min) + "," + String(sensors[WATER_SENSOR_INDEX].range_max);
    sendResponse("OK", cmdStr, range);
  }
  else if (cmdStr == "SET_RANGE_WATER")
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
        sensors[WATER_SENSOR_INDEX].range_min = minVal;
        sensors[WATER_SENSOR_INDEX].range_max = maxVal;
        preferences.putUInt("range_min_w", minVal);
        preferences.putUInt("range_max_w", maxVal);
        sendResponse("OK", cmdStr, "Water sensor range set to " + payload);
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
  else if (cmdStr == "SET_MIN_MAP_WATER")
  {
    uint16_t rawValue = analogRead(sensors[WATER_SENSOR_INDEX].pin);
    if (rawValue < sensors[WATER_SENSOR_INDEX].range_max)
    {
      sensors[WATER_SENSOR_INDEX].range_min = rawValue;
      preferences.putUInt("range_min_w", rawValue);
      sendResponse("OK", cmdStr, "Water sensor min range set to " + String(rawValue));
    }
    else
    {
      sendResponse("ERROR", cmdStr, "New min (" + String(rawValue) + ") must be less than current max (" + String(sensors[WATER_SENSOR_INDEX].range_max) + ").");
    }
  }
  else if (cmdStr == "SET_MAX_MAP_WATER")
  {
    uint16_t rawValue = analogRead(sensors[WATER_SENSOR_INDEX].pin);
    if (rawValue > sensors[WATER_SENSOR_INDEX].range_min)
    {
      sensors[WATER_SENSOR_INDEX].range_max = rawValue;
      preferences.putUInt("range_max_w", rawValue);
      sendResponse("OK", cmdStr, "Water sensor max range set to " + String(rawValue));
    }
    else
    {
      sendResponse("ERROR", cmdStr, "New max (" + String(rawValue) + ") must be greater than current min (" + String(sensors[WATER_SENSOR_INDEX].range_min) + ").");
    }
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
