/**
 * System, logging, and environment ABI wrappers.
 *
 * @module system
 */

import { Encoder, MsgValue } from "./msgpack";
import {
  abiCall, checkError, emptyReq,
  _sys_info, _time_now, _disk_usage, _env_get, _log_write,
} from "./abi_internal";

/** Host OS and hardware information. */
export class SysInfoResult {
  /** Operating system: "linux", "windows", "darwin". */
  os: string = "";
  /** CPU architecture: "amd64", "arm64", "riscv64". */
  arch: string = "";
  /** Machine hostname. */
  hostname: string = "";
  /** Number of logical CPUs. */
  num_cpu: i32 = 0;
}

/**
 * Get host OS and hardware information. No permissions required.
 */
export function sysInfo(): SysInfoResult {
  const resp = abiCall(_sys_info, emptyReq());
  const r = new SysInfoResult();
  r.os = resp.getField("os").getStr();
  r.arch = resp.getField("arch").getStr();
  r.hostname = resp.getField("hostname").getStr();
  r.num_cpu = resp.getField("num_cpu").getInt() as i32;
  return r;
}

/** Current host time in multiple formats. */
export class TimeNowResult {
  /** Seconds since Unix epoch. */
  unix: i64 = 0;
  /** Nanoseconds since Unix epoch. */
  unix_nano: i64 = 0;
  /** RFC3339 formatted string, e.g. "2026-03-20T12:00:00+03:00". */
  rfc3339: string = "";
  /** IANA timezone name, e.g. "Europe/Moscow". */
  timezone: string = "";
  /** UTC offset in seconds, e.g. 10800 for +03:00. */
  utc_offset: i32 = 0;
}

/**
 * Get the current host time. No permissions required.
 */
export function timeNow(): TimeNowResult {
  const resp = abiCall(_time_now, emptyReq());
  const r = new TimeNowResult();
  r.unix = resp.getField("unix").getInt();
  r.unix_nano = resp.getField("unix_nano").getInt();
  r.rfc3339 = resp.getField("rfc3339").getStr();
  r.timezone = resp.getField("timezone").getStr();
  r.utc_offset = resp.getField("utc_offset").getInt() as i32;
  return r;
}

/** Disk usage information. */
export class DiskUsageResult {
  /** Total disk space in bytes. */
  total_bytes: i64 = 0;
  /** Free disk space in bytes. */
  free_bytes: i64 = 0;
  /** Used disk space in bytes. */
  used_bytes: i64 = 0;
  /** Usage percentage (0.0–100.0). */
  used_pct: f64 = 0;
}

/**
 * Get disk usage information for a path. Requires `fs.enabled`.
 * @param path - Absolute path (empty = sandbox root).
 */
export function diskUsage(path: string = ""): DiskUsageResult {
  const enc = new Encoder(); enc.encode_map_header(1);
  enc.encode_str("path"); enc.encode_str(path);
  const resp = abiCall(_disk_usage, enc.finish()); checkError(resp, "disk_usage");
  const r = new DiskUsageResult();
  r.total_bytes = resp.getField("total_bytes").getInt();
  r.free_bytes = resp.getField("free_bytes").getInt();
  r.used_bytes = resp.getField("used_bytes").getInt();
  r.used_pct = resp.getField("used_pct").getFloat();
  return r;
}

/**
 * Read an environment variable declared in the skill's manifest.
 * @param key - Variable name.
 * @returns Value, or empty string if not declared.
 */
export function getEnv(key: string): string {
  const enc = new Encoder(); enc.encode_map_header(1);
  enc.encode_str("key"); enc.encode_str(key);
  return abiCall(_env_get, enc.finish()).getField("value").getStr();
}

/** Log level constants. */
export const LOG_DEBUG: string = "debug";
export const LOG_INFO: string = "info";
export const LOG_WARN: string = "warn";
export const LOG_ERROR: string = "error";

/** Key-value pair for structured log fields. */
export class LogField {
  name: string = "";
  value: string = "";
}

/**
 * Write a structured log message to the host logger.
 * No permissions required. Disabled by default on the host (`log.skill_log`).
 *
 * @param level - Log level: "debug", "info", "warn", "error".
 * @param message - Log message.
 * @param fields - Optional structured fields.
 */
export function log(level: string, message: string, fields: LogField[] = []): void {
  let mapSize = 2;
  if (fields.length > 0) mapSize++;
  const enc = new Encoder(); enc.encode_map_header(mapSize);
  enc.encode_str("level"); enc.encode_str(level);
  enc.encode_str("message"); enc.encode_str(message);
  if (fields.length > 0) {
    enc.encode_str("fields");
    enc.encode_map_header(fields.length);
    for (let i = 0; i < fields.length; i++) {
      enc.encode_str(fields[i].name);
      enc.encode_str(fields[i].value);
    }
  }
  abiCall(_log_write, enc.finish());
}

/** Log a debug message. */
export function logDebug(msg: string, fields: LogField[] = []): void { log("debug", msg, fields); }
/** Log an info message. */
export function logInfo(msg: string, fields: LogField[] = []): void  { log("info", msg, fields); }
/** Log a warning message. */
export function logWarn(msg: string, fields: LogField[] = []): void  { log("warn", msg, fields); }
/** Log an error message. */
export function logError(msg: string, fields: LogField[] = []): void { log("error", msg, fields); }
