/**
 * esp.model.ts
 *
 * Contains functions for low-level interaction with the ESP32 device using the
 * esp-controller library. This includes connecting, disconnecting, flashing,
 * and reading serial data.
 */

import { SerialController, Partition, ESPImage, BinFilePartition, PartitionTable, PartitionType, DataPartitionSubType, NVSPartition } from 'esp-controller';

/**
 * Opens the serial port connection to the ESP32.
 * @param controller The SerialController instance.
 */
export async function connectToDevice(controller: SerialController): Promise<void> {
  await controller.requestPort();
  await controller.openPort();
}

/**
 * Closes the serial port connection.
 * @param controller The SerialController instance.
 */
export async function disconnectFromDevice(controller: SerialController): Promise<void> {
  if (controller.connection.connected) {
    await controller.connection.readable?.cancel('Cancelled by the user');
    await controller.disconnect();
  }
}

/**
 * Starts a listener on the serial port that invokes a callback for each line received.
 * @param controller The SerialController instance.
 * @param onLineReceived A callback function to handle each line of data.
 */
export async function startSerialListener(
  controller: SerialController,
  onLineReceived: (line: string) => void,
): Promise<void> {
  if (!controller.connection.connected) {
    throw new Error('Cannot start listener: device not connected.');
  }

  const logStreamReader = controller.createLogStreamReader();
  try {
    for await (const line of logStreamReader()) {
      if (line) {
        onLineReceived(line);
      }
    }
  } catch (error) {
    console.error('Error reading from serial port:', error);
    // Re-throw to be handled by the calling service
    throw error;
  }
}

/**
 * Initiates the firmware flashing process on the connected device.
 * @param controller The active SerialController for the device.
 */
export async function flashFirmware(controller: SerialController): Promise<void> {
  if (!controller.connection.connected) {
    throw new Error('Device is not connected.');
  }
  console.log('Starting firmware flash...');

 await controller.sync();
    try {
      const image = createImage();
      await loadPartitions(image.partitions);
      await controller.flashImage(image);
    } catch (error: unknown) {
      console.error("Flashing failed:", error);
      throw error;
    }
}

/**
 * Attaches an event listener to report firmware flashing progress.
 * @param controller The SerialController instance.
 * @param onProgress A callback to handle progress updates.
 */
export function onFlashProgress(
  controller: SerialController,
  onProgress: (progress: number, partition: Partition) => void,
): void {
  controller.addEventListener('flash-progress', (e) => {
    const event = e as CustomEvent<{ progress: number; partition: Partition }>;
    onProgress(event.detail.progress, event.detail.partition);
  });
}

function createImage(): ESPImage {
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

async function loadPartitions(partitions: Partition[]) {
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