import { sleep } from "./../utils/common";
import { WebespTerminalService } from "src/app/webesp-terminal.service";

export class PortController {
  connected: boolean = false;
  portReader: Promise<void> | null = null;
  reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  rate: BaudRate = 115200;

  constructor(private port: SerialPort, private target: StreamTarget, private readonly terminal:WebespTerminalService) { }

  async connect(rate: BaudRate) {
    await this.port.open({ baudRate: rate, dataBits: 8, stopBits: 1, bufferSize: 255, parity: 'none', flowControl: 'none' });
    this.connected = true;
    this.rate = rate;
    this.terminal.print("Serial port opened at " + this.rate + " bps.");

    // Start the read loop, keep the promise so we can check later for termination. 
    this.portReader = this.readLoop();
  }

  async disconnect() {
    if (!this.connected) return;
    this.connected = false;
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }

    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }

    await this.portReader;  // Wait for the read loop to terminate.
    await this.port.close();
    this.terminal.print("Serial port closed.");
  }

  /**
   * Writes the provided data to the port.
   * @param data Byte array to write.
   */
  async write(data: Uint8Array) {
    this.writer = this.port.writable.getWriter();
    await this.writer.write(data);
    this.writer.releaseLock();
    this.writer = null;
  }

  /**
   * Reads from the serial port until something happens.
   */
  async readLoop() {
    while (this.connected) {
      try {
        this.reader = this.port.readable.getReader();
        for (; ;) {
          const { value, done } = await this.reader.read();
          if (value) {
            this.target.receive(value);
          }
          if (done) {
            break;
          }
        }
        console.log('Releasing reader.');
        this.reader.releaseLock();
        this.reader = null;
      } catch (e) {
        console.error(e);
      }
      console.log('Restarting read loop.');
    }
    console.log('Left read loop.');
  }

  async resetPulse() {
    this.port.setSignals({ dataTerminalReady: false, readyToSend: true });
    await sleep(100);
    this.port.setSignals({ dataTerminalReady: true, readyToSend: false });
    await sleep(50);
  }
}