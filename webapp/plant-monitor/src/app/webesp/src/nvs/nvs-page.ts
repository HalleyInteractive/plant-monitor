import { NvsEntry } from './nvs-entry';
import { crc32 } from '../utils/crc32';
import { NVSSettings } from './nvs-settings';

enum NvsType {
  U8 = 0x01,
  I8 = 0x11,
  U16 = 0x02,
  I16 = 0x12,
  U32 = 0x04,
  I32 = 0x14,
  U64 = 0x08,
  I64 = 0x18,
  STR = 0x21,
  BLOB = 0x42,
  ANY = 0xff
}

export class NVSPage {
  private entryNumber = 0;
  private pageBuffer: Uint8Array;
  private pageHeader: Uint8Array;
  private stateBitmap: bigint = 0b1111111111111111111111111111111111111111111111111111111111111111n;
  private entries: NvsEntry[] = [];

  private headerPageState: Uint8Array;
  private headerPageNumber: Uint8Array;
  private headerVersion: Uint8Array;
  private headerCRC32: Uint8Array;

  constructor(public pageNumber: number, public version: number) {
    this.pageBuffer = new Uint8Array(NVSSettings.PAGE_SIZE).fill(0xFF);
    this.pageHeader = new Uint8Array(this.pageBuffer.buffer, 0, 32);
    this.headerPageState = new Uint8Array(this.pageHeader.buffer, 0 ,4);
    this.headerPageNumber = new Uint8Array(this.pageHeader.buffer, 4, 4);
    this.headerVersion = new Uint8Array(this.pageHeader.buffer, 8, 1);
    this.headerCRC32 = new Uint8Array(this.pageHeader.buffer, 28, 4);
    this.setPageHeader();
  }

  private setPageHeader() {
    this.setPageState("ACTIVE");

    this.headerPageNumber.fill(0).set([this.pageNumber]);
    this.headerVersion.set([this.version]);

    const crcData: Uint8Array = this.pageHeader.slice(4, 28);
    this.headerCRC32.set(crc32(crcData));
    this.pageBuffer.set(this.pageHeader, 0);
  }

  private getNVSEncoding(value: number | string): number {
    if (typeof value == "number") {
      const abs = Math.abs(value);
      const neg = value < 0;
      let enc = 0x00;
      if (abs < 256) {
        enc = NvsType.U8;
      } else if (abs < 65536) {
        enc = NvsType.U16;
      } else if (abs < 4294967296) {
        enc = NvsType.U32;
      } else {
        enc = NvsType.U64;
      }
      if (neg) {
        enc += 0x10;
      }
      return enc;
    } else if (typeof value == "string") {
      return NvsType.STR;
    } else {
      return NvsType.ANY;
    }
  }

  /**
   * Add an entry to the page.
   * @param key Key for this entry, max 15 bytes.
   * @param data Entry data.
   * @param namespaceIndex Index of namespace for this entry.
   * @returns Entry that's written to the page.
   */
  public writeEntry(key: string, data: string | number, namespaceIndex: number): NvsEntry {
    const entryKv: NvsKeyValue = {
      namespace: namespaceIndex,
      key,
      data,
      type: this.getNVSEncoding(data)
    };
    const entry: NvsEntry = new NvsEntry(entryKv);
    if ((entry.entriesNeeded + this.entryNumber) > NVSSettings.PAGE_MAX_ENTRIES) {
      throw Error('Entry doesn\'t fit on the page');
    } else {
      this.entries.push(entry);
      for (let i = 0; i < entry.entriesNeeded; i++) {
        this.stateBitmap = this.stateBitmap & ~(1n << ((BigInt(i + this.entryNumber) * 2n) + 1n) - 1n);
      }
      this.entryNumber += entry.entriesNeeded;
    }
    return entry;
  }

  /**
   * Sets the page state bytes in the header of the page.
   * @param state New page state.
   */
  public setPageState(state: NvsPageState) {
    if (state == "FULL") {
      this.headerPageState.set([NVSSettings.PAGE_FULL]);
    } else if (state == "ACTIVE") {
      this.headerPageState.set([NVSSettings.PAGE_ACTIVE]);
    } else {
      throw Error('Invalid page state requested');
    }
  }

  /**
   * Get the page buffer data.
   * @returns Page buffer of size 4096
   */
  public getData(): Uint8Array {
    const sbm = new Uint8Array(NVSSettings.BLOCK_SIZE).fill(0xFF);
    const sbmView = new DataView(sbm.buffer, 0);
    sbmView.setBigInt64(0, this.stateBitmap, true);
    this.pageBuffer.set(sbm, NVSSettings.BLOCK_SIZE);

    let offset = NVSSettings.BLOCK_SIZE * 2;
    for (const entry of this.entries) {
      this.pageBuffer.set(entry.headerBuffer, offset);
      this.pageBuffer.set(entry.dataBuffer, offset + NVSSettings.BLOCK_SIZE);
      offset += entry.headerBuffer.length + entry.dataBuffer.length;
    }
    return this.pageBuffer;
  }
}