/**
 * Shell execution ABI wrappers.
 *
 * @module shell
 */

import { Encoder } from "./msgpack";
import { abiCall, checkError, _shell_exec } from "./abi_internal";

/** Result from {@link shellExec}. */
export class ShellResult {
  /** Combined stdout+stderr output. */
  output: string = "";
  /** Process exit code (0 = success). */
  exit_code: i32 = 0;
  /** Process ID (only set when asDaemon=true). */
  pid: i32 = 0;
  /** Log file path (only set when asDaemon=true). */
  log_file: string = "";
}

/**
 * Execute a shell command. Requires `shell.enabled`, command in allowlist.
 *
 * @param command - Command to execute.
 * @param workdir - Working directory (empty = sandbox root).
 * @param timeoutMs - Timeout in milliseconds (0 = 30s default).
 * @param tail - Return only the last N lines (0 = all).
 * @param grep - Filter output lines by regex (empty = no filter).
 * @param asDaemon - Start as background daemon, return immediately with PID.
 * @param logFile - Daemon log file path (empty = auto-generated in /tmp).
 */
export function shellExec(
  command: string,
  workdir: string = "",
  timeoutMs: i64 = 0,
  tail: i64 = 0,
  grep: string = "",
  asDaemon: bool = false,
  logFile: string = "",
): ShellResult {
  let fields = 5; // command + workdir + timeout_ms + tail + grep
  if (asDaemon) fields++;
  if (logFile.length > 0) fields++;

  const enc = new Encoder(); enc.encode_map_header(fields);
  enc.encode_str("command"); enc.encode_str(command);
  enc.encode_str("workdir"); enc.encode_str(workdir);
  enc.encode_str("timeout_ms"); enc.encode_i64(timeoutMs);
  enc.encode_str("tail"); enc.encode_i64(tail);
  enc.encode_str("grep"); enc.encode_str(grep);
  if (asDaemon) { enc.encode_str("as_daemon"); enc.encode_bool(true); }
  if (logFile.length > 0) { enc.encode_str("log_file"); enc.encode_str(logFile); }

  const resp = abiCall(_shell_exec, enc.finish()); checkError(resp, "shell_exec");
  const r = new ShellResult();
  r.output = resp.getField("output").getStr();
  r.exit_code = resp.getField("exit_code").getInt() as i32;
  r.pid = resp.getField("pid").getInt() as i32;
  r.log_file = resp.getField("log_file").getStr();
  return r;
}

