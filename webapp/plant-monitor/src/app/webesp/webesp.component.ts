import { Component, OnInit } from '@angular/core';
import { WebespConfigService } from '../webesp-config.service';
import { WebespTerminalService } from '../webesp-terminal.service';

interface StreamTarget {
  receive(data: Uint8Array): void;
}

// Supported commands. https://github.com/espressif/esptool/wiki/Serial-Protocol
enum Command {
  ESP_FLASH_BEGIN = 0x02,
  ESP_FLASH_DATA = 0x03,
  ESP_FLASH_END = 0x04,
  ESP_MEM_BEGIN = 0x05,
  ESP_MEM_END = 0x06,
  ESP_MEM_DATA = 0x07,
  ESP_SYNC = 0x08,
  ESP_READ_REG = 0x0a,
  ESP_SPI_SET_PARAMS = 0x0b,
  ESP_SPI_ATTACH = 0x0d,
  ESP_CHANGE_BAUDRATE = 0x0f,
}

enum ChipFamily {
  UNKNOWN = 0,
  ESP8266 = 1,
  ESP32 = 2,
  ESP32S2 = 3,
}
const familyNames = ['Unknown', 'ESP8266', 'ESP32', 'ESP32S2'];

type BaudRate = 115200 | 230400 | 460800 | 921600;

@Component({
  selector: 'app-webesp',
  templateUrl: './webesp.component.html',
  styleUrls: ['./webesp.component.sass']
})
export class WebespComponent implements OnInit {

  static DEFAULT_BAUD: BaudRate = 115200;

  public hideWifiPassword: boolean = true;
  public hideFirebasePassword: boolean = true;

  port: PortController | null = null;
  private inFrame = false;
  frame = new CommandWriter();
  decoder = new TextDecoder();
  loader: ESPLoader | null = null;

  serialAvailable: Boolean = false;
  constructor(public terminal: WebespTerminalService, public config:WebespConfigService) {

  }

  ngOnInit(): void {
    if ('serial' in navigator) {
      this.serialAvailable = true;
    }
  }

  async onDisconnect() {
    if (this.port !== null) {
      await this.port.disconnect();
      this.port = null;
    }
  }

  async onConnect() {
    try {
      const p = await navigator.serial.requestPort();
      console.log(p);
      this.port = new PortController(p, this, this.terminal);

      await this.port.connect(WebespComponent.DEFAULT_BAUD);
    } catch (err) {
      console.log('Port selection failed: ', err);
    }
  }

  async onReset() {
    this.terminal.print('reset');
    await this.port!.resetPulse();
  }

  receive(data: Uint8Array) {
    //inputBuffer.push(...value);
    for (let i = 0; i < data.length; ++i) {
      // Parse the value.
      if (this.inFrame) {
        if (data[i] == 0xc0) {
          this.inFrame = false;
          if (this.loader == null) {
            console.log('Received unexpected frame', data);
          } else {
            this.loader!.receiveFrame(this.frame.unframed());
          }
        } else {
          this.frame.u8(data[i]);
        }
      } else if (data[i] == 0xc0) {
        // This may be the beginning of a framed packet.
        this.inFrame = true;
        this.frame.clear();
      } else if (data[i] == 13) {
        const str = this.decoder.decode(this.frame.get());
        this.terminal.write(str);
        this.frame.clear();
        if (str == 'waiting for download') {
          this.load();
        }
      } else if (data[i] != 10) {
        this.frame.u8(data[i]);
      }
    }
  }

  async load() {
    console.log('Starting sync');
    const image = new ESPImage(this.terminal, this.config);
    await image.load();
    this.loader = new ESPLoader(this.port!, image, this.terminal);
    await this.loader.sync();
  }

}

class Partition {
  utf8Encoder = new TextEncoder();
  utf8Decoder = new TextDecoder();
  binary: Uint8Array = new Uint8Array(0);
  placeholders: { [key: string]: number; } = {};

  constructor(public readonly offset: number, public readonly filename: string, private terminal: WebespTerminalService, private config: WebespConfigService) {
  }

  async load(): Promise<boolean> {
    this.binary = new Uint8Array(await (await fetch(this.filename)).arrayBuffer());
    this.terminal.print('Loaded ' + this.filename);

    const p = this.utf8Encoder.encode('PLACEHOLDER_FOR');
    for (let k = 0; k < this.binary.length; ++k) {
      let j = 0;
      for (; j < p.length; ++j) {
        if (this.binary[k + j] != p[j]) break;
      }
      if (j == p.length) {
        // Found something.
        const s = this.utf8Decoder.decode(this.binary.slice(k, k + 60));
        const ss = s.split('*');
        console.log(ss[0], s);
        this.placeholders[ss[0]] = k;
      }
    }
    return true;
  }

