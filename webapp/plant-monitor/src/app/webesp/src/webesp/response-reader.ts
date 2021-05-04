export class ResponseReader {
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