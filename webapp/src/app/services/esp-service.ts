import { computed, Injectable, signal } from '@angular/core';
import { BinFilePartition, DataPartitionSubType, ESPImage, NVSPartition, Partition, PartitionTable, PartitionType, SerialController } from 'esp-controller';
import { DiscoveredDevice, PlantCommand, ResponseCode, SensorHistory } from '../models/plant.model';

@Injectable({
  providedIn: 'root'
})
export class EspService {

  controller = new SerialController();
  connected = signal(this.controller.connection.connected);

  // --- Multi-Device State Management ---
  // ID of the device connected directly via Serial
  readonly proxyDeviceId = signal<string | null>(null);
  // ID of the device the user has selected in the UI
  readonly selectedDeviceId = signal<string | null>(null);

  // Store data in Records, keyed by device ID
  readonly deviceNames = signal<Record<string, string>>({});
  readonly plantNames = signal<Record<string, string>>({});
  readonly versions = signal<Record<string, string>>({});
  readonly currentSensorValues = signal<Record<string, number[]>>({});
  readonly sensorHistories = signal<Record<string, SensorHistory[]>>({});
  readonly discoveredDevices = signal<DiscoveredDevice[]>([]);

  // --- Computed Signals for Selected Device ---
  // These make it easy for components to get data for the selected device
  readonly selectedDeviceName = computed(() => this.deviceNames()[this.selectedDeviceId() ?? ''] ?? null);
  readonly selectedPlantName = computed(() => this.plantNames()[this.selectedDeviceId() ?? ''] ?? null);
  readonly selectedVersion = computed(() => this.versions()[this.selectedDeviceId() ?? ''] ?? null);
  readonly selectedSensorValues = computed(() => this.currentSensorValues()[this.selectedDeviceId() ?? ''] ?? []);

  constructor() {
    this.controller.addEventListener("sync-progress", (e) => {
      const event = e as CustomEvent<{ progress: number }>;
      console.log(`Sync progress: ${event.detail.progress.toFixed(2)}%`);
    });

    this.controller.addEventListener("flash-progress", (e) => {
      const event = e as CustomEvent<{ progress: number; partition: Partition }>;
      const partition = event.detail.partition;
      console.log(
        `[${partition.filename}] Flash progress: ${event.detail.progress.toFixed(
          2,
        )}%`,
      );
    });
  }

  async connect() {
    try {
      await this.controller.requestPort()
      await this.controller.openPort();
      this.connected.set(true);
      this._startResponseListener();
      // Get the ID of the device we are directly connected to (the proxy)
      this.sendCommand(PlantCommand.GET_DEVICE_ID, 'broadcast');
      console.log("Connection successful. Current state:", this.controller.connection.connected);
    } catch (error: unknown) {
      console.error("Connection failed:", error);
    }
  }

   // --- Protocol Commands ---
  public getDeviceInfo(deviceId: string) {
    this.sendCommand(PlantCommand.GET_DEVICE_NAME, deviceId);
    this.sendCommand(PlantCommand.GET_PLANT_NAME, deviceId);
    this.sendCommand(PlantCommand.GET_VERSION, deviceId);
    this.sendCommand(PlantCommand.GET_CURRENT_VALUES, deviceId);
    this.sendCommand(PlantCommand.GET_HISTORY, deviceId);
  }

  public listDevices() {
    this.discoveredDevices.set([]);
    const proxyId = this.proxyDeviceId();
    if (proxyId) {
        this.sendCommand(PlantCommand.LIST_DEVICES, proxyId);
    } else {
        console.error("Cannot list devices, proxy ID is unknown.");
    }
  }

  /**
   * Selects a device to be the "active" one for display in components.
   * @param deviceId The MAC address of the device to select.
   */
  public selectDevice(deviceId: string) {
      this.selectedDeviceId.set(deviceId);
  }

  /**
   * Sets the plant name for a specific device.
   * @param name The new name for the plant.
   * @param targetId The MAC address of the target device.
   */
  public setPlantName(name: string, targetId: string) {
    if (!name || !targetId) return;
    this.sendCommand(PlantCommand.SET_PLANT_NAME, targetId, name);
  }

