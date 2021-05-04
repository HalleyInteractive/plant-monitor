export enum NvsType {
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

export class NVSSettings {
  static readonly BLOCK_SIZE: number = 32;
  static readonly PAGE_SIZE: number = 4096;
  static readonly PAGE_MAX_ENTRIES: number = 126;
  static readonly PAGE_ACTIVE: number = 0xFFFFFFFE;
  static readonly PAGE_FULL: number = 0xFFFFFFFC;
  static readonly NVS_VERSION: number = 0xFE;
  static readonly DEFAULT_NAMESPACE: string = 'storage';
}

