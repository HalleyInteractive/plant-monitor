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

const MAX_LOG_ENTRIES = 100;

@Injectable({
  providedIn: 'root',
})
export class EspService {
  readonly controller = new SerialController();

  // --- State Signals for a Plant Device ---
  readonly connected = signal(false);
  readonly plantName = signal<string | null>(null);
  readonly version = signal<string | null>(null);
  readonly serialLog = signal<string[]>([]);
  readonly parsedResponsesLog = signal<Plant.DeviceResponse[]>([]); // New signal for parsed responses
  readonly flashing = signal<boolean>(false);

  // New state signals based on refined commands
  readonly pinLight = signal<string | null>(null);
  readonly currentLightValue = signal<number | null>(null);
  readonly lightHistory = signal<number[]>([]);
  readonly lightRange = signal<[number, number] | null>(null);
  readonly pinWater = signal<string | null>(null);
  readonly currentWaterValue = signal<number | null>(null);
  readonly waterHistory = signal<number[]>([]);
  readonly waterRange = signal<[number, number] | null>(null);

  constructor() {
    Esp.onFlashProgress(this.controller, (progress, partition) => {
      console.log(
        `[${partition.filename}] Flash progress: ${progress.toFixed(2)}%`,
      );
    })
  }

  async connect() {
    try {
      await Esp.connectToDevice(this.controller);
      this.startResponseListener();
      this.connected.set(true);
      await this.sendCommand(Plant.PlantCommand.CONNECT);
      await this.getDeviceInfo();
      console.log('Connection successful.');
    } catch (error) {
      console.error('Connection failed:', error);
      await this.disconnect(); // Ensure state is reset on failure
    }
  }

  async disconnect() {
    await Esp.disconnectFromDevice(this.controller);
    this.connected.set(false);
    this.plantName.set(null);
    this.version.set(null);
    this.pinLight.set(null);
    this.currentLightValue.set(null);
    this.lightHistory.set([]);
    this.lightRange.set(null);
    this.pinWater.set(null);
    this.currentWaterValue.set(null);
    this.waterHistory.set([]);
    this.waterRange.set(null);
    this.parsedResponsesLog.set([]);
  }

  // --- Command Methods ---
  public async getDeviceInfo() {
    await this.sendCommand(Plant.PlantCommand.GET_VERSION);
    await this.sendCommand(Plant.PlantCommand.GET_PLANT_NAME);
    await this.sendCommand(Plant.PlantCommand.GET_PIN_LIGHT);
    await this.sendCommand(Plant.PlantCommand.GET_PIN_WATER);
    await this.sendCommand(Plant.PlantCommand.GET_HISTORY_LIGHT);
    await this.sendCommand(Plant.PlantCommand.GET_HISTORY_WATER);
    await this.sendCommand(Plant.PlantCommand.GET_RANGE_LIGHT);
    await this.sendCommand(Plant.PlantCommand.GET_RANGE_WATER);
  }

  public setPlantName(name: string) {
    console.log('Setting plant name:', name);
    if (!name) return;
    this.sendCommand(Plant.PlantCommand.SET_PLANT_NAME, name);
  }

  public getPinLight = () => this.sendCommand(Plant.PlantCommand.GET_PIN_LIGHT);
  public setPinLight = (pin: string) => this.sendCommand(Plant.PlantCommand.SET_PIN_LIGHT, pin);
  public getCurrentValueLight = () => this.sendCommand(Plant.PlantCommand.GET_CURRENT_VALUE_LIGHT);
  public getHistoryLight = () => this.sendCommand(Plant.PlantCommand.GET_HISTORY_LIGHT);
  public getRangeLight = () => this.sendCommand(Plant.PlantCommand.GET_RANGE_LIGHT);
  public setRangeLight = (min: string, max: string) => this.sendCommand(Plant.PlantCommand.SET_RANGE_LIGHT, `${min},${max}`);

  public getPinWater = () => this.sendCommand(Plant.PlantCommand.GET_PIN_WATER);
  public setPinWater = (pin: string) => this.sendCommand(Plant.PlantCommand.SET_PIN_WATER, pin);
  public getCurrentValueWater = () => this.sendCommand(Plant.PlantCommand.GET_CURRENT_VALUE_WATER);
  public getHistoryWater = () => this.sendCommand(Plant.PlantCommand.GET_HISTORY_WATER);
  public getRangeWater = () => this.sendCommand(Plant.PlantCommand.GET_RANGE_WATER);
  public setRangeWater = (min: string, max: string) => this.sendCommand(Plant.PlantCommand.SET_RANGE_WATER, `${min},${max}`);
  public setMinMapLight = () => this.sendCommand(Plant.PlantCommand.SET_MIN_MAP_LIGHT);
  public setMaxMapLight = () => this.sendCommand(Plant.PlantCommand.SET_MAX_MAP_LIGHT);
  public setMinMapWater = () => this.sendCommand(Plant.PlantCommand.SET_MIN_MAP_WATER);
  public setMaxMapWater = () => this.sendCommand(Plant.PlantCommand.SET_MAX_MAP_WATER);


