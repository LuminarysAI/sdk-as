/**
 * Request context for skill method handlers.
 *
 * @module context
 */

import { InvokeRequest, InvokeResponse } from "./entrypoint";

/**
 * Request context passed to skill method handlers.
 *
 * Provides read-only access to request metadata and allows setting
 * additional LLM context in the response.
 *
 * @example
 * ```ts
 * export function myMethod(ctx: Context, input: string): string {
 *   const sid = ctx.sessionId;
 *   ctx.setLLMContext("Processed " + input.length.toString() + " chars.");
 *   return "done";
 * }
 * ```
 */
export class Context {
  private _req: InvokeRequest;
  private _resp: InvokeResponse;

  constructor(req: InvokeRequest, resp: InvokeResponse) {
    this._req = req;
    this._resp = resp;
  }

  /** Unique request ID. */
  get requestId(): string { return this._req.request_id; }
  /** Distributed trace ID. */
  get traceId(): string { return this._req.trace_id; }
  /** User session ID. */
  get sessionId(): string { return this._req.session_id; }
  /** LLM session ID (may differ from sessionId). */
  get llmSessionId(): string { return this._req.llm_session_id; }
  /** Skill instance ID (from manifest). */
  get skillId(): string { return this._req.skill_id; }
  /** Caller skill ID (empty if called from MCP/REST). */
  get callerId(): string { return this._req.caller_id; }
  /** Method name being invoked. */
  get method(): string { return this._req.method; }
  /** Raw state bytes from previous invocation. */
  get state(): Uint8Array { return this._req.state; }

  /**
   * Set additional text context for the LLM.
   * Appears as a second content block in the MCP tool result.
   */
  setLLMContext(text: string): void { this._resp.llm_context = text; }

  /**
   * Append text to any existing LLM context, separated by newline.
   */
  appendLLMContext(text: string): void {
    if (this._resp.llm_context.length == 0) {
      this._resp.llm_context = text;
    } else {
      this._resp.llm_context += "\n" + text;
    }
  }

  /**
   * Set response state bytes (persisted for next invocation).
   */
  setState(data: Uint8Array): void { this._resp.state = data; }
}
