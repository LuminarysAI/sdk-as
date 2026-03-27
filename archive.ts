/**
 * Archive operations (tar.gz, zip).
 *
 * @module archive
 */

import { Encoder } from "./msgpack";
import { abiCall, checkError, _archive_pack, _archive_unpack, _archive_list } from "./abi_internal";

/** Result from {@link archivePack}. */
export class ArchivePackResult {
  files_count: i32 = 0;
  format: string = "";
}

/**
 * Create a tar.gz or zip archive from a directory. Requires `fs.enabled`.
 * @param source - Source directory.
 * @param output - Output archive path.
 * @param format - "tar.gz" (default) or "zip".
 * @param exclude - Comma-separated exclude globs. Supports *, **, ?, [abc], {a,b}.
 */
export function archivePack(source: string, output: string, format: string = "tar.gz", exclude: string = ""): ArchivePackResult {
  const enc = new Encoder(); enc.encode_map_header(4);
  enc.encode_str("source"); enc.encode_str(source);
  enc.encode_str("output"); enc.encode_str(output);
  enc.encode_str("format"); enc.encode_str(format);
  enc.encode_str("exclude"); enc.encode_str(exclude);
  const resp = abiCall(_archive_pack, enc.finish()); checkError(resp, "archive_pack");
  const r = new ArchivePackResult();
  r.files_count = resp.getField("files_count").getInt() as i32;
  r.format = resp.getField("format").getStr();
  return r;
}

/**
 * Extract a tar.gz or zip archive. Requires `fs.enabled`.
 * @param archive - Archive file path.
 * @param dest - Destination directory.
 * @param format - "tar.gz" or "zip" (auto-detect by extension if empty).
 * @param exclude - Comma-separated exclude globs. Supports *, **, ?, [abc], {a,b}.
 * @param strip - Strip N leading path components.
 * @returns Number of files extracted.
 */
export function archiveUnpack(archive: string, dest: string, format: string = "", exclude: string = "", strip: i32 = 0): i32 {
  const enc = new Encoder(); enc.encode_map_header(5);
  enc.encode_str("archive"); enc.encode_str(archive);
  enc.encode_str("dest"); enc.encode_str(dest);
  enc.encode_str("format"); enc.encode_str(format);
  enc.encode_str("exclude"); enc.encode_str(exclude);
  enc.encode_str("strip"); enc.encode_i64(strip as i64);
  const resp = abiCall(_archive_unpack, enc.finish()); checkError(resp, "archive_unpack");
  return resp.getField("files_count").getInt() as i32;
}

/** Archive entry from {@link archiveList}. */
export class ArchiveEntry {
  name: string = "";
  size: i64 = 0;
  is_dir: bool = false;
}

/**
 * List contents of a tar.gz or zip archive. Requires `fs.enabled`.
 * @param archive - Archive file path.
 * @param format - "tar.gz" or "zip" (auto-detect if empty).
 * @param exclude - Comma-separated exclude globs. Supports *, **, ?, [abc], {a,b}.
 */
export function archiveList(archive: string, format: string = "", exclude: string = ""): ArchiveEntry[] {
  const enc = new Encoder(); enc.encode_map_header(3);
  enc.encode_str("archive"); enc.encode_str(archive);
  enc.encode_str("format"); enc.encode_str(format);
  enc.encode_str("exclude"); enc.encode_str(exclude);
  const resp = abiCall(_archive_list, enc.finish()); checkError(resp, "archive_list");
  const entries = resp.getField("entries");
  const result: ArchiveEntry[] = [];
  const n = entries.getArrayLen();
  for (let i = 0; i < n; i++) {
    const item = entries.getIndex(i);
    const e = new ArchiveEntry();
    e.name = item.getField("name").getStr();
    e.size = item.getField("size").getInt();
    e.is_dir = item.getField("is_dir").getBool();
    result.push(e);
  }
  return result;
}
