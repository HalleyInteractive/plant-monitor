#include <nvs_flash.h>
#include <Preferences.h>

// For non-blocking delay
unsigned long previousMillis = 0;
const long interval = 10000; // 10 seconds

Preferences preferences;

// A flag to indicate if serial is connected
volatile bool isSerialConnected = false;

#if ARDUINO_USB_CDC_ON_BOOT
void onSerialEvent(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
  if (event_id == ARDUINO_USB_CDC_CONNECTED_EVENT)
  {
    isSerialConnected = true;
    Serial.println("Serial connected!");
  }
  else if (event_id == ARDUINO_USB_CDC_DISCONNECTED_EVENT)
  {
    isSerialConnected = false;
    // You can add code here to handle disconnection if needed
  }
}
#endif

void setup()
{
  // Set up Serial with a baud rate of 115200
  Serial.begin(115200);
  Serial.println("ESP32 Setup: Initializing...");

#if ARDUINO_USB_CDC_ON_BOOT
  Serial.onEvent(onSerialEvent);
#endif

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
  String lastWatered = preferences.getString("last_watered", "N/A");

  Serial.print("Retrieved 'last_watered' from NVS: ");
  Serial.println(lastWatered);

  preferences.end();
  Serial.println("Setup complete :)");
}

void loop()
{
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= interval)
  {
    previousMillis = currentMillis;

    // Only print if the serial is connected
    if (isSerialConnected)
    {
      Serial.print("Loop running at: ");
      Serial.println(currentMillis);
    }
  }

  // You can add other non-blocking code here
}