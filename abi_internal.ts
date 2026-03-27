/**
 * Host ABI internals: WASM import declarations and shared helpers.
 *
 * This module is imported by the per-domain wrappers (fs, http, tcp, etc.).
 * Skill authors should not import this directly — use the domain modules
 * or the barrel re-export in abi.ts / index.ts instead.
 *
 * @module abi_internal
 */

import { Encoder, Decoder, MsgValue } from "./msgpack";

// ── WASM host imports ─────────────────────────────────────────────────────────

@external("env", "history_get")      export declare function _history_get(ptr: u32, len: u32): u64;
@external("env", "prompt_complete")  export declare function _prompt_complete(ptr: u32, len: u32): u64;
@external("env", "env_get")          export declare function _env_get(ptr: u32, len: u32): u64;
@external("env", "fs_read")          export declare function _fs_read(ptr: u32, len: u32): u64;
@external("env", "fs_write")         export declare function _fs_write(ptr: u32, len: u32): u64;
@external("env", "fs_create")        export declare function _fs_create(ptr: u32, len: u32): u64;
@external("env", "fs_delete")        export declare function _fs_delete(ptr: u32, len: u32): u64;
@external("env", "fs_mkdir")         export declare function _fs_mkdir(ptr: u32, len: u32): u64;
@external("env", "fs_ls")            export declare function _fs_ls(ptr: u32, len: u32): u64;
@external("env", "fs_chmod")         export declare function _fs_chmod(ptr: u32, len: u32): u64;
@external("env", "fs_read_lines")    export declare function _fs_read_lines(ptr: u32, len: u32): u64;
@external("env", "fs_grep")          export declare function _fs_grep(ptr: u32, len: u32): u64;
@external("env", "fs_glob")          export declare function _fs_glob(ptr: u32, len: u32): u64;
@external("env", "fs_allowed_dirs")  export declare function _fs_allowed_dirs(ptr: u32, len: u32): u64;
@external("env", "fs_copy")          export declare function _fs_copy(ptr: u32, len: u32): u64;
@external("env", "archive_pack")     export declare function _archive_pack(ptr: u32, len: u32): u64;
@external("env", "archive_unpack")   export declare function _archive_unpack(ptr: u32, len: u32): u64;
@external("env", "archive_list")     export declare function _archive_list(ptr: u32, len: u32): u64;
@external("env", "file_transfer_send") export declare function _file_transfer_send(ptr: u32, len: u32): u64;
@external("env", "file_transfer_recv") export declare function _file_transfer_recv(ptr: u32, len: u32): u64;
@external("env", "cluster_node_list")  export declare function _cluster_node_list(ptr: u32, len: u32): u64;
@external("env", "disk_usage")       export declare function _disk_usage(ptr: u32, len: u32): u64;
@external("env", "http_get")         export declare function _http_get(ptr: u32, len: u32): u64;
@external("env", "http_post")        export declare function _http_post(ptr: u32, len: u32): u64;
@external("env", "http_request")     export declare function _http_request(ptr: u32, len: u32): u64;
@external("env", "tcp_connect")      export declare function _tcp_connect(ptr: u32, len: u32): u64;
@external("env", "tcp_set_callback") export declare function _tcp_set_callback(ptr: u32, len: u32): u64;
@external("env", "tcp_write")        export declare function _tcp_write(ptr: u32, len: u32): u64;
@external("env", "tcp_close")        export declare function _tcp_close(ptr: u32, len: u32): u64;
@external("env", "tcp_request")      export declare function _tcp_request(ptr: u32, len: u32): u64;
@external("env", "ws_connect")       export declare function _ws_connect(ptr: u32, len: u32): u64;
@external("env", "ws_send")          export declare function _ws_send(ptr: u32, len: u32): u64;
@external("env", "ws_close")         export declare function _ws_close(ptr: u32, len: u32): u64;
@external("env", "shell_exec")       export declare function _shell_exec(ptr: u32, len: u32): u64;
@external("env", "log_write")        export declare function _log_write(ptr: u32, len: u32): u64;
@external("env", "sys_info")         export declare function _sys_info(ptr: u32, len: u32): u64;
@external("env", "time_now")         export declare function _time_now(ptr: u32, len: u32): u64;

// ── Internal helpers ──────────────────────────────────────────────────────────

const _scratch = new Uint8Array(512 * 1024);

/** @internal Call a host ABI function with an encoded request. */
export function abiCall(fn: (ptr: u32, len: u32) => u64, encoded: Uint8Array): MsgValue {
  const ptr = changetype<usize>(_scratch.buffer) as u32;
  memory.copy(ptr, changetype<usize>(encoded.buffer), encoded.length);
  const result = fn(ptr, encoded.length as u32);
  const resPtr = (result >> 32) as u32;
  const resLen = (result & 0xffffffff) as u32;
  if (resLen == 0) return new MsgValue();
  const resBuf = new Uint8Array(resLen as i32);
  memory.copy(changetype<usize>(resBuf.buffer), resPtr, resLen);
  return new Decoder(resBuf).decode();
}

/** @internal Check for error in ABI response and throw if present. */
export function checkError(resp: MsgValue, op: string): void {
  const e = resp.getField("error").getStr();
  if (e.length > 0) throw new Error("abi error: " + op + ": " + e);
}

/** @internal Encode an empty request `{}`. */
export function emptyReq(): Uint8Array {
  const enc = new Encoder(); enc.encode_map_header(0); return enc.finish();
}
