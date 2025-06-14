/**
 * Defines the communication protocol between the Angular app and the ESP32 plant monitor.
 */

// Mirrors the command enum in the ESP32 firmware
export enum PlantCommand {
  CONNECT = 'CONNECT',
  GET_VERSION = 'GET_VERSION',
  GET_PINS = 'GET_PINS',
  SET_PINS = 'SET_PINS',
  GET_PLANT_NAME = 'GET_PLANT_NAME',
  SET_PLANT_NAME = 'SET_PLANT_NAME',
  GET_CURRENT_VALUES = 'GET_CURRENT_VALUES',
  GET_HISTORY = 'GET_HISTORY',
  SET_DEVICE_TYPE = 'SET_DEVICE_TYPE',
  GET_DEVICE_ID = 'GET_DEVICE_ID',
  GET_DEVICE_NAME = 'GET_DEVICE_NAME',
  SET_DEVICE_NAME = 'SET_DEVICE_NAME',
  LIST_DEVICES = 'LIST_DEVICES',
  // Internal commands, not typically sent from the app directly
  DISCOVER_DEVICES = 'DISCOVER_DEVICES',
  DISCOVERY_RESPONSE = 'DISCOVERY_RESPONSE',
  PROXY = 'PROXY',
}

// Mirrors the response codes in the ESP32 firmware
export enum ResponseCode {
  OK = 'OK',
  ERROR = 'ERROR',
  DISCOVERY_COMPLETE = 'DISCOVERY_COMPLETE',
}

// Interface for a parsed response from the device
export interface DeviceResponse {
  raw: string;
  code: ResponseCode;
  sourceId: string;
  payload: string;
  command?: PlantCommand; // Optional: to help identify what the response is for
}

// Interface for a discovered device
export interface DiscoveredDevice {
  id: string;
  name: string;
}

// Interface for a sensor's history data
export interface SensorHistory {
    name: string;
    values: number[];
}