  /**
   * Sets the device name for a specific device.
   * @param name The new name for the device.
   * @param targetId The MAC address of the target device.
   */
  public setDeviceName(name: string, targetId: string) {
    if (!name || !targetId) return;
    this.sendCommand(PlantCommand.SET_DEVICE_NAME, targetId, name);
  }

  // --- Private Helpers ---
  private sendCommand(cmd: PlantCommand, targetId: string, payload = '') {
    if (!this.connected()) {
      console.warn("Not connected. Cannot send command.");
      return;
    }
    const commandString = `${cmd}:${targetId}:${payload}\n`;
    this.controller.writeToConnection(new TextEncoder().encode(commandString));
    console.log(`Sent: ${commandString.trim()}`);
  }

  private async _startResponseListener() {
    const logStreamReader = this.controller.createLogStreamReader();
    console.log("Response listener started.");
    
    try {
      for await (const line of logStreamReader()) {
        if (!line) continue;
        this._parseResponse(line);
      }
    } catch (error) {
      console.error("Error reading from serial port:", error);
    }
  }

  async flashFirmware() {
    await this.controller.sync();
    try {
      const image = this.createImage();
      await this.loadPartitions(image.partitions);
      await this.controller.flashImage(image);
    } catch (error: unknown) {
      console.error("Flashing failed:", error);
    }
  }

  async startSerialLogReader(controller: SerialController) {
  if (!controller.connection.connected) {
    console.warn("Not connected. Cannot start log reader.");
    return;
  }
  
  // Get the async generator for the log stream
  const logStreamReader = controller.createLogStreamReader();

  console.log("Serial log reader started.");
  try {
    // Use a for-await-of loop to read each line from the stream
    for await (const line of logStreamReader()) {
      // Log each line to the browser's console
      console.log(`ESP_LOG: ${line}`);
    }
  } catch (error) {
    console.error("Error reading from serial port:", error);
  } finally {
    console.log("Serial log reader finished.");
  }
}

  private createImage(): ESPImage {
    const image = new ESPImage();

    const bootloader = new BinFilePartition(0x1000, "binaries/happy-plant.ino.bootloader.bin");
    const app = new BinFilePartition(0x10000, "binaries/happy-plant.ino.bin");
    const partitionTable = new PartitionTable([
      {
        name: "nvs",
        type: PartitionType.DATA,
        subType: DataPartitionSubType.NVS,
        offset: 0x9000,
        size: 0x6000,
      },
      {
        name: "factory",
        type: PartitionType.APP,
        subType: 0x00, // factory
        offset: 0x10000,
        size: 0x100000, // 1MB
      },
    ]);

    const nvsPartition = new NVSPartition(0x9000, "nvs.bin", 0x6000);
    nvsPartition.writeEntry("plant", "last_watered", "today");

    image.addPartition(bootloader);
    image.addPartition(app);
    image.addPartition(partitionTable);
    image.addPartition(nvsPartition);

    return image;
  }

  private async loadPartitions(partitions: Partition[]) {
    for (const partition of partitions) {
      // Check if the partition is a BinFilePartition and needs loading
      if (partition instanceof BinFilePartition) {
        console.log(`Loading ${partition.filename}...`);
        const success = await partition.load();
        if (!success) {
          throw new Error(`Failed to load ${partition.filename}`);
        }
        console.log(`${partition.filename} loaded successfully.`);
      }
    }
  }

