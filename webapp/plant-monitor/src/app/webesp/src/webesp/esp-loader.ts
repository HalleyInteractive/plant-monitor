// Supported commands. https://github.com/espressif/esptool/wiki/Serial-Protocol

import { PortController } from './port-controller';
import { ESPImage } from './esp-image';
import { CommandWriter } from './command-writer';
import { ResponseReader } from './response-reader';
import { WebespTerminalService } from 'src/app/webesp-terminal.service';
import { sleep, hex2 } from './../utils/common';

const familyNames = ['Unknown', 'ESP8266', 'ESP32', 'ESP32S2'];

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

export class ESPLoader {
  private ready = false;
  private chipFamily = ChipFamily.UNKNOWN;
  private eFuses: Array<number> = [0, 0, 0, 0];
  private macAddress: Array<number> = [0, 0, 0, 0, 0, 0];
  public progress:number = 0;

  constructor(private readonly port: PortController, private readonly image: ESPImage, private readonly terminal:WebespTerminalService) {}

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
        this.progress = Math.ceil(100 * o / buf.length);
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