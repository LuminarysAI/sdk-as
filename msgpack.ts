/**
 * Binary encoder/decoder for AssemblyScript.
 *
 * @module msgpack
 */

// ── Encoder ───────────────────────────────────────────────────────────────────

/**
 * Encoder. Builds a binary byte sequence incrementally.
 *
 * @example
 * ```ts
 * const enc = new Encoder();
 * enc.encode_map_header(2);
 * enc.encode_str("name"); enc.encode_str("Alice");
 * enc.encode_str("age");  enc.encode_i64(30);
 * const bytes = enc.finish();
 * ```
 */
export class Encoder {
  private buf: u8[] = [];

  /** Encode a nil value. */
  encode_nil(): void { this.buf.push(0xc0); }

  /** Encode a boolean. */
  encode_bool(v: bool): void { this.buf.push(v ? 0xc3 : 0xc2); }

  /** Encode an unsigned 32-bit integer. */
  encode_u32(v: u32): void {
    if (v <= 0x7f) { this.buf.push(v as u8); return; }
    if (v <= 0xff) { this.buf.push(0xcc); this.buf.push(v as u8); return; }
    if (v <= 0xffff) {
      this.buf.push(0xcd);
      this.buf.push((v >> 8) as u8);
      this.buf.push((v & 0xff) as u8);
      return;
    }
    this.buf.push(0xce);
    this.buf.push(((v >> 24) & 0xff) as u8);
    this.buf.push(((v >> 16) & 0xff) as u8);
    this.buf.push(((v >> 8) & 0xff) as u8);
    this.buf.push((v & 0xff) as u8);
  }

  /** Encode a signed 64-bit integer. */
  encode_i64(v: i64): void {
    if (v >= 0 && v <= 0x7f) { this.buf.push(v as u8); return; }
    if (v >= -32 && v < 0) { this.buf.push((v & 0xff) as u8); return; }
    if (v >= -128 && v < 128) { this.buf.push(0xd0); this.buf.push((v & 0xff) as u8); return; }
    if (v >= -32768 && v < 32768) {
      this.buf.push(0xd1);
      this.buf.push(((v >> 8) & 0xff) as u8);
      this.buf.push((v & 0xff) as u8);
      return;
    }
    this.buf.push(0xd3);
    for (let i = 56; i >= 0; i -= 8) this.buf.push(((v >> i) & 0xff) as u8);
  }

  /** Encode a 64-bit float. */
  encode_f64(v: f64): void {
    this.buf.push(0xcb);
    const n = reinterpret<u64>(v);
    for (let i = 56; i >= 0; i -= 8) this.buf.push(((n >> i) & 0xff) as u8);
  }

  /** Encode a UTF-8 string. */
  encode_str(s: string): void {
    const bytes = String.UTF8.encode(s);
    const n = bytes.byteLength;
    if (n <= 31) { this.buf.push((0xa0 | n) as u8); }
    else if (n <= 0xff) { this.buf.push(0xd9); this.buf.push(n as u8); }
    else if (n <= 0xffff) { this.buf.push(0xda); this.buf.push((n >> 8) as u8); this.buf.push((n & 0xff) as u8); }
    else { this.buf.push(0xdb); this.buf.push(((n >> 24) & 0xff) as u8); this.buf.push(((n >> 16) & 0xff) as u8); this.buf.push(((n >> 8) & 0xff) as u8); this.buf.push((n & 0xff) as u8); }
    for (let i = 0; i < n; i++) this.buf.push(load<u8>(changetype<usize>(bytes) + i));
  }

  /** Encode a binary blob. */
  encode_bin(data: Uint8Array): void {
    const n = data.length;
    if (n <= 0xff) { this.buf.push(0xc4); this.buf.push(n as u8); }
    else if (n <= 0xffff) { this.buf.push(0xc5); this.buf.push((n >> 8) as u8); this.buf.push((n & 0xff) as u8); }
    else { this.buf.push(0xc6); this.buf.push(((n >> 24) & 0xff) as u8); this.buf.push(((n >> 16) & 0xff) as u8); this.buf.push(((n >> 8) & 0xff) as u8); this.buf.push((n & 0xff) as u8); }
    for (let i = 0; i < n; i++) this.buf.push(data[i]);
  }

