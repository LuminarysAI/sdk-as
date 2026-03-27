/**
 * File system ABI wrappers.
 *
 * @module fs
 */

import { Encoder, MsgValue } from "./msgpack";
import {
  abiCall, checkError, emptyReq,
  _fs_read, _fs_write, _fs_create, _fs_delete, _fs_mkdir,
  _fs_ls, _fs_chmod, _fs_read_lines, _fs_grep, _fs_glob,
  _fs_allowed_dirs, _fs_copy,
} from "./abi_internal";

/**
 * Read a file. Requires `fs.enabled`.
 * @param path - Absolute path within allowed dirs.
 * @returns File contents as bytes.
 */
export function fsRead(path: string): Uint8Array {
  const enc = new Encoder(); enc.encode_map_header(1);
  enc.encode_str("path"); enc.encode_str(path);
  const resp = abiCall(_fs_read, enc.finish()); checkError(resp, "fs_read");
  return resp.getField("content").getBytes();
}

/**
 * Write (overwrite) a file. Requires `fs.enabled`.
 * @param path - Absolute path within allowed dirs.
 * @param content - File contents.
 */
export function fsWrite(path: string, content: Uint8Array): void {
  const enc = new Encoder(); enc.encode_map_header(2);
  enc.encode_str("path"); enc.encode_str(path);
  enc.encode_str("content"); enc.encode_bin(content);
  checkError(abiCall(_fs_write, enc.finish()), "fs_write");
}

/**
 * Create a new file. Fails if the file already exists. Requires `fs.enabled`.
 * @param path - Absolute path.
 * @param content - Initial contents.
 */
export function fsCreate(path: string, content: Uint8Array): void {
  const enc = new Encoder(); enc.encode_map_header(2);
  enc.encode_str("path"); enc.encode_str(path);
  enc.encode_str("content"); enc.encode_bin(content);
  checkError(abiCall(_fs_create, enc.finish()), "fs_create");
}

/**
 * Delete a file. Requires `fs.enabled`.
 * @param path - Absolute path.
 */
export function fsDelete(path: string): void {
  const enc = new Encoder(); enc.encode_map_header(1);
  enc.encode_str("path"); enc.encode_str(path);
  checkError(abiCall(_fs_delete, enc.finish()), "fs_delete");
}

/**
 * Create a directory (always recursive, like mkdir -p). Requires `fs.enabled`.
 * Supports brace expansion: `fsMkdir("/data/{a,b,c}")` creates three directories.
 * @param path - Absolute path.
 */
export function fsMkdir(path: string): void {
  const enc = new Encoder(); enc.encode_map_header(1);
  enc.encode_str("path"); enc.encode_str(path);
  checkError(abiCall(_fs_mkdir, enc.finish()), "fs_mkdir");
}

/** One allowed directory from {@link fsAllowedDirs}. */
export class AllowedDir {
  path: string = "";
  /** "ro" or "rw". */
  mode: string = "";
}

/**
 * Get the list of directories this skill is allowed to access.
 * Requires `fs.enabled`.
 * @returns Array of `AllowedDir` entries.
 */
export function fsAllowedDirs(): AllowedDir[] {
  const resp = abiCall(_fs_allowed_dirs, emptyReq()); checkError(resp, "fs_allowed_dirs");
  const raw = resp.getField("dirs");
  const result: AllowedDir[] = [];
  const n = raw.getArrayLen();
  for (let i = 0; i < n; i++) {
    const item = raw.getIndex(i);
    const d = new AllowedDir();
    d.path = item.getField("path").getStr();
    d.mode = item.getField("mode").getStr();
    result.push(d);
  }
  return result;
}

/** Directory entry from {@link fsLs}. */
export class DirEntry {
  name: string = "";
  size: i64 = 0;
  is_dir: bool = false;
  /** Unix timestamp (seconds). Only populated when `long = true`. */
  mod_time: i64 = 0;
  /** Permission bits. Only populated when `long = true`. */
  mode: u32 = 0;
  /** Human-readable permissions, e.g. "drwxr-xr-x". Only populated when `long = true`. */
  mode_str: string = "";
}