  /**
   * Parses a raw string from the device and updates the corresponding signal.
   * This is the core of the protocol handling on the client-side.
   * @param rawResponse A single line of text from the serial port.
   */
  private _parseResponse(rawResponse: string) {
    console.log(`Received: ${rawResponse}`);
    const parts = rawResponse.split(':');

    // --- Handle Discovery Responses ---
    // The firmware sends a 3-part "DISCOVERY_RESPONSE" for each device found.
    // Format: DISCOVERY_RESPONSE:<source_id>:<device_name>
    if (parts[0] === 'DISCOVERY_RESPONSE' && parts.length === 3) {
        const [responseCode, sourceId, deviceName] = parts;
        console.log(`Discovery response ${responseCode} from ${sourceId}: ${deviceName}`)
        // Add to the main list of discovered devices if it's not already there.
        this.discoveredDevices.update(devices => {
            if (devices.find(d => d.id === sourceId)) return devices;
            return [...devices, { id: sourceId, name: deviceName }];
        });
        // Update the central device name store.
        this.deviceNames.update(names => ({...names, [sourceId]: deviceName}));
        // Automatically fetch the rest of the info for this newly found device.
        this.getDeviceInfo(sourceId);
        return;
    }

    // --- Handle Standard v2 Responses ---
    // All other responses should follow the 4-part v2 protocol.
    // Format: <RESPONSE_CODE>:<SOURCE_DEVICE_ID>:<ORIGINAL_COMMAND>:<PAYLOAD>
    if (parts.length < 4) {
      console.warn("Received malformed or unhandled message:", rawResponse);
      return;
    }
    
    const [code, sourceId, command, payload] = 
        [parts[0], parts[1], parts[2], parts.slice(3).join(':')] as 
        [ResponseCode, string, PlantCommand, string];

    // The very first 'GET_DEVICE_ID' response identifies our proxy device.
    if (this.proxyDeviceId() === null && command === PlantCommand.GET_DEVICE_ID) {
      this.proxyDeviceId.set(sourceId);
      this.selectedDeviceId.set(sourceId); // Select it by default.
      this.getDeviceInfo(sourceId); // Fetch the rest of its details.
      return;
    }

    // Handle responses based on their code and original command.
    if (code === ResponseCode.OK) {
        switch (command) {
            case PlantCommand.GET_VERSION:
                this.versions.update(vers => ({...vers, [sourceId]: payload}));
                break;
                
            case PlantCommand.GET_DEVICE_NAME:
            case PlantCommand.SET_DEVICE_NAME: // After setting, device responds with its new name
                this.deviceNames.update(names => ({...names, [sourceId]: payload}));
                this.discoveredDevices.update(devices => devices.map(d => 
                    d.id === sourceId ? { ...d, name: payload } : d
                ));
                break;

            case PlantCommand.GET_PLANT_NAME:
            case PlantCommand.SET_PLANT_NAME: // After setting, device responds with its new name
                this.plantNames.update(names => ({...names, [sourceId]: payload}));
                break;

            case PlantCommand.GET_CURRENT_VALUES:
                this.currentSensorValues.update(curr => ({...curr, [sourceId]: this._parsePayload(payload)}));
                break;

            case PlantCommand.GET_HISTORY:
                 // The firmware doesn't implement this yet, but we can handle it when it does.
                console.log(`Received sensor history for ${sourceId}: ${payload}`);
                break;
            case PlantCommand.GET_PINS:
                 console.log(`Received pin configuration for ${sourceId}: ${payload}`);
                 break;
        }
    } else if (code === ResponseCode.DISCOVERY_COMPLETE) {
        // The firmware sends this after a 2-second delay. We don't need to do anything
        // with the payload since we've been collecting individual DISCOVERY_RESPONSE messages.
        // This could be used to hide a "searching for devices..." spinner in the UI.
        console.log("Device discovery phase is complete.");
    } else if (code === ResponseCode.ERROR) {
        console.error(`Device Error from ${sourceId} (Command: ${command}): ${payload}`);
    }
  }

  private _parsePayload(payload: string): number[] {
    return payload.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
  }

  async disconnect() {
    await this.controller.disconnect();
    this.connected.set(false);
    this.proxyDeviceId.set(null);
    this.selectedDeviceId.set(null);
    this.deviceNames.set({});
    this.plantNames.set({});
    this.versions.set({});
    this.currentSensorValues.set({});
    this.sensorHistories.set({});
    this.discoveredDevices.set([]);
  }

}
