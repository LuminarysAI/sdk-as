/**
 * WebSocket ABI wrappers.
 *
 * @module ws
 */

import { Encoder, MsgValue } from "./msgpack";
import { abiCall, checkError, _ws_connect, _ws_send, _ws_close } from "./abi_internal";
import { HttpHeader } from "./http";

/** WebSocket message type constants for {@link wsSend}. */
export const WS_MESSAGE_TEXT: string = "text";
export const WS_MESSAGE_BINARY: string = "binary";
/** Message type received in callback when remote sends a close frame. */
export const WS_MESSAGE_CLOSE: string = "close";

/**
 * Open a WebSocket connection. Requires `tcp.enabled`.
 * Messages are delivered asynchronously via the callback method.
 *
 * @param url - WebSocket URL (ws:// or wss://).
 * @param headers - Request headers.
 * @param timeoutMs - Connection timeout (0 = 30s default).
 * @param callback - Skill method name to receive WebSocket events.
 * @param insecure - Skip TLS certificate verification for wss://.
 * @returns Connection ID.
 */
export function wsConnect(url: string, headers: HttpHeader[] = [], timeoutMs: i64 = 0, callback: string = "", insecure: bool = false): string {
  const enc = new Encoder(); enc.encode_map_header(5);
  enc.encode_str("url"); enc.encode_str(url);
  enc.encode_str("headers");
  enc.encode_array_header(headers.length);
  for (let i = 0; i < headers.length; i++) {
    enc.encode_map_header(2);
    enc.encode_str("name");  enc.encode_str(headers[i].name);
    enc.encode_str("value"); enc.encode_str(headers[i].value);
  }
  enc.encode_str("timeout_ms"); enc.encode_i64(timeoutMs);
  enc.encode_str("callback"); enc.encode_str(callback);
  enc.encode_str("insecure"); enc.encode_bool(insecure);
  const resp = abiCall(_ws_connect, enc.finish()); checkError(resp, "ws_connect");
  return resp.getField("conn_id").getStr();
}

/**
 * Send a message on an open WebSocket connection.
 *
 * @param connId - Connection ID from wsConnect.
 * @param data - Message payload.
 * @param messageType - Message type: "text" or "binary".
 */
export function wsSend(connId: string, data: Uint8Array, messageType: string = "text"): void {
  const enc = new Encoder(); enc.encode_map_header(3);
  enc.encode_str("conn_id"); enc.encode_str(connId);
  enc.encode_str("data"); enc.encode_bin(data);
  enc.encode_str("message_type"); enc.encode_str(messageType);
  checkError(abiCall(_ws_send, enc.finish()), "ws_send");
}

/**
 * Close a WebSocket connection.
 *
 * @param connId - Connection ID.
 * @param code - WebSocket close code (e.g. 1000 for normal closure).
 * @param reason - Close reason string.
 */
export function wsClose(connId: string, code: i32 = 1000, reason: string = ""): void {
  const enc = new Encoder(); enc.encode_map_header(3);
  enc.encode_str("conn_id"); enc.encode_str(connId);
  enc.encode_str("code"); enc.encode_i64(code as i64);
  enc.encode_str("reason"); enc.encode_str(reason);
  checkError(abiCall(_ws_close, enc.finish()), "ws_close");
}

/**
 * Unmarshal a WebSocket event from callback payload.
 * The callback receives events with fields: conn_id, event ("message"|"close"|"error"), data, message_type, error.
 *
 * @param payload - Decoded callback payload.
 * @returns The same value for field access (conn_id, event, data, message_type, error).
 */
export function unmarshalWsEvent(payload: MsgValue): MsgValue {
  return payload;
}