  /** Write a map header with `n` key-value pairs. */
  encode_map_header(n: i32): void {
    if (n <= 15) { this.buf.push((0x80 | n) as u8); }
    else if (n <= 0xffff) { this.buf.push(0xde); this.buf.push((n >> 8) as u8); this.buf.push((n & 0xff) as u8); }
  }

  /** Write an array header with `n` elements. */
  encode_array_header(n: i32): void {
    if (n <= 15) { this.buf.push((0x90 | n) as u8); }
    else if (n <= 0xffff) { this.buf.push(0xdc); this.buf.push((n >> 8) as u8); this.buf.push((n & 0xff) as u8); }
  }

  /** Finalize and return the encoded bytes. */
  finish(): Uint8Array {
    const out = new Uint8Array(this.buf.length);
    for (let i = 0; i < this.buf.length; i++) out[i] = this.buf[i];
    return out;
  }
}

// ── Decoded value ─────────────────────────────────────────────────────────────

/**
 * A decoded value. Check `kind` to determine the type,
 * then call the appropriate getter.
 *
 * | kind | type    | getter       |
 * |------|---------|-------------|
 * | 0    | nil     | —            |
 * | 1    | bool    | `getBool()`  |
 * | 2    | int     | `getInt()`   |
 * | 3    | float   | `getFloat()` |
 * | 4    | string  | `getStr()`   |
 * | 5    | binary  | `getBytes()` |
 * | 6    | array   | `arr`        |
 * | 7    | map     | `getField()` |
 */
export class MsgValue {
  /** Value type: 0=nil 1=bool 2=int 3=float 4=str 5=bin 6=array 7=map */
  kind: u8 = 0;
  b: bool = false;
  i: i64 = 0;
  f: f64 = 0;
  s: string = "";
  bin: Uint8Array = new Uint8Array(0);
  /** Array elements (kind=6). */
  arr: MsgValue[] = [];
  /** Map keys (kind=7). */
  keys: string[] = [];
  /** Map values (kind=7). */
  vals: MsgValue[] = [];

  /** Create a nil value. */
  static nil(): MsgValue { const v = new MsgValue(); v.kind = 0; return v; }
  /** Create a bool value. */
  static bool(b: bool): MsgValue { const v = new MsgValue(); v.kind = 1; v.b = b; return v; }
  /** Create an integer value. */
  static int(i: i64): MsgValue { const v = new MsgValue(); v.kind = 2; v.i = i; return v; }
  /** Create a float value. */
  static float(f: f64): MsgValue { const v = new MsgValue(); v.kind = 3; v.f = f; return v; }
  /** Create a string value. */
  static str(s: string): MsgValue { const v = new MsgValue(); v.kind = 4; v.s = s; return v; }
  /** Create a binary value. */
  static bin(b: Uint8Array): MsgValue { const v = new MsgValue(); v.kind = 5; v.bin = b; return v; }

  /** Get as string. Returns "" if not a string. */
  getStr(): string { return this.kind == 4 ? this.s : ""; }
  /** Get as i64. Coerces float to int if needed. Returns 0 if not numeric. */
  getInt(): i64 { return this.kind == 2 ? this.i : (this.kind == 3 ? this.f as i64 : 0); }
  /** Get as f64. Coerces int to float if needed. Returns 0 if not numeric. */
  getFloat(): f64 { return this.kind == 3 ? this.f : (this.kind == 2 ? this.i as f64 : 0); }
  /** Get as bool. Coerces int!=0 to true. Returns false if not bool/int. */
  getBool(): bool { return this.kind == 1 ? this.b : (this.kind == 2 ? this.i != 0 : false); }
  /** Get as binary. Returns empty array if not binary. */
  getBytes(): Uint8Array { return this.kind == 5 ? this.bin : new Uint8Array(0); }

  /** Get array length. Returns 0 if not an array. */
  getArrayLen(): i32 { return this.kind == 6 ? this.arr.length : 0; }
  /** Get array element by index. Returns nil if out of bounds or not an array. */
  getIndex(idx: i32): MsgValue {
    if (this.kind == 6 && idx >= 0 && idx < this.arr.length) return this.arr[idx];
    return MsgValue.nil();
  }

  /**
   * Get a map field by key. Returns nil MsgValue if key not found.
   * @param key - The map key to look up.
   */
  getField(key: string): MsgValue {
    for (let i = 0; i < this.keys.length; i++) {
      if (this.keys[i] == key) return this.vals[i];
    }
    return MsgValue.nil();
  }
}