/**
 * List directory contents. Requires `fs.enabled`.
 * @param path - Absolute directory path.
 * @param long - If true, include mode/timestamps (slower).
 * @returns Array of directory entries.
 */
export function fsLs(path: string, long: bool = false): DirEntry[] {
  const enc = new Encoder(); enc.encode_map_header(2);
  enc.encode_str("path"); enc.encode_str(path);
  enc.encode_str("long"); enc.encode_bool(long);
  const resp = abiCall(_fs_ls, enc.finish()); checkError(resp, "fs_ls");
  const entries = resp.getField("entries");
  const result: DirEntry[] = [];
  const n = entries.getArrayLen();
  for (let i = 0; i < n; i++) {
    const item = entries.getIndex(i);
    const e = new DirEntry();
    e.name = item.getField("name").getStr();
    e.size = item.getField("size").getInt();
    e.is_dir = item.getField("is_dir").getBool();
    e.mod_time = item.getField("mod_time").getInt();
    e.mode = item.getField("mode").getInt() as u32;
    e.mode_str = item.getField("mode_str").getStr();
    result.push(e);
  }
  return result;
}

/** Result from {@link fsReadLines}. */
export class TextFileContent {
  lines: string[] = [];
  total_lines: i32 = 0;
  offset: i32 = 0;
  is_truncated: bool = false;
}

/**
 * Read file lines with offset/limit. Requires `fs.enabled`.
 * @param path - Absolute file path.
 * @param offset - Start line (0-based).
 * @param limit - Max lines (0 = all).
 */
export function fsReadLines(path: string, offset: i32 = 0, limit: i32 = 0): TextFileContent {
  const enc = new Encoder(); enc.encode_map_header(3);
  enc.encode_str("path"); enc.encode_str(path);
  enc.encode_str("offset"); enc.encode_i64(offset as i64);
  enc.encode_str("limit"); enc.encode_i64(limit as i64);
  const resp = abiCall(_fs_read_lines, enc.finish()); checkError(resp, "fs_read_lines");
  const r = new TextFileContent();
  const rawLines = resp.getField("lines");
  const n = rawLines.getArrayLen();
  for (let i = 0; i < n; i++) {
    r.lines.push(rawLines.getIndex(i).getStr());
  }
  r.total_lines = resp.getField("total_lines").getInt() as i32;
  r.offset = resp.getField("offset").getInt() as i32;
  r.is_truncated = resp.getField("is_truncated").getBool();
  return r;
}

/**
 * Copy a file. Requires `fs.enabled`.
 * @param source - Source file path.
 * @param dest - Destination file path.
 */
export function fsCopy(source: string, dest: string): void {
  const enc = new Encoder(); enc.encode_map_header(2);
  enc.encode_str("source"); enc.encode_str(source);
  enc.encode_str("dest"); enc.encode_str(dest);
  checkError(abiCall(_fs_copy, enc.finish()), "fs_copy");
}

/** Byte-offset range `[start, end)` within a matched line. */
export class GrepRange {
  start: i64 = 0;
  end: i64 = 0;
}

/** One line match from {@link fsGrep}. */
export class GrepLineMatch {
  line_num: i32 = 0;
  line: string = "";
  ranges: GrepRange[] = [];
}

/** One file match from {@link fsGrep}. */
export class GrepFileMatch {
  path: string = "";
  matches: GrepLineMatch[] = [];
}

