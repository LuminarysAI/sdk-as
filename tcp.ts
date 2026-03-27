/**
 * TCP ABI wrappers.
 *
 * @module tcp
 */

import { Encoder, MsgValue } from "./msgpack";
import {
  abiCall, checkError,
  _tcp_request, _tcp_connect,
  _tcp_set_callback, _tcp_write, _tcp_close,
} from "./abi_internal";

/** TCP connection error kind constants. */
/** No error — data event. */
export const ERROR_KIND_NONE: string = "";
/** Remote peer closed the connection gracefully. */
export const ERROR_KIND_EOF: string = "eof";
/** Connection reset by peer. */
export const ERROR_KIND_RESET: string = "reset";
/** Read deadline exceeded. */
export const ERROR_KIND_TIMEOUT: string = "timeout";
/** TLS handshake or record-layer error. */
export const ERROR_KIND_TLS: string = "tls";
/** Generic I/O error. */
export const ERROR_KIND_IO: string = "io";

/**
 * Synchronous TCP request/response. Requires `tcp.enabled`.
 * Connects, sends data, reads response, closes — all in one call.
 *
 * @param addr - Host:port to connect to.
 * @param data - Payload to send.
 * @param tls - Use TLS encryption.
 * @param insecure - Skip TLS certificate verification (dev only).
 * @param timeoutMs - Total timeout (0 = 30s default).
 * @param maxBytes - Max response size (0 = 1MB default).
 * @returns Response bytes.
 */
export function tcpRequest(addr: string, data: Uint8Array, tls: bool = false, insecure: bool = false, timeoutMs: i64 = 0, maxBytes: i64 = 0): Uint8Array {
  let fields = 4; // addr + data + tls + timeout_ms
  if (insecure) fields++;
  if (maxBytes > 0) fields++;

  const enc = new Encoder(); enc.encode_map_header(fields);
  enc.encode_str("addr"); enc.encode_str(addr);
  enc.encode_str("data"); enc.encode_bin(data);
  enc.encode_str("tls"); enc.encode_bool(tls);
  enc.encode_str("timeout_ms"); enc.encode_i64(timeoutMs);
  if (insecure) { enc.encode_str("insecure"); enc.encode_bool(true); }
  if (maxBytes > 0) { enc.encode_str("max_bytes"); enc.encode_i64(maxBytes); }
  const resp = abiCall(_tcp_request, enc.finish()); checkError(resp, "tcp_request");
  return resp.getField("data").getBytes();
}

/**
 * Open a persistent TCP connection. Requires `tcp.enabled`.
 * Data is delivered asynchronously via the callback method.
 *
 * @param addr - Host:port to connect to.
 * @param callback - Skill method name to receive connection events (empty = drain).
 * @param tls - Use TLS encryption.
 * @param insecure - Skip TLS certificate verification (dev only).
 * @param timeoutMs - Connection timeout (0 = 30s default).
 * @param serverName - Override TLS SNI hostname (empty = use host from addr).
 * @returns Connection ID.
 */
export function tcpConnect(addr: string, callback: string = "", tls: bool = false, insecure: bool = false, timeoutMs: i64 = 0, serverName: string = ""): string {
  let fields = 3; // addr + callback + timeout_ms
  if (tls) fields++;
  if (insecure) fields++;
  if (serverName.length > 0) fields++;

  const enc = new Encoder(); enc.encode_map_header(fields);
  enc.encode_str("addr"); enc.encode_str(addr);
  enc.encode_str("callback"); enc.encode_str(callback);
  enc.encode_str("timeout_ms"); enc.encode_i64(timeoutMs);
  if (tls) { enc.encode_str("tls"); enc.encode_bool(true); }
  if (insecure) { enc.encode_str("insecure"); enc.encode_bool(true); }
  if (serverName.length > 0) { enc.encode_str("server_name"); enc.encode_str(serverName); }
  const resp = abiCall(_tcp_connect, enc.finish()); checkError(resp, "tcp_connect");
  return resp.getField("conn_id").getStr();
}

/**
 * Change the callback method for an existing TCP connection.
 *
 * @param connId - Connection ID from tcpConnect.
 * @param callback - New skill method name to receive events.
 */
export function tcpSetCallback(connId: string, callback: string): void {
  const enc = new Encoder(); enc.encode_map_header(2);
  enc.encode_str("conn_id"); enc.encode_str(connId);
  enc.encode_str("callback"); enc.encode_str(callback);
  checkError(abiCall(_tcp_set_callback, enc.finish()), "tcp_set_callback");
}

/**
 * Write data to an open TCP connection.
 *
 * @param connId - Connection ID.
 * @param data - Data to send.
 */
export function tcpWrite(connId: string, data: Uint8Array): void {
  const enc = new Encoder(); enc.encode_map_header(2);
  enc.encode_str("conn_id"); enc.encode_str(connId);
  enc.encode_str("data"); enc.encode_bin(data);
  checkError(abiCall(_tcp_write, enc.finish()), "tcp_write");
}

/**
 * Close an open TCP connection.
 *
 * @param connId - Connection ID.
 */
export function tcpClose(connId: string): void {
  const enc = new Encoder(); enc.encode_map_header(1);
  enc.encode_str("conn_id"); enc.encode_str(connId);
  checkError(abiCall(_tcp_close, enc.finish()), "tcp_close");
}

/**
 * Unmarshal a TCP connection event from callback payload.
 * The callback receives events with fields: conn_id, event ("data"|"close"|"error"), data, error.
 *
 * @param payload - Raw callback payload bytes.
 * @returns Decoded event value with conn_id, event, data, error fields.
 */
export function unmarshalConnEvent(payload: MsgValue): MsgValue {
  return payload;
}