  private patch(off: number, str: string, len: number) {
    const sb = this.utf8Encoder.encode(str);
    for (let i = 0; i < sb.length; ++i) {
      this.binary[off + i] = sb[i];
    }
    for (let i = sb.length; i < len; ++i) {
      this.binary[off + i] = 0;
    }
  }

  async sha256(buf: Uint8Array) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buf.buffer);
    return new Uint8Array(hashBuffer);
  }

  private async binChecksum() {
    // Update checksum after applying patches.
    const b = this.binary;
    const segs = b[1];
    let soff = 24;
    let cs = 0xef;
    for (let i = 0; i < segs; ++i) {
      const sl = b[soff + 4] + (b[soff + 5] << 8) + (b[soff + 6] << 16) + (b[soff + 7] << 24);
      for (let j = 0; j < sl; ++j) {
        cs ^= b[soff + 8 + j];
      }
      soff += 8 + sl;
    }
    b[b.length - 33] = cs;

    // Update sha256 hash of image,
    const hash = await this.sha256(b.slice(0, b.length - 32));
    for (let i = 0; i < hash.length; ++i) {
      b[b.length - 32 + i] = hash[i];
    }
  }

  async applyPatches() {
    const placeholderMappding = this.config.getPlaceholderMapping();
    if (this.placeholders.length == 0) return;
    for (let k in this.placeholders) {
      if(placeholderMappding.has(k)) {
        const placeholderData = placeholderMappding.get(k);
        this.patch(this.placeholders[k], placeholderData.value, placeholderData.length);
      }
    }
    return this.binChecksum();
  }
}

class ESPImage {
  partitions: Array<Partition> = [];

  constructor(private terminal: WebespTerminalService, private config:WebespConfigService) { }

  async load() {
    this.partitions.push(new Partition(0x8000, 'assets/bin/partition-table.bin', this.terminal, this.config));
    // this.partitions.push(new Partition(0x1000, 'assets/bin/bootloader.bin'));
    this.partitions.push(new Partition(0x10000, 'assets/bin/simple.bin', this.terminal, this.config));

    for (let i = 0; i < this.partitions.length; ++i) {
      await this.partitions[i].load();
      await this.partitions[i].applyPatches();
    }
  }

}

