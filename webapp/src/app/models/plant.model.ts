/**
 * plant.model.ts
 *
 * Defines the communication protocol (commands, responses, and parsers)
 * for the ESP32 plant monitor application.
 */

// Mirrors the command enum in the ESP32 firmware
export enum PlantCommand {
  CONNECT = 'CONNECT',
  GET_VERSION = 'GET_VERSION',
  GET_PLANT_NAME = 'GET_PLANT_NAME',
  SET_PLANT_NAME = 'SET_PLANT_NAME',
  READ_SENSORS = 'READ_SENSORS',
  GET_PIN_LIGHT = 'GET_PIN_LIGHT',
  SET_PIN_LIGHT = 'SET_PIN_LIGHT',
  GET_CURRENT_VALUE_LIGHT = 'GET_CURRENT_VALUE_LIGHT',
  GET_HISTORY_LIGHT = 'GET_HISTORY_LIGHT',
  GET_RANGE_LIGHT = 'GET_RANGE_LIGHT',
  SET_RANGE_LIGHT = 'SET_RANGE_LIGHT',
  GET_PIN_WATER = 'GET_PIN_WATER',
  SET_PIN_WATER = 'SET_PIN_WATER',
  GET_CURRENT_VALUE_WATER = 'GET_CURRENT_VALUE_WATER',
  GET_HISTORY_WATER = 'GET_HISTORY_WATER',
  GET_RANGE_WATER = 'GET_RANGE_WATER',
  SET_RANGE_WATER = 'SET_RANGE_WATER',
  SET_MIN_MAP_LIGHT = 'SET_MIN_MAP_LIGHT',
  SET_MAX_MAP_LIGHT = 'SET_MAX_MAP_LIGHT',
  SET_MIN_MAP_WATER = 'SET_MIN_MAP_WATER',
  SET_MAX_MAP_WATER = 'SET_MAX_MAP_WATER',
}

// Mirrors the response codes in the ESP32 firmware
export enum ResponseCode {
  OK = 'OK',
  ERROR = 'ERROR',
}

// Interface for a sensor's history data
export interface SensorHistory {
  name: string;
  values: number[];
}

// Interface for a parsed response from the device
export interface DeviceResponse {
  raw: string;
  code: ResponseCode;
  command: PlantCommand;
  payload: string;
}

/**
 * Creates a command string to be sent to the device.
 * Format: <COMMAND>\n or <COMMAND>:<PAYLOAD>\n
 * @param cmd The command to send.
 * @param payload Optional data for the command.
 * @returns A formatted command string.
 */
export function createCommandString(cmd: PlantCommand, payload = ''): string {
  return payload ? `${cmd}:${payload}\n` : `${cmd}\n`;
}

/**
 * Parses a raw response string from the device into a structured object.
 * @param rawResponse The raw string from the serial port.
 * @returns A structured DeviceResponse object, or null if parsing fails.
 */
export function parseResponse(rawResponse: string): DeviceResponse | null {
  // Expected format: <RESPONSE_CODE>:<ORIGINAL_COMMAND>:<PAYLOAD>
  const parts = rawResponse.trim().split(':', 3); // Limit split to 3 parts
  if (parts.length < 2) { // Must have at least CODE and COMMAND
    return null; // Ignore malformed messages
  }

  const code = parts[0] as ResponseCode;
  const command = parts[1] as PlantCommand;
  const payload = parts[2] || ''; // Payload can be empty

  return {
    raw: rawResponse,
    code,
    command,
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