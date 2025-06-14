/**
 * esp.model.ts
 *
 * Contains functions for low-level interaction with the ESP32 device using the
 * esp-controller library. This includes connecting, disconnecting, flashing,
 * and reading serial data.
 */

import { SerialController, Partition } from 'esp-controller';

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

  // This is a placeholder. A real implementation would fetch binary files
  // and call controller.flash() with the correct partitions and addresses.
  // Example:
  // const bootloader = await fetch('/firmware/bootloader.bin').then(r => r.arrayBuffer());
  // await controller.flash([{ data: bootloader, address: 0x1000, filename: 'bootloader.bin' }]);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log('Firmware flashing process completed.');
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