export class CommandWriter {
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