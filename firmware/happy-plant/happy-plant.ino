#include <nvs_flash.h>
#include <Preferences.h>

// For non-blocking delay
unsigned long previousMillis = 0;
const long interval = 10000; // 10 seconds

Preferences preferences;

void setup()
{
  // Set up Serial with a baud rate of 115200
  Serial.begin(115200);
  Serial.println("ESP32 Setup: Initializing...");

  // Initialize NVS
  esp_err_t err = nvs_flash_init();
  if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND)
  {
    // NVS partition was truncated and needs to be erased
    // Retry nvs_flash_init
    ESP_ERROR_CHECK(nvs_flash_erase());
    err = nvs_flash_init();
  }
  ESP_ERROR_CHECK(err);

  Serial.println("Opening NVS with namespace 'plant'.");
  // The second parameter is for read/write access (false) or read-only (true)
  preferences.begin("plant", false);

  // Load an entry from the NVS
  // Let's try to load a value named "last_watered"
  // The second parameter is the default value if the key doesn't exist.
  String lastWatered = preferences.getString("last_watered", "N/A");

  Serial.print("Retrieved 'last_watered' from NVS: ");
  Serial.println(lastWatered);

  // You can also save a value like this:
  // preferences.putString("last_watered", String(millis()));

  preferences.end();
  Serial.println("Setup complete :)");
}

void loop()
{
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= interval)
  {
    // Save the last time a message was sent
    previousMillis = currentMillis;

    // Send a Serial print
    Serial.print("Loop running at: ");
    Serial.println(currentMillis);
  }

  // You can add other non-blocking code here
}