/**
 * Search file contents by pattern. Requires `fs.enabled`.
 *
 * @param pattern - RE2-compatible regex (or literal when `fixed = true`).
 * @param path - Directory or file to search.
 * @param fixed - Treat pattern as literal string (default: false).
 * @param caseInsensitive - Case-insensitive matching (default: false).
 * @param withLines - Include full line text in results (default: false).
 * @param include - Glob patterns to restrict files (default: all text files).
 * @param exclude - Glob patterns to skip files.
 * @param maxCount - Max matching lines per file (0 = unlimited).
 * @param maxDepth - Max directory recursion depth (0 = unlimited).
 * @param workers - Number of parallel search workers (0 = default).
 * @param typeFilter - File type filter (e.g. "go", "ts").
 * @param ignoreDirs - Directory names to skip entirely.
 * @param filenameOnly - Return only file paths, no line details (default: false).
 */
export function fsGrep(
  pattern: string,
  path: string = "",
  fixed: bool = false,
  caseInsensitive: bool = false,
  withLines: bool = false,
  include: string[] = [],
  exclude: string[] = [],
  maxCount: i32 = 0,
  maxDepth: i32 = 0,
  workers: i32 = 0,
  typeFilter: string = "",
  ignoreDirs: string[] = [],
  filenameOnly: bool = false,
): GrepFileMatch[] {
  let fields = 3; // pattern + path + with_lines
  if (fixed) fields++;
  if (caseInsensitive) fields++;
  if (include.length > 0) fields++;
  if (exclude.length > 0) fields++;
  if (maxCount > 0) fields++;
  if (maxDepth > 0) fields++;
  if (workers > 0) fields++;
  if (typeFilter.length > 0) fields++;
  if (ignoreDirs.length > 0) fields++;
  if (filenameOnly) fields++;

  const enc = new Encoder(); enc.encode_map_header(fields);
  enc.encode_str("pattern"); enc.encode_str(pattern);
  enc.encode_str("path"); enc.encode_str(path);
  enc.encode_str("with_lines"); enc.encode_bool(withLines);
  if (fixed) { enc.encode_str("fixed"); enc.encode_bool(true); }
  if (caseInsensitive) { enc.encode_str("case_insensitive"); enc.encode_bool(true); }
  if (include.length > 0) {
    enc.encode_str("include"); enc.encode_array_header(include.length);
    for (let i = 0; i < include.length; i++) enc.encode_str(include[i]);
  }
  if (exclude.length > 0) {
    enc.encode_str("exclude"); enc.encode_array_header(exclude.length);
    for (let i = 0; i < exclude.length; i++) enc.encode_str(exclude[i]);
  }
  if (maxCount > 0) { enc.encode_str("max_count"); enc.encode_i64(maxCount as i64); }
  if (maxDepth > 0) { enc.encode_str("max_depth"); enc.encode_i64(maxDepth as i64); }
  if (workers > 0) { enc.encode_str("workers"); enc.encode_i64(workers as i64); }
  if (typeFilter.length > 0) { enc.encode_str("type_filter"); enc.encode_str(typeFilter); }
  if (ignoreDirs.length > 0) {
    enc.encode_str("ignore_dirs"); enc.encode_array_header(ignoreDirs.length);
    for (let i = 0; i < ignoreDirs.length; i++) enc.encode_str(ignoreDirs[i]);
  }
  if (filenameOnly) { enc.encode_str("filename_only"); enc.encode_bool(true); }

  const resp = abiCall(_fs_grep, enc.finish()); checkError(resp, "fs_grep");
  const rawMatches = resp.getField("matches");
  const result: GrepFileMatch[] = [];
  const n = rawMatches.getArrayLen();
  for (let i = 0; i < n; i++) {
    const item = rawMatches.getIndex(i);
    const fm = new GrepFileMatch();
    fm.path = item.getField("path").getStr();
    const lineMatches = item.getField("matches");
    const ln = lineMatches.getArrayLen();
    for (let j = 0; j < ln; j++) {
      const lm = lineMatches.getIndex(j);
      const glm = new GrepLineMatch();
      glm.line_num = lm.getField("line_num").getInt() as i32;
      glm.line = lm.getField("line").getStr();
      const rawRanges = lm.getField("ranges");
      const rn = rawRanges.getArrayLen();
      for (let k = 0; k < rn; k++) {
        const rr = rawRanges.getIndex(k);
        const gr = new GrepRange();
        gr.start = rr.getField("start").getInt();
        gr.end = rr.getField("end").getInt();
        glm.ranges.push(gr);
      }
      fm.matches.push(glm);
    }
    result.push(fm);
  }
  return result;
}

/** One result from {@link fsGlob}. */
export class GlobEntry {
  path: string = "";
  is_dir: bool = false;
}

/**
 * Find files by glob patterns. Requires `fs.enabled`.
 *
 * Supported glob syntax: `*`, `?`, `[abc]`, `**` (recursive), `{a,b}` (brace expansion).
 *
 * @param patterns - Glob patterns (union: file matches if ANY pattern hits).
 * @param path - Base directory (default: sandbox root).
 * @param onlyFiles - Return only regular files (default: false).
 * @param onlyDirs - Return only directories (default: false).
 * @param matchHidden - Include dot-files (default: false).
 * @param maxDepth - Max recursion depth (0 = unlimited).
 * @param ignoreDirs - Directory names to skip entirely.
 */
export function fsGlob(
  patterns: string[],
  path: string = "",
  onlyFiles: bool = false,
  onlyDirs: bool = false,
  matchHidden: bool = false,
  maxDepth: i32 = 0,
  ignoreDirs: string[] = [],
): GlobEntry[] {
  let fields = 2; // patterns + path
  if (onlyFiles) fields++;
  if (onlyDirs) fields++;
  if (matchHidden) fields++;
  if (maxDepth > 0) fields++;
  if (ignoreDirs.length > 0) fields++;

  const enc = new Encoder(); enc.encode_map_header(fields);
  enc.encode_str("patterns");
  enc.encode_array_header(patterns.length);
  for (let i = 0; i < patterns.length; i++) enc.encode_str(patterns[i]);
  enc.encode_str("path"); enc.encode_str(path);
  if (onlyFiles) { enc.encode_str("only_files"); enc.encode_bool(true); }
  if (onlyDirs) { enc.encode_str("only_dirs"); enc.encode_bool(true); }
  if (matchHidden) { enc.encode_str("match_hidden"); enc.encode_bool(true); }
  if (maxDepth > 0) { enc.encode_str("max_depth"); enc.encode_i64(maxDepth as i64); }
  if (ignoreDirs.length > 0) {
    enc.encode_str("ignore_dirs"); enc.encode_array_header(ignoreDirs.length);
    for (let i = 0; i < ignoreDirs.length; i++) enc.encode_str(ignoreDirs[i]);
  }

  const resp = abiCall(_fs_glob, enc.finish()); checkError(resp, "fs_glob");
  const matches = resp.getField("matches");
  const result: GlobEntry[] = [];
  const n = matches.getArrayLen();
  for (let i = 0; i < n; i++) {
    const item = matches.getIndex(i);
    const e = new GlobEntry();
    e.path = item.getField("path").getStr();
    e.is_dir = item.getField("is_dir").getBool();
    result.push(e);
  }
  return result;
}

/**
 * Change file permissions. Requires `fs.enabled`.
 * @param path - File path.
 * @param mode - Unix permission bits (e.g. 0o755 = 493).
 * @param recursive - Apply recursively for directories.
 */
export function fsChmod(path: string, mode: u32, recursive: bool = false): void {
  const enc = new Encoder(); enc.encode_map_header(3);
  enc.encode_str("path"); enc.encode_str(path);
  enc.encode_str("mode"); enc.encode_i64(mode as i64);
  enc.encode_str("recursive"); enc.encode_bool(recursive);
  checkError(abiCall(_fs_chmod, enc.finish()), "fs_chmod");
}
