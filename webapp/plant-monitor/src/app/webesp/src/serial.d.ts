/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** @see https://wicg.github.io/serial/#paritytype-enum */
type ParityType = 'none' | 'even' | 'odd';

/** @see https://wicg.github.io/serial/#flowcontroltype-enum */
type FlowControlType = 'none' | 'hardware';

/** @see https://wicg.github.io/serial/#serialoptions-dictionary */
interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: ParityType;
  bufferSize?: number;
  flowControl?: FlowControlType;
}

/** @see https://wicg.github.io/serial/#serialinputsignals-dictionary */
interface SerialInputSignals {
  dataCarrierDetect: boolean;
  clearToSend: boolean;
  ringIndicator: boolean;
  dataSetReady: boolean;
}

/** @see https://wicg.github.io/serial/#serialoutputsignals-dictionary */
interface SerialOutputSignals {
  dataTerminalReady?: boolean;
  readyToSend?: boolean;
  break?: boolean;
}

/** @see https://wicg.github.io/serial/#serialport-interface */
declare class SerialPort {
  onconnect: EventHandlerNonNull|null;
  ondisconnect: EventHandlerNonNull|null;  
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;

  getInfo(): Promise<SerialOptions>;

  open(options?: SerialOptions): Promise<void>;
  setSignals(signals: SerialOutputSignals): Promise<void>;
  getSignals(): Promise<SerialInputSignals>;
  close(): Promise<void>;
}

/** @see https://source.chromium.org/chromium/chromium/src/+/master:third_party/blink/renderer/modules/serial/serial_port_filter.idl */
interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

/** @see https://source.chromium.org/chromium/chromium/src/+/master:third_party/blink/renderer/modules/serial/serial_port_request_options.idl */
interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

/** @see https://source.chromium.org/chromium/chromium/src/+/master:third_party/blink/renderer/modules/serial/serial_connection_event_init.idl */
interface SerialConnectionEventInit extends EventInit {
  port: SerialPort;
}

/** @see https://source.chromium.org/chromium/chromium/src/+/master:third_party/blink/renderer/modules/serial/serial_connection_event.idl */
declare class SerialConnectionEvent extends Event {
  constructor(type: string, eventInitDict: SerialConnectionEventInit);
  readonly port: SerialPort;
}

/** @see https://wicg.github.io/serial/#serial-interface */
declare class Serial extends EventTarget {
  onconnect(): ((this: this, ev: SerialConnectionEvent) => any) | null;
  ondisconnect(): ((this: this, ev: SerialConnectionEvent) => any) | null;
  getPorts(): Promise<SerialPort[]>;
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  addEventListener(
      type: 'connect' | 'disconnect',
      listener: (this: this, ev: SerialConnectionEvent) => any,
      useCapture?: boolean): void;
  addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions): void;
  removeEventListener(
      type: 'connect' | 'disconnect',
      callback: (this: this, ev: SerialConnectionEvent) => any,
      useCapture?: boolean): void;
  removeEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: EventListenerOptions | boolean): void;
}

/** @see https://wicg.github.io/serial/#extensions-to-the-navigator-interface */
interface Navigator {
  readonly serial: Serial;
}

/** @see https://wicg.github.io/serial/#extensions-to-workernavigator-interface */
interface WorkerNavigator {
  readonly serial: Serial;
}