import { Injectable, signal } from '@angular/core';
import { BinFilePartition, DataPartitionSubType, ESPImage, NVSPartition, Partition, PartitionTable, PartitionType, SerialController } from 'esp-controller';

@Injectable({
  providedIn: 'root'
})
export class EspService {

  controller = new SerialController();
  connected = signal(this.controller.connection.connected);

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
      this.connected.set(this.controller.connection.connected);
      console.log("Connection successful. Current state:", this.controller.connection.connected);
    } catch (error: unknown) {
      console.error("Connection failed:", error);
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

  async disconnect() {
    // await this.controller.closePort();
    console.log('GOGOGO')
    // await this.flashFirmware();
    this.startSerialLogReader(this.controller)
  }

}