/**
 * Asynchronous sleep helper function.
 * Typical usage in an async function would be
 *    await sleep(ms);
 * @param ms Time to sleep in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hex2(v: number) {
  const s = v.toString(16);
  if (s.length == 1) return '0' + s;
  return s;
}

class CommandWriter {
  buf: Uint8Array;
  off = 0;

  constructor() {
    this.buf = new Uint8Array(1024);
  }
  clear() {
    this.off = 0;
  }
  get() {
    return this.buf.slice(0, this.off);
  }
  framed() {
    let ol = this.off + 2;
    for (let i = 0; i < this.off; ++i) {
      if (this.buf[i] == 0xdb || this.buf[i] == 0xc0) ol++;
    }
    const o = new Uint8Array(ol);
    let oo = 0;
    o[oo++] = 0xc0;
    for (let i = 0; i < this.off; ++i) {
      const b = this.buf[i];
      if (b == 0xdb) {
        o[oo++] = 0xdb;
        o[oo++] = 0xdd;
      } else if (b == 0xc0) {
        o[oo++] = 0xdb;
        o[oo++] = 0xdc;
      } else {
        o[oo++] = b;
      }
    }
    o[oo++] = 0xc0;
    return o;
  }
  unframed() {
    let ol = this.off;
    for (let i = 0; i < this.off; ++i) {
      if (this.buf[i] == 0xdb) ol--;
    }
    const o = new Uint8Array(ol);
    let oo = 0;
    for (let i = 0; i < this.off; ++i) {
      let b = this.buf[i];
      if (b == 0xdb) {
        b = this.buf[++i];
        if (b == 0xdd) {
          o[oo++] = 0xdb;
        } else if (b == 0xdc) {
          o[oo++] = 0xc0;
        }
      } else {
        o[oo++] = b;
      }
    }
    return o;
  }
  private ensure(n: number) {
    if (this.off + n <= this.buf.length) return;
    const nbuf = new Uint8Array(((this.buf.length + n + 1023) >> 10) << 10);
    for (let i = 0; i < this.buf.length; ++i) {
      nbuf[i] = this.buf[i];
    }
    this.buf = nbuf;
  }
  u8(v: number) {
    this.ensure(1);
    this.buf[this.off] = v & 0xff;
    this.off += 1;
    return this;
  }
  u16(v: number) {
    this.ensure(2);
    this.buf[this.off] = v & 0xff;
    this.buf[this.off + 1] = (v >> 8) & 0xff;
    this.off += 2;
    return this;
  }
  u32(v: number) {
    this.ensure(4);
    this.buf[this.off] = v & 0xff;
    this.buf[this.off + 1] = (v >> 8) & 0xff;
    this.buf[this.off + 2] = (v >> 16) & 0xff;
    this.buf[this.off + 3] = (v >> 24) & 0xff;
    this.off += 4;
    return this;
  }
  buffer(b: Uint8Array) {
    this.ensure(b.length);
    for (let i = 0; i < b.length; ++i) {
      this.buf[this.off + i] = b[i];
    }
    this.off += b.length;
    return this;
  }
}

class ResponseReader {
  off = 0;
  length = 0;

  constructor(public value: number, public data: Uint8Array) {
    this.length = data.length;
  }
  u8(): number {
    let v = this.data[this.off];
    this.off += 1;
    return v;
  }
  u16(): number {
    let v = this.data[this.off] + (this.data[this.off + 1] << 8);
    this.off += 2;
    return v;
  }
  u32(): number {
    let v = this.data[this.off] + (this.data[this.off + 1] << 8) + (this.data[this.off + 2] << 16) + (this.data[this.off + 3] << 24);
    this.off += 4;
    return v;
  }
}

class PortController {
  connected: boolean = false;
  portReader: Promise<void> | null = null;
  reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  rate: BaudRate = 115200;

  constructor(private port: SerialPort, private target: StreamTarget, private terminal: WebespTerminalService) { }

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

class ESPLoader {
  private ready = false;
  private chipFamily = ChipFamily.UNKNOWN;
  private eFuses: Array<number> = [0, 0, 0, 0];
  private macAddress: Array<number> = [0, 0, 0, 0, 0, 0];
  public progress:number = 0;

  constructor(private readonly port: PortController, private readonly image: ESPImage, private terminal: WebespTerminalService) {
  }

  async sync() {
    for (let i = 0; i < 10; i++) {
      this.terminal.print("Sync attempt #" + (i + 1) + " of 10");

      await this.sendCommand(Command.ESP_SYNC, new Uint8Array([
        0x07, 0x07, 0x12, 0x20,
        0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
        0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
        0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
        0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55]));
      let responseCount = 0;
      for (let j = 0; j < 8; ++j) {
        const data = await this.response(Command.ESP_SYNC, 100);
        if (data === null) {
          continue;
        }
        if (data.length > 1 && data.u16() == 0) {
          responseCount++;
        }
      }
      if (responseCount > 0) {
        console.log('Received ' + responseCount + ' frames');
        this.ready = true;
        break;
      }
    }
    if (!this.ready) return false;
    await sleep(100);
    await this.readChipFamily();
    await this.readEfuses();
    this.terminal.print('Chip family: ' + familyNames[this.chipFamily]);
    this.terminal.print('MAC Address: ' + this.macAddress.map(value => hex2(value)).join(":"));
    for (let i = 0; i < this.image.partitions.length; ++i) {
      this.terminal.print('Flashing section ' + i);
      await this.flashData(this.image.partitions[i].binary, this.image.partitions[i].offset);
    }
    await this.port.resetPulse();
    return true;
  }

  async readChipFamily() {
    const r = await this.readReg(0x60000078);

    if (r == 0x15122500) {
      this.chipFamily = ChipFamily.ESP32;
    } else if (r == 0x500) {
      this.chipFamily = ChipFamily.ESP32S2;
    } else if (r == 0x00062000) {
      this.chipFamily = ChipFamily.ESP8266;
    }
  };

  async readEfuses() {
    let baseAddr = [0, 0x3FF00050, 0x6001A000, 0x6001A000][this.chipFamily];
    for (let i = 0; i < 4; i++) {
      this.eFuses[i] = await this.readReg(baseAddr + 4 * i);
    }

    // Parse MAC Address out of fuses, this is valid for ESP32 / ESP32S2
    this.macAddress[0] = (this.eFuses[2] >> 8) & 0xff;
    this.macAddress[1] = this.eFuses[2] & 0xff;
    this.macAddress[2] = (this.eFuses[1] >> 24) & 0xff;
    this.macAddress[3] = (this.eFuses[1] >> 16) & 0xff;
    this.macAddress[4] = (this.eFuses[1] >> 8) & 0xff;
    this.macAddress[5] = this.eFuses[1] & 0xff;
  };

  async readReg(reg: number) {
    let r = await this.command(Command.ESP_READ_REG, new CommandWriter().u32(reg).get());
    if (r == null) {
      console.error("No response received");
      return 0;
    }
    if (r.u32() == 0) return r.value;
    return 0;
  };

  async setBaudrate(rate: BaudRate) {
    console.log("Sending baud rate change command to ESP32: " + rate);
    await this.command(Command.ESP_CHANGE_BAUDRATE, new CommandWriter().u32(rate).u32(0).get());
    await sleep(500);

    console.log("Changing serial port baud rate to: " + rate);
    await this.port.disconnect();
    await this.port.connect(rate);

    console.log("Sending baud rate change command to ESP32 again: " + rate);
    await this.command(Command.ESP_CHANGE_BAUDRATE, new CommandWriter().u32(rate).u32(0).get());
    console.log("Changed baud rate to " + rate);
  }

  async flashData(buf: Uint8Array, off: number) {
    this.terminal.print('Writing ' + buf.length + ' bytes to 0x' + off.toString(16));
    const blockBits = 9;
    const blockSize = 1 << blockBits;
    const blockCount = (buf.length + blockSize - 1) >> blockBits;
    await this.command(Command.ESP_SPI_ATTACH, new CommandWriter().u32(0).u32(0).get());
    await this.command(Command.ESP_SPI_SET_PARAMS, new CommandWriter().u32(0).u32(4 * 1024 * 1024).u32(0x10000).u32(0x1000).u32(0x100).u32(0xffff).get());
    await this.command(Command.ESP_FLASH_BEGIN, new CommandWriter().u32(buf.length).u32(blockCount).u32(blockSize).u32(off).get(), 0, 30000 * blockCount * blockSize / 1000000 + 500);

    const block = new Uint8Array(blockSize);
    for (let o = 0; o < buf.length; o += blockSize) {
      let cs = 0xef;
      for (let i = 0; i < blockSize; ++i) {
        this.progress = Math.floor(100 * o / buf.length);
        let v = 0xff;
        if (o + i < buf.length) {
          v = buf[o + i];
        }
        block[i] = v;
        cs ^= v;
      }
      await this.command(Command.ESP_FLASH_DATA, new CommandWriter().u32(blockSize).u32(o / blockSize).u32(0).u32(0).buffer(block).get(), cs);
    }
    // Do not send this, since we want to continue flashing.
    // await this.command(Command.ESP_FLASH_END, new CommandWriter().u32(1).get());
  }

  async command(cmd: Command, buffer: Uint8Array, checksum: number = 0, timeout: number = 2000): Promise<ResponseReader | null> {
    await this.sendCommand(cmd, buffer, checksum);
    return this.response(cmd, timeout);
  }

  async sendCommand(cmd: Command, buffer: Uint8Array, checksum: number = 0) {
    const s = new CommandWriter();
    s.u8(0x00);
    s.u8(cmd);
    s.u16(buffer.length);
    s.u32(checksum);
    s.buffer(buffer);
    await this.port.write(s.framed());
  };

  resolveResponse: Function | null = null;
  async response(cmd: Command, timeout: number): Promise<ResponseReader | null> {
    const p = new Promise<Uint8Array | null>(r => { this.resolveResponse = r; });
    const t = setTimeout(() => this.resolveResponse!(null), timeout);
    const r = await p;
    if (r === null) {
      console.log('Command timed out');
      return null;
    }
    clearTimeout(t);
    if (r[0] != 1) {
      console.log('Frame does not start with 1', r);
      return null;
    }
    if (r[1] != cmd) {
      console.log('Frame does not match command ' + cmd, r);
      return null;
    }
    const l = r[2] + (r[3] << 8);
    if (l + 8 != r.length) {
      console.log('Frame does not have length ' + r.length, r);
      return null;
    }
    const v = r[4] + (r[5] << 8) + (r[6] << 16) + (r[7] << 24);
    this.resolveResponse = null;
    return new ResponseReader(v, r.slice(8));
  }

  receiveFrame(data: Uint8Array) {
    if (this.resolveResponse == null) {
      console.log('Received unexpected frame', data);
    } else {
      this.resolveResponse!(data);
    }
  }
}