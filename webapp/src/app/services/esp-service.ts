/**
 * esp-service.ts
 *
 * The central service for managing the connection to the plant monitor.
 * It holds the application state and orchestrates calls to the hardware
 * and protocol models.
 */

import { Injectable, signal } from '@angular/core';
import { SerialController } from 'esp-controller';
import * as Esp from '../models/esp.model';
import * as Plant from '../models/plant.model';

@Injectable({
  providedIn: 'root',
})
export class EspService {
  private readonly controller = new SerialController();

  // --- State Signals for a Single Device ---
  readonly connected = signal(false);
  readonly deviceId = signal<string | null>(null);
  readonly deviceName = signal<string | null>(null);
  readonly plantName = signal<string | null>(null);
  readonly version = signal<string | null>(null);
  readonly currentSensorValues = signal<number[]>([]);
  readonly sensorHistory = signal<Plant.SensorHistory[]>([]);

  constructor() {
    Esp.onFlashProgress(this.controller, (progress, partition) => {
      console.log(
        `[${partition.filename}] Flash progress: ${progress.toFixed(2)}%`,
      );
    });
  }

  async connect() {
    try {
      await Esp.connectToDevice(this.controller);
      this.connected.set(true);
      this.startResponseListener();
      this.getDeviceInfo();
      console.log('Connection successful.');
    } catch (error) {
      console.error('Connection failed:', error);
      await this.disconnect(); // Ensure state is reset on failure
    }
  }

  async disconnect() {
    await Esp.disconnectFromDevice(this.controller);
    this.connected.set(false);
    this.deviceId.set(null);
    this.deviceName.set(null);
    this.plantName.set(null);
    this.version.set(null);
    this.currentSensorValues.set([]);
    this.sensorHistory.set([]);
  }

  // --- Command Methods ---

  public getDeviceInfo() {
    this.sendCommand(Plant.PlantCommand.GET_DEVICE_ID);
    this.sendCommand(Plant.PlantCommand.GET_DEVICE_NAME);
    this.sendCommand(Plant.PlantCommand.GET_PLANT_NAME);
    this.sendCommand(Plant.PlantCommand.GET_VERSION);
    this.sendCommand(Plant.PlantCommand.GET_CURRENT_VALUES);
  }

  public setPlantName(name: string) {
    if (!name) return;
    this.sendCommand(Plant.PlantCommand.SET_PLANT_NAME, name);
  }

  public setDeviceName(name: string) {
    if (!name) return;
    this.sendCommand(Plant.PlantCommand.SET_DEVICE_NAME, name);
  }

  public async flashFirmware() {
    try {
      await Esp.flashFirmware(this.controller);
      console.log('Firmware flashing completed successfully in service.');
    } catch (error) {
      console.error('Firmware flashing failed in service:', error);
    }
  }

  // --- Private Helpers ---

  private sendCommand(cmd: Plant.PlantCommand, payload = '') {
    if (!this.connected()) {
      console.warn('Not connected. Cannot send command.');
      return;
    }
    const commandString = Plant.createCommandString(cmd, payload);
    this.controller.writeToConnection(new TextEncoder().encode(commandString));
    console.log(`Sent: ${commandString.trim()}`);
  }

  private startResponseListener() {
    Esp.startSerialListener(this.controller, (line) => {
      this.handleResponse(line);
    }).catch(() => {
      // If the listener fails, it means the connection is lost.
      this.disconnect();
    });
  }

  private handleResponse(rawResponse: string) {
    const response = Plant.parseResponse(rawResponse);
    if (!response) {
      // Might be a standard ESP_LOG, not a protocol response.
      // console.log(`ESP_LOG: ${rawResponse}`);
      return;
    }

    console.log(`Received Response:`, response);

    if (this.deviceId() === null) {
      this.deviceId.set(response.sourceId);
    }

    if (response.code === Plant.ResponseCode.OK) {
      switch (response.command) {
        case Plant.PlantCommand.GET_VERSION:
          this.version.set(response.payload);
          break;
        case Plant.PlantCommand.GET_DEVICE_NAME:
        case Plant.PlantCommand.SET_DEVICE_NAME:
          this.deviceName.set(response.payload);
          break;
        case Plant.PlantCommand.GET_PLANT_NAME:
        case Plant.PlantCommand.SET_PLANT_NAME:
          this.plantName.set(response.payload);
          break;
        case Plant.PlantCommand.GET_CURRENT_VALUES:
          this.currentSensorValues.set(
            Plant.parseNumericPayload(response.payload),
          );
          break;
        case Plant.PlantCommand.GET_DEVICE_ID:
            this.deviceId.set(response.payload);
            break;
        // Add other command handlers (e.g., GET_HISTORY) here
      }
    } else {
      console.error(`Device Error (Command: ${response.command}): ${response.payload}`);
    }
  }
}