import { crc32 } from '../utils/crc32';

const NVS_BLOCK_SIZE: number = 32;

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

export class NvsEntry implements NvsKeyValue {
  namespace: number;
  type: NvsType;
  key: string;
  data: string | number;

  headerNamespace: Uint8Array;
  headerType: Uint8Array;
  headerSpan: Uint8Array;
  headerChunkIndex: Uint8Array;
  headerCRC32: Uint8Array;
  headerKey: Uint8Array;
  headerData: Uint8Array;
  headerDataSize: Uint8Array;
  headerDataCRC32: Uint8Array;

  headerBuffer: Uint8Array;
  dataBuffer: Uint8Array;

  entriesNeeded: number = 0;

  constructor(entry: NvsKeyValue) {
    console.log('NEW ENTRY', entry);

    this.namespace = entry.namespace;
    this.type = entry.type;
    this.key = entry.key += '\0';
    this.data = entry.data;

    if (entry.key.length > 16) {
      throw Error(`NVS max key length is 15, received ${entry.key} of length ${entry.key.length}`);
    }

    this.headerBuffer = new Uint8Array(32);
    this.headerNamespace = new Uint8Array(this.headerBuffer.buffer, 0, 1);
    this.headerType = new Uint8Array(this.headerBuffer.buffer, 1, 1);
    this.headerSpan = new Uint8Array(this.headerBuffer.buffer, 2, 1);
    this.headerChunkIndex = new Uint8Array(this.headerBuffer.buffer, 3, 1).fill(0xFF);
    this.headerCRC32 = new Uint8Array(this.headerBuffer.buffer, 4, 4);
    this.headerKey = new Uint8Array(this.headerBuffer.buffer, 8, 16);
    this.headerData = new Uint8Array(this.headerBuffer.buffer, 24, 8).fill(0xFF);
    this.headerDataSize = new Uint8Array(this.headerBuffer.buffer, 24, 4);
    this.headerDataCRC32 = new Uint8Array(this.headerBuffer.buffer, 28, 4);

    this.dataBuffer = new Uint8Array(0);

    this.setEntryData();
    this.setEntryHeader();
    this.setEntryHeaderCRC();
  }

  private setEntryHeader() {
    const encoder = new TextEncoder()
    this.headerNamespace.set([this.namespace]);
    this.headerType.set([this.type]);
    this.headerSpan.set([this.entriesNeeded]);
    this.headerKey.set(encoder.encode(this.key));
  }

  private setEntryData() {
    if (typeof this.data == "string") {
      this.setStringEntry();
    } else if (typeof this.data == "number") {
      this.setPrimitiveEntry();
    }
  }

  private setStringEntry() {
    if (typeof this.data == "string") {
      this.data += '\0';  // Adding null terminator.
      const encoder = new TextEncoder()
      const data = encoder.encode(this.data);

      this.entriesNeeded = Math.ceil(data.length / NVS_BLOCK_SIZE);
      this.dataBuffer = new Uint8Array(this.entriesNeeded * NVS_BLOCK_SIZE).fill(0xff);
      this.dataBuffer.set(data);

      this.entriesNeeded += 1; // +1 for header

      const dataSizeBuffer: ArrayBuffer = new ArrayBuffer(2);
      const dataSizeView: DataView = new DataView(dataSizeBuffer, 0, 2);
      dataSizeView.setUint8(0, data.length);

      this.headerDataSize.set(new Uint8Array(dataSizeBuffer), 0);
      this.headerDataCRC32.set(crc32(data));
    }
  }

  private setPrimitiveEntry() {
    if (typeof this.data == "number") {
      const dataBuffer: ArrayBuffer = new ArrayBuffer(8);
      const dataBufferView: DataView = new DataView(dataBuffer, 0, 8);
      const dataBufferArray: Uint8Array = new Uint8Array(dataBuffer).fill(0xFF);
      switch (this.type) {
        case NvsType.U8:
          dataBufferView.setUint8(0, this.data);
          break;
        case NvsType.U16:
          dataBufferView.setUint16(0, this.data);
          break;
        case NvsType.U32:
          dataBufferView.setUint32(0, this.data);
          break;
        case NvsType.U64:
          dataBufferView.setBigUint64(0, BigInt(this.data));
          break;
        case NvsType.I8:
          dataBufferView.setInt8(0, this.data);
          break;
        case NvsType.I16:
          dataBufferView.setInt16(0, this.data);
          break;
        case NvsType.I32:
          dataBufferView.setInt32(0, this.data);
          break;
        case NvsType.I64:
          dataBufferView.setBigInt64(0, BigInt(this.data));
          break;
        default:
          dataBufferView.setUint32(0, this.data);
          break;

      }
      this.headerData.set(dataBufferArray, 0);
    }
    this.entriesNeeded = 1;
  }

  private setEntryHeaderCRC() {
    const crcData: Uint8Array = new Uint8Array(28);
    crcData.set(this.headerBuffer.slice(0, 4), 0);
    crcData.set(this.headerBuffer.slice(8, 32), 4);
    this.headerCRC32.set(crc32(crcData));
  }
}