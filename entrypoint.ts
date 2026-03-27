/**
 * Core skill runtime for AssemblyScript.
 *
 * Skill entry point: request/response types, registration API,
 * and internal exports used by generated code.
 *
 * @module skill
 */

import { Encoder, Decoder, MsgValue } from "./msgpack";


/** Incoming skill invocation request. */
export class InvokeRequest {
  version: i32 = 0;
  request_id: string = "";
  trace_id: string = "";
  session_id: string = "";
  llm_session_id: string = "";
  method: string = "";
  skill_id: string = "";
  caller_id: string = "";
  state: Uint8Array = new Uint8Array(0);
  payload: Uint8Array = new Uint8Array(0);
  deadline_ns: i64 = 0;
}

/** Skill invocation response. */
export class InvokeResponse {
  version: i32 = 1;
  state: Uint8Array = new Uint8Array(0);
  payload: Uint8Array = new Uint8Array(0);
  error: string = "";
  llm_context: string = "";
}

/** Describes one parameter of a method (for `skill_describe`). */
export class MethodParam {
  name: string = "";
  description: string = "";
  type: string = "";
  required: bool = false;
}

/** Describes one exported method (for `skill_describe`). */
export class MethodDesc {
  name: string = "";
  description: string = "";
  params: MethodParam[] = [];
  mcp_hidden: bool = false;
  private_callback: bool = false;
}

/** Describes one permission requirement from `@skill:require`. */
export class RequirementDesc {
  kind: string = "";
  pattern: string = "";
  mode: string = "";
}


/** Signature for the top-level dispatch function. */
export type SkillHandler = (req: InvokeRequest) => InvokeResponse;


let _handler: SkillHandler | null = null;
let _methods: MethodDesc[] = [];
let _requirements: RequirementDesc[] = [];
let _skillId: string = "";
let _skillName: string = "";
let _skillVersion: string = "";
let _skillDescription: string = "";

/**
 * Register the dispatch handler and method descriptors.
 * Called by the generated `lib.ts` during initialization.
 *
 * @param handler - The dispatch function that routes by method name.
 * @param methods - Array of method descriptors for `skill_describe`.
 */
export function register(handler: SkillHandler, methods: MethodDesc[]): void {
  _handler = handler;
  _methods = methods;
}

/**
 * Register permission requirements from `@skill:require` annotations.
 * Called by the generated `lib.ts` during initialization.
 */
export function registerRequirements(reqs: RequirementDesc[]): void {
  _requirements = reqs;
}

/**
 * Set the skill's identity metadata from annotations.
 * Called by the generated `lib.ts` during initialization.
 *
 * @param id - Skill type ID from `@skill:id`
 * @param name - Display name from `@skill:name`
 * @param version - Version from `@skill:version`
 * @param description - Description from `@skill:desc`
 */
export function setSkillIdentity(id: string, name: string, version: string, description: string): void {
  _skillId = id;
  _skillName = name;
  _skillVersion = version;
  _skillDescription = description;
}

/**
 * Create an error response with the given message.
 * @param msg - Error message.
 */
export function errorResponse(msg: string): InvokeResponse {
  const r = new InvokeResponse();
  r.error = msg;
  return r;
}


/** @internal Encode an InvokeResponse to bytes for the host. */
function encodeResponse(resp: InvokeResponse): Uint8Array {
  const enc = new Encoder();
  let fieldCount = 3; // version, state, payload
  if (resp.error.length > 0) fieldCount++;
  if (resp.llm_context.length > 0) fieldCount++;

  enc.encode_map_header(fieldCount);
  enc.encode_str("version"); enc.encode_i64(resp.version as i64);
  enc.encode_str("state");   enc.encode_bin(resp.state);
  enc.encode_str("payload"); enc.encode_bin(resp.payload);
  if (resp.error.length > 0) { enc.encode_str("error"); enc.encode_str(resp.error); }
  if (resp.llm_context.length > 0) { enc.encode_str("llm_context"); enc.encode_str(resp.llm_context); }
  return enc.finish();
}

/** SDK version identifier: major.minor.patch packed as (major << 16) | (minor << 8) | patch. */
const SDK_VERSION_MAJOR: u32 = 0;
const SDK_VERSION_MINOR: u32 = 2;
const SDK_VERSION_PATCH: u32 = 0;
const SDK_VERSION: u32 = (SDK_VERSION_MAJOR << 16) | (SDK_VERSION_MINOR << 8) | SDK_VERSION_PATCH;

/** @internal Encode the SkillDescriptor to bytes for the host. */
function encodeDescriptor(): Uint8Array {
  const enc = new Encoder();
  let fieldCount = 3; // version + methods + sdk_version
  if (_skillId.length > 0) fieldCount++;
  if (_skillName.length > 0) fieldCount++;
  if (_skillVersion.length > 0) fieldCount++;
  if (_skillDescription.length > 0) fieldCount++;
  if (_requirements.length > 0) fieldCount++;

  enc.encode_map_header(fieldCount);
  enc.encode_str("version"); enc.encode_i64(1);
  if (_skillId.length > 0) { enc.encode_str("skill_id"); enc.encode_str(_skillId); }
  if (_skillName.length > 0) { enc.encode_str("skill_name"); enc.encode_str(_skillName); }
  if (_skillVersion.length > 0) { enc.encode_str("skill_version"); enc.encode_str(_skillVersion); }
  if (_skillDescription.length > 0) { enc.encode_str("description"); enc.encode_str(_skillDescription); }
  enc.encode_str("sdk_version"); enc.encode_i64(SDK_VERSION as i64);

  enc.encode_str("methods"); enc.encode_array_header(_methods.length);
  for (let i = 0; i < _methods.length; i++) {
    const m = _methods[i];
    let mFields = 2; // name, description
    if (m.params.length > 0) mFields++;
    if (m.mcp_hidden) mFields++;
    if (m.private_callback) mFields++;
    enc.encode_map_header(mFields);
    enc.encode_str("name");        enc.encode_str(m.name);
    enc.encode_str("description"); enc.encode_str(m.description);
    if (m.params.length > 0) {
      enc.encode_str("params"); enc.encode_array_header(m.params.length);
      for (let j = 0; j < m.params.length; j++) {
        const p = m.params[j];
        let pFields = 2; // name, type
        if (p.description.length > 0) pFields++;
        if (p.required) pFields++;
        enc.encode_map_header(pFields);
        enc.encode_str("name"); enc.encode_str(p.name);
        enc.encode_str("type"); enc.encode_str(p.type);
        if (p.description.length > 0) { enc.encode_str("description"); enc.encode_str(p.description); }
        if (p.required) { enc.encode_str("required"); enc.encode_bool(true); }
      }
    }
    if (m.mcp_hidden) { enc.encode_str("mcp_hidden"); enc.encode_bool(true); }
    if (m.private_callback) { enc.encode_str("private_callback"); enc.encode_bool(true); }
  }

  if (_requirements.length > 0) {
    enc.encode_str("requirements"); enc.encode_array_header(_requirements.length);
    for (let i = 0; i < _requirements.length; i++) {
      const r = _requirements[i];
      let rFields = 2; // kind + pattern
      if (r.mode.length > 0) rFields++;
      enc.encode_map_header(rFields);
      enc.encode_str("kind"); enc.encode_str(r.kind);
      enc.encode_str("pattern"); enc.encode_str(r.pattern);
      if (r.mode.length > 0) { enc.encode_str("mode"); enc.encode_str(r.mode); }
    }
  }

  return enc.finish();
}

/** @internal Decode an InvokeRequest from a raw pointer+length (no copy). */
function decodeRequest(ptr: u32, len: u32): InvokeRequest {
  const view = Uint8Array.wrap(_inputBuf.buffer, 0, len as i32);
  const dec = new Decoder(view);
  const raw = dec.decode();
  const req = new InvokeRequest();
  if (raw.kind != 7) return req;
  req.version        = raw.getField("version").getInt() as i32;
  req.request_id     = raw.getField("request_id").getStr();
  req.trace_id       = raw.getField("trace_id").getStr();
  req.session_id     = raw.getField("session_id").getStr();
  req.llm_session_id = raw.getField("llm_session_id").getStr();
  req.method         = raw.getField("method").getStr();
  req.skill_id       = raw.getField("skill_id").getStr();
  req.caller_id      = raw.getField("caller_id").getStr();
  req.state          = raw.getField("state").getBytes();
  req.payload        = raw.getField("payload").getBytes();
  req.deadline_ns    = raw.getField("deadline_ns").getInt();
  return req;
}


let _inputBuf = new Uint8Array(0);

const RESULT_BUF_INIT: i32 = 64 * 1024;
let _resultBuf = new ArrayBuffer(RESULT_BUF_INIT);
let _resultLen: i32 = 0;


/**
 * Allocate a buffer for the host to write the request into.
 * @param size - Number of bytes the host needs.
 * @returns Pointer to the buffer in WASM linear memory.
 */
export function skill_alloc(size: u32): u32 {
  if (size as i32 > _inputBuf.length) {
    _inputBuf = new Uint8Array(size as i32);
  }
  return changetype<usize>(_inputBuf.buffer) as u32;
}

/**
 * Called by the host after reading the result.
 * Shrinks the persistent result buffer if it grew beyond the initial size.
 * @param ptr - Result pointer returned by skill_handle/skill_describe.
 */
export function skill_free(ptr: u32): void {
  const resultPtr = changetype<usize>(_resultBuf) as u32;
  if (ptr == resultPtr) {
    _resultBuf = new ArrayBuffer(0);
    _inputBuf = new Uint8Array(0);
  }
}

/**
 * Main entry point called by the host for each skill invocation.
 * @param reqPtr - Pointer to the encoded InvokeRequest.
 * @param reqLen - Length of the request in bytes.
 * @returns Pointer and length packed as a single u64.
 */
export function skill_handle(reqPtr: u32, reqLen: u32): u64 {
  let respBytes: Uint8Array;
  if (_handler == null) {
    respBytes = encodeResponse(errorResponse("no handler registered"));
  } else {
    const req = decodeRequest(reqPtr, reqLen);
    const resp = _handler!(req);
    resp.version = 1;
    respBytes = encodeResponse(resp);
  }

  return writeResult(respBytes);
}

/**
 * Return the skill descriptor (methods, params, identity) to the host.
 * Called by the host for `tools/list`.
 * @returns Pointer and length packed as a single u64.
 */
export function skill_describe(): u64 {
  return writeResult(encodeDescriptor());
}

/**
 * @internal Write result bytes into the persistent result buffer.
 * Grows the buffer only when needed (never shrinks).
 */
function writeResult(bytes: Uint8Array): u64 {
  const len = bytes.length;
  if (len > _resultBuf.byteLength) {
    _resultBuf = new ArrayBuffer(len);
  }
  const ptr = changetype<usize>(_resultBuf);
  memory.copy(ptr, changetype<usize>(bytes.buffer), len);
  _resultLen = len;
  return ((ptr as u64) << 32) | (len as u64);
}


// Context is defined in context.ts and re-exported via abi.ts / index.ts.
