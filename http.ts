/**
 * HTTP/HTTPS client API.
 *
 * @module http
 */

import { Encoder, MsgValue } from "./msgpack";
import { abiCall, checkError, _http_get, _http_post, _http_request } from "./abi_internal";

/**
 * Parse a JSON object string into an ordered HttpHeader array.
 *
 * Preserves key order from the source string.
 * Handles escaped quotes in values.
 *
 * ```ts
 * const hdrs = headersFromJSON('{"Authorization":"Bearer tok","Accept":"application/json"}');
 * // hdrs[0].name == "Authorization", hdrs[0].value == "Bearer tok"
 * // hdrs[1].name == "Accept",        hdrs[1].value == "application/json"
 * ```
 */
export function headersFromJSON(json: string): HttpHeader[] {
  const result: HttpHeader[] = [];
  const s = json.trim();
  if (s.length == 0 || s == "{}") return result;
  let i = s.indexOf("{");
  if (i < 0) return result;
  i++;
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c == 125) break; // '}'
    if (c != 34) { i++; continue; } // skip until '"'
    i++; // skip opening '"'
    const keyEnd = _hdrFindQuote(s, i);
    const key = s.substring(i, keyEnd);
    i = keyEnd + 1;
    while (i < s.length && s.charCodeAt(i) != 34) i++;
    if (i >= s.length) break;
    i++; // skip opening '"'
    const valEnd = _hdrFindQuote(s, i);
    const val = s.substring(i, valEnd);
    i = valEnd + 1;
    const h = new HttpHeader();
    h.name = key;
    h.value = val;
    result.push(h);
  }
  return result;
}

/** Find closing '"' skipping escaped quotes. */
function _hdrFindQuote(s: string, pos: i32): i32 {
  let i = pos;
  while (i < s.length) {
    if (s.charCodeAt(i) == 34) return i;
    if (s.charCodeAt(i) == 92) { i += 2; continue; }
    i++;
  }
  return i;
}

/** HTTP header name/value pair. */
export class HttpHeader {
  name: string = "";
  value: string = "";
}

/** HTTP cookie. */
export class HttpCookie {
  name: string = "";
  value: string = "";
  domain: string = "";
  path: string = "";
  expires: i64 = 0;
  secure: bool = false;
  httponly: bool = false;
}

/** HTTP response from `httpGet` / `httpPost` / `httpRequest`. */
export class HttpResponse {
  /** HTTP status code. */
  status: i32 = 0;
  /** Response headers. */
  headers: HttpHeader[] = [];
  /** Response cookies. */
  cookies: HttpCookie[] = [];
  /** Response body. */
  body: Uint8Array = new Uint8Array(0);
  /** True if body was truncated due to maxBytes limit. */
  truncated: bool = false;
}

/**
 * Perform an HTTP GET request. Requires `http.enabled`, URL in allowlist.
 * @param url - Request URL.
 * @param timeoutMs - Timeout in milliseconds (0 = 30s default).
 * @param maxBytes - Max response body size (0 = 1MB default).
 */
export function httpGet(url: string, timeoutMs: i64 = 0, maxBytes: i64 = 0): HttpResponse {
  const enc = new Encoder(); enc.encode_map_header(3);
  enc.encode_str("url"); enc.encode_str(url);
  enc.encode_str("timeout_ms"); enc.encode_i64(timeoutMs);
  enc.encode_str("max_bytes"); enc.encode_i64(maxBytes);
  const resp = abiCall(_http_get, enc.finish()); checkError(resp, "http_get");
  return _parseHttpResponse(resp);
}

/**
 * Perform an HTTP POST request. Requires `http.enabled`, URL in allowlist.
 * @param url - Request URL.
 * @param body - Request body.
 * @param contentType - Content-Type header value (empty = "application/octet-stream").
 * @param timeoutMs - Timeout in milliseconds (0 = 30s default).
 * @param maxBytes - Max response body size (0 = 1MB default).
 */
export function httpPost(url: string, body: Uint8Array, contentType: string = "", timeoutMs: i64 = 0, maxBytes: i64 = 0): HttpResponse {
  const enc = new Encoder(); enc.encode_map_header(5);
  enc.encode_str("url"); enc.encode_str(url);
  enc.encode_str("body"); enc.encode_bin(body);
  enc.encode_str("content_type"); enc.encode_str(contentType);
  enc.encode_str("timeout_ms"); enc.encode_i64(timeoutMs);
  enc.encode_str("max_bytes"); enc.encode_i64(maxBytes);
  const resp = abiCall(_http_post, enc.finish()); checkError(resp, "http_post");
  return _parseHttpResponse(resp);
}

/**
 * Perform a custom HTTP request. Requires `http.enabled`, URL in allowlist.
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.).
 * @param url - Request URL.
 * @param body - Request body (empty for GET/HEAD).
 * @param headers - Request headers.
 * @param cookies - Request cookies.
 * @param timeoutMs - Timeout in milliseconds (0 = 30s default).
 * @param maxBytes - Max response body size (0 = 1MB default).
 * @param followRedirects - Follow HTTP redirects (default: false).
 * @param useJar - Enable persistent cookie jar (default: false).
 * @returns HTTP response.
 */
export function httpRequest(
  method: string,
  url: string,
  body: Uint8Array = new Uint8Array(0),
  headers: HttpHeader[] = [],
  cookies: HttpCookie[] = [],
  timeoutMs: i64 = 0,
  maxBytes: i64 = 0,
  followRedirects: bool = false,
  useJar: bool = false,
): HttpResponse {
  let fields = 4; // method + url + body + headers
  if (cookies.length > 0) fields++;
  if (timeoutMs > 0) fields++;
  if (maxBytes > 0) fields++;
  if (followRedirects) fields++;
  if (useJar) fields++;

  const enc = new Encoder(); enc.encode_map_header(fields);
  enc.encode_str("method"); enc.encode_str(method);
  enc.encode_str("url"); enc.encode_str(url);
  enc.encode_str("body"); enc.encode_bin(body);
  enc.encode_str("headers");
  enc.encode_array_header(headers.length);
  for (let i = 0; i < headers.length; i++) {
    enc.encode_map_header(2);
    enc.encode_str("name");  enc.encode_str(headers[i].name);
    enc.encode_str("value"); enc.encode_str(headers[i].value);
  }
  if (cookies.length > 0) {
    enc.encode_str("cookies");
    enc.encode_array_header(cookies.length);
    for (let i = 0; i < cookies.length; i++) {
      enc.encode_map_header(2);
      enc.encode_str("name");  enc.encode_str(cookies[i].name);
      enc.encode_str("value"); enc.encode_str(cookies[i].value);
    }
  }
  if (timeoutMs > 0) { enc.encode_str("timeout_ms"); enc.encode_i64(timeoutMs); }
  if (maxBytes > 0) { enc.encode_str("max_bytes"); enc.encode_i64(maxBytes); }
  if (followRedirects) { enc.encode_str("follow_redirects"); enc.encode_bool(true); }
  if (useJar) { enc.encode_str("use_jar"); enc.encode_bool(true); }

  const resp = abiCall(_http_request, enc.finish()); checkError(resp, "http_request");
  return _parseHttpResponse(resp);
}

/** Parse host HTTP response into typed HttpResponse. */
function _parseHttpResponse(resp: MsgValue): HttpResponse {
  const r = new HttpResponse();
  r.status = resp.getField("status").getInt() as i32;
  r.body = resp.getField("body").getBytes();
  r.truncated = resp.getField("truncated").getBool();

  const rawHeaders = resp.getField("headers");
  const hn = rawHeaders.getArrayLen();
  for (let i = 0; i < hn; i++) {
    const item = rawHeaders.getIndex(i);
    const h = new HttpHeader();
    h.name = item.getField("name").getStr();
    h.value = item.getField("value").getStr();
    r.headers.push(h);
  }

  const rawCookies = resp.getField("cookies");
  const cn = rawCookies.getArrayLen();
  for (let i = 0; i < cn; i++) {
    const item = rawCookies.getIndex(i);
    const c = new HttpCookie();
    c.name = item.getField("name").getStr();
    c.value = item.getField("value").getStr();
    c.domain = item.getField("domain").getStr();
    c.path = item.getField("path").getStr();
    c.expires = item.getField("expires").getInt();
    c.secure = item.getField("secure").getBool();
    c.httponly = item.getField("httponly").getBool();
    r.cookies.push(c);
  }

  return r;
}

