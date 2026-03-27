/**
 * Command builders for agent mode.
 *
 * Commands enable async patterns: inter-skill calls, event emission,
 * scheduling, and KV storage.
 *
 * @module commands
 */

import { Encoder } from "./msgpack";

/** Command type constants. */
export const CMD_CALL_MODULE: string = "call_module";
export const CMD_BATCH_INVOKE: string = "batch_invoke";
export const CMD_SCHEDULE: string = "schedule";
export const CMD_EMIT_EVENT: string = "emit_event";
export const CMD_SUBSCRIBE: string = "subscribe";
export const CMD_STORE_KV: string = "store_kv";
export const CMD_LOAD_KV: string = "load_kv";
export const CMD_SPAWN: string = "spawn";
export const CMD_TERMINATE: string = "terminate";

/** An instruction returned by the skill to the platform. */
export class Command {
  type: string = "";
  payload: Uint8Array = new Uint8Array(0);
}

/** One call inside a batch_invoke command. */
export class BatchItem {
  index: i32 = 0;
  skill_id: string = "";
  method: string = "";
  payload: Uint8Array = new Uint8Array(0);
}

/** Result of one BatchItem after execution. */
export class BatchItemResult {
  index: i32 = 0;
  payload: Uint8Array = new Uint8Array(0);
  error: string = "";
}

/** Delivered to the callback method declared in batch_invoke. */
export class BatchResult {
  batch_id: string = "";
  items: BatchItemResult[] = [];
}

/**
 * Create a command that publishes an event to the MessageBus.
 * @param topic - Event topic.
 * @param payload - Event payload as msgpack bytes.
 */
export function newEmitEvent(topic: string, payload: Uint8Array = new Uint8Array(0)): Command {
  const enc = new Encoder(); enc.encode_map_header(2);
  enc.encode_str("topic"); enc.encode_str(topic);
  enc.encode_str("payload"); enc.encode_bin(payload);
  const cmd = new Command();
  cmd.type = CMD_EMIT_EVENT;
  cmd.payload = enc.finish();
  return cmd;
}

/**
 * Create a command that invokes another skill.
 * @param skillId - Target skill ID.
 * @param method - Method to call.
 * @param payload - Request payload as msgpack bytes.
 * @param callback - Callback method for the response.
 * @param callCtx - Opaque context string passed to callback.
 */
export function newCallModule(skillId: string, method: string, payload: Uint8Array = new Uint8Array(0), callback: string = "", callCtx: string = ""): Command {
  const enc = new Encoder(); enc.encode_map_header(5);
  enc.encode_str("skill_id"); enc.encode_str(skillId);
  enc.encode_str("method"); enc.encode_str(method);
  enc.encode_str("payload"); enc.encode_bin(payload);
  enc.encode_str("callback"); enc.encode_str(callback);
  enc.encode_str("call_ctx"); enc.encode_str(callCtx);
  const cmd = new Command();
  cmd.type = CMD_CALL_MODULE;
  cmd.payload = enc.finish();
  return cmd;
}

/**
 * Create a command to store a value in Shared KV (L3).
 * @param key - Storage key.
 * @param value - Value as msgpack bytes.
 */
export function newStoreKV(key: string, value: Uint8Array): Command {
  const enc = new Encoder(); enc.encode_map_header(2);
  enc.encode_str("key"); enc.encode_str(key);
  enc.encode_str("value"); enc.encode_bin(value);
  const cmd = new Command();
  cmd.type = CMD_STORE_KV;
  cmd.payload = enc.finish();
  return cmd;
}

/**
 * Create a command to load a value from Shared KV (L3).
 * @param key - Storage key.
 * @param callback - Callback method to receive the value.
 */
export function newLoadKV(key: string, callback: string): Command {
  const enc = new Encoder(); enc.encode_map_header(2);
  enc.encode_str("key"); enc.encode_str(key);
  enc.encode_str("callback"); enc.encode_str(callback);
  const cmd = new Command();
  cmd.type = CMD_LOAD_KV;
  cmd.payload = enc.finish();
  return cmd;
}

/**
 * Create a command to schedule a delayed method invocation.
 * @param method - Method to call after delay.
 * @param delayMs - Delay in milliseconds.
 * @param payload - Payload as msgpack bytes.
 */
export function newSchedule(method: string, delayMs: i64, payload: Uint8Array = new Uint8Array(0)): Command {
  const enc = new Encoder(); enc.encode_map_header(3);
  enc.encode_str("method"); enc.encode_str(method);
  enc.encode_str("delay_ms"); enc.encode_i64(delayMs);
  enc.encode_str("payload"); enc.encode_bin(payload);
  const cmd = new Command();
  cmd.type = CMD_SCHEDULE;
  cmd.payload = enc.finish();
  return cmd;
}
