/**
 * plant.model.ts
 *
 * Defines the communication protocol (commands, responses, and parsers)
 * for the ESP32 plant monitor application.
 */

// Mirrors the command enum in the ESP32 firmware
export enum PlantCommand {
  GET_VERSION = 'GET_VERSION',
  GET_PINS = 'GET_PINS',
  SET_PINS = 'SET_PINS',
  GET_PLANT_NAME = 'GET_PLANT_NAME',
  SET_PLANT_NAME = 'SET_PLANT_NAME',
  GET_CURRENT_VALUES = 'GET_CURRENT_VALUES',
  GET_HISTORY = 'GET_HISTORY',
  GET_DEVICE_ID = 'GET_DEVICE_ID',
  GET_DEVICE_NAME = 'GET_DEVICE_NAME',
  SET_DEVICE_NAME = 'SET_DEVICE_NAME',
}

// Mirrors the response codes in the ESP32 firmware
export enum ResponseCode {
  OK = 'OK',
  ERROR = 'ERROR',
}

// Interface for a parsed response from the device
export interface DeviceResponse {
  raw: string;
  code: ResponseCode;
  sourceId: string;
  command: PlantCommand;
  payload: string;
}

// Interface for a sensor's history data
export interface SensorHistory {
  name: string;
  values: number[];
}

/**
 * Creates a command string to be sent to the device.
 * Format: <COMMAND>:<PAYLOAD>\n
 * @param cmd The command to send.
 * @param payload Optional data for the command.
 * @returns A formatted command string.
 */
export function createCommandString(cmd: PlantCommand, payload = ''): string {
  return `${cmd}:${payload}\n`;
}

/**
 * Parses a raw response string from the device into a structured object.
 * @param rawResponse The raw string from the serial port.
 * @returns A structured DeviceResponse object, or null if parsing fails.
 */
export function parseResponse(rawResponse: string): DeviceResponse | null {
  // Expected format: <CODE>:<SOURCE_ID>:<COMMAND>:<PAYLOAD>
  const parts = rawResponse.split(':');
  if (parts.length < 4) {
    return null; // Ignore malformed messages
  }

  const [code, sourceId, command, ...payloadParts] = parts;
  const payload = payloadParts.join(':');

  return {
    raw: rawResponse,
    code: code as ResponseCode,
    sourceId,
    command: command as PlantCommand,
    payload,
  };
}

/**
 * Parses a comma-separated string of numbers into an array.
 * @param payload The payload string to parse.
 * @returns An array of numbers.
 */
export function parseNumericPayload(payload: string): number[] {
  return payload
    .split(',')
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !isNaN(v));
}