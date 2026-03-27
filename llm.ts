/**
 * LLM ABI wrappers.
 *
 * @module llm
 */

import { Encoder, MsgValue } from "./msgpack";
import { abiCall, checkError, _history_get, _prompt_complete } from "./abi_internal";

/**
 * Get conversation history from the current LLM session.
 *
 * @param filter - Filter string (empty = all messages).
 * @returns Decoded history value.
 */
export function historyGet(filter: string = ""): MsgValue {
  const enc = new Encoder(); enc.encode_map_header(1);
  enc.encode_str("filter"); enc.encode_str(filter);
  const resp = abiCall(_history_get, enc.finish()); checkError(resp, "history_get");
  return resp;
}

/**
 * Send a prompt to the LLM and get a completion.
 *
 * @param prompt - The prompt text.
 * @returns Completion text.
 */
export function promptComplete(prompt: string): string {
  const enc = new Encoder(); enc.encode_map_header(1);
  enc.encode_str("prompt"); enc.encode_str(prompt);
  const resp = abiCall(_prompt_complete, enc.finish()); checkError(resp, "prompt_complete");
  return resp.getField("text").getStr();
}