// ── Decoder ───────────────────────────────────────────────────────────────────

/**
 * Decoder. Reads a single value from the byte stream.
 *
 * @example
 * ```ts
 * const dec = new Decoder(bytes);
 * const val = dec.decode();
 * const name = val.getField("name").getStr();
 * ```
 */
export class Decoder {
  private data: Uint8Array;
  private pos: i32 = 0;

  /** @param data - Encoded bytes to decode. */
  constructor(data: Uint8Array) { this.data = data; }

  /** Decode one value from the stream. */
  decode(): MsgValue {
    const b = this.data[this.pos++];

    if (b <= 0x7f) return MsgValue.int(b as i64);          // positive fixint
    if (b >= 0xe0) return MsgValue.int((b as i8) as i64);  // negative fixint
    if ((b & 0xe0) == 0xa0) return MsgValue.str(this.readStr(b & 0x1f));  // fixstr
    if ((b & 0xf0) == 0x90) return this.readArray(b & 0x0f);              // fixarray
    if ((b & 0xf0) == 0x80) return this.readMap(b & 0x0f);                // fixmap

    switch (b) {
      case 0xc0: return MsgValue.nil();
      case 0xc2: return MsgValue.bool(false);
      case 0xc3: return MsgValue.bool(true);
      case 0xc4: return MsgValue.bin(this.readBin(this.data[this.pos++] as i32));
      case 0xc5: return MsgValue.bin(this.readBin(this.readU16()));
      case 0xc6: return MsgValue.bin(this.readBin(this.readU32() as i32));
      case 0xcc: return MsgValue.int(this.data[this.pos++] as i64);
      case 0xcd: return MsgValue.int(this.readU16() as i64);
      case 0xce: return MsgValue.int(this.readU32() as i64);
      case 0xcf: return MsgValue.int(this.readI64());
      case 0xd0: return MsgValue.int((this.data[this.pos++] as i8) as i64);
      case 0xd1: return MsgValue.int(this.readI16() as i64);
      case 0xd2: return MsgValue.int(this.readI32() as i64);
      case 0xd3: return MsgValue.int(this.readI64());
      case 0xcb: return MsgValue.float(this.readF64());
      case 0xd9: return MsgValue.str(this.readStr(this.data[this.pos++] as i32));
      case 0xda: return MsgValue.str(this.readStr(this.readU16()));
      case 0xdb: return MsgValue.str(this.readStr(this.readU32() as i32));
      case 0xdc: return this.readArray(this.readU16());
      case 0xdd: return this.readArray(this.readU32() as i32);
      case 0xde: return this.readMap(this.readU16());
      case 0xdf: return this.readMap(this.readU32() as i32);
    }
    return MsgValue.nil();
  }

  private readStr(n: i32): string {
    const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = this.data[this.pos++];
    return String.UTF8.decode(bytes.buffer);
  }

  private readBin(n: i32): Uint8Array {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = this.data[this.pos++];
    return out;
  }

  private readArray(n: i32): MsgValue {
    const v = new MsgValue(); v.kind = 6;
    for (let i = 0; i < n; i++) v.arr.push(this.decode());
    return v;
  }

  private readMap(n: i32): MsgValue {
    const v = new MsgValue(); v.kind = 7;
    for (let i = 0; i < n; i++) {
      v.keys.push(this.decode().getStr());
      v.vals.push(this.decode());
    }
    return v;
  }

  private readU16(): i32 {
    return ((this.data[this.pos++] as i32) << 8) | (this.data[this.pos++] as i32);
  }
  private readU32(): u32 {
    return ((this.data[this.pos++] as u32) << 24) | ((this.data[this.pos++] as u32) << 16) |
           ((this.data[this.pos++] as u32) << 8) | (this.data[this.pos++] as u32);
  }
  private readI16(): i16 { return this.readU16() as i16; }
  private readI32(): i32 { return this.readU32() as i32; }
  private readI64(): i64 {
    let v: i64 = 0;
    for (let i = 0; i < 8; i++) v = (v << 8) | (this.data[this.pos++] as i64);
    return v;
  }
  private readF64(): f64 { return reinterpret<f64>(this.readI64() as u64); }
}