  public async flashFirmware() {
    try {
      this.flashing.set(true);
      console.log('Starting firmware flashing in service.');
      await Esp.flashFirmware(this.controller);
      console.log('Firmware flashing completed successfully in service.');
    } catch (error) {
      console.error('Firmware flashing failed in service:', error);
    }
    this.flashing.set(false);
  }

  // --- Private Helpers ---
  private async sendCommand(cmd: Plant.PlantCommand, payload = '') {
    if (!this.connected()) {
      console.warn('Not connected. Cannot send command.');
      return;
    }
    const commandString = Plant.createCommandString(cmd, payload);
    await this.controller.writeToConnection(new TextEncoder().encode(commandString));
    console.log(`Sent: ${commandString.trim()}`);
  }

  private startResponseListener() {
    Esp.startSerialListener(this.controller, (line) => {
      this.addLogEntry(line);
      this.handleResponse(line);
    }).catch(() => {
      // If the listener fails, it means the connection is lost.
      this.disconnect();
    });
  }

  private handleResponse(rawResponse: string) {
    const response = Plant.parseResponse(rawResponse);
    if (!response) {
      // console.warn('Received invalid response:', rawResponse);
      return;
    }

    // Add to parsed responses log
    this.parsedResponsesLog.update(currentResponses => {
      const newResponses = [response, ...currentResponses];
      return newResponses.length > MAX_LOG_ENTRIES ? newResponses.slice(0, MAX_LOG_ENTRIES) : newResponses;
    });


    console.log(`Received Response:`, response);

    if (response.code === Plant.ResponseCode.OK) {
      switch (response.command) {
        case Plant.PlantCommand.CONNECT:
          console.log('Device handshake successful:', response.payload); // Expected: "Ready"
          break;
        case Plant.PlantCommand.GET_VERSION:
          this.version.set(response.payload);
          break;
        case Plant.PlantCommand.GET_PLANT_NAME:
        case Plant.PlantCommand.SET_PLANT_NAME:
          this.plantName.set(response.payload);
          break;
        case Plant.PlantCommand.READ_SENSORS:
          console.log('Sensors read and history updated on device:', response.payload);
          break;
        case Plant.PlantCommand.GET_PIN_LIGHT:
        case Plant.PlantCommand.SET_PIN_LIGHT:
          this.pinLight.set(response.payload);
          break;
        case Plant.PlantCommand.GET_CURRENT_VALUE_LIGHT:
          { const newLightValue = Plant.parseNumericPayload(response.payload)[0] ?? null;
          this.currentLightValue.set(newLightValue);
          if (newLightValue !== null) {
            this.lightHistory.update(history => [...history, newLightValue]);
          }
          break; }
        case Plant.PlantCommand.GET_HISTORY_LIGHT:
          this.lightHistory.set(Plant.parseNumericPayload(response.payload));
          break;
        case Plant.PlantCommand.GET_RANGE_LIGHT:
        case Plant.PlantCommand.SET_RANGE_LIGHT:
          { const [min, max] = Plant.parseNumericPayload(response.payload);
            this.lightRange.set([min, max]);
            break; }
        case Plant.PlantCommand.GET_PIN_WATER:
        case Plant.PlantCommand.SET_PIN_WATER:
          this.pinWater.set(response.payload);
          break;
        case Plant.PlantCommand.GET_CURRENT_VALUE_WATER:
          { const newWaterValue = Plant.parseNumericPayload(response.payload)[0] ?? null;
          this.currentWaterValue.set(newWaterValue);
          if (newWaterValue !== null) {
            this.waterHistory.update(history => [...history, newWaterValue]);
          }
          break; }
        case Plant.PlantCommand.GET_HISTORY_WATER:
          this.waterHistory.set(Plant.parseNumericPayload(response.payload));
          break;
        case Plant.PlantCommand.GET_RANGE_WATER:
        case Plant.PlantCommand.SET_RANGE_WATER:
            { const [min, max] = Plant.parseNumericPayload(response.payload);
            this.waterRange.set([min, max]);
            break; }
      }
    } else {
      console.error(`Device Error (Command: ${response.command}): ${response.payload}`);
    }
  }

  /**
   * Appends a new entry to the serial log and ensures the log
   * does not exceed the maximum number of entries.
   * @param entry The string entry to add to the log.
   */
  private addLogEntry(entry: string) {
    this.serialLog.update(currentLogs => {
      // Create a new array with the new entry appended
      const newLogs = [entry,...currentLogs];

      // If the new array exceeds the max length, slice it from the end
      if (newLogs.length > MAX_LOG_ENTRIES) {
        return newLogs.slice(0, MAX_LOG_ENTRIES);
      }
      return newLogs;
    });
  }
}