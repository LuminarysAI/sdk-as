/**
 * Versioned state serialization helpers.
 *
 * Wraps skill state in a schema-versioned envelope so that state
 * format changes can be detected and migrated safely.
 *
 * @module state
 */

import { Encoder, Decoder } from "./msgpack";

/**
 * Encode skill state into a versioned envelope.
 *
 * @param schemaVersion - Increment when state structure changes.
 * @param data - State bytes (e.g. msgpack-encoded skill state).
 * @returns Envelope bytes to pass to `ctx.setState()`.
 */
export function marshalState(schemaVersion: i32, data: Uint8Array): Uint8Array {
  const enc = new Encoder(); enc.encode_map_header(2);
  enc.encode_str("schema_version"); enc.encode_i64(schemaVersion as i64);
  enc.encode_str("data"); enc.encode_bin(data);
  return enc.finish();
}

/** Result from {@link unmarshalState}. */
export class StateEnvelope {
  schemaVersion: i32 = 0;
  data: Uint8Array = new Uint8Array(0);
}

/**
 * Decode a versioned state envelope.
 *
 * @param raw - Envelope bytes from `ctx.state`.
 * @returns Schema version and inner data bytes, or version=0 if empty.
 */
export function unmarshalState(raw: Uint8Array): StateEnvelope {
  const result = new StateEnvelope();
  if (raw.length == 0) return result;
  const dec = new Decoder(raw);
  const map = dec.decode();
  result.schemaVersion = map.getField("schema_version").getInt() as i32;
  result.data = map.getField("data").getBytes();
  return result;
}
