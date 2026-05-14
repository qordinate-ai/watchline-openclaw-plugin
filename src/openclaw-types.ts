import type { OutboundDeliveryPayload } from "@watchline/sdk-js";

interface OpenClawLogger {
  debug?: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export interface OpenClawToolResult {
  content: { type: "text"; text: string }[];
  details?: unknown;
}

interface OpenClawTool {
  name: string;
  label?: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    toolCallId: string,
    params: unknown,
    signal?: AbortSignal,
  ) => Promise<OpenClawToolResult>;
}

export interface OpenClawPluginApiLike {
  logger: OpenClawLogger;
  pluginConfig?: unknown;
  registerTool: (tool: OpenClawTool, options?: unknown) => void;
  registerCli?: (
    registrar: (input: { program: unknown }) => void,
    options?: { commands?: string[] },
  ) => void;
  registerService?: (service: OpenClawService) => void;
  enqueueNextTurnInjection?: (injection: {
    sessionKey: string;
    text: string;
    idempotencyKey?: string;
    placement?: "prepend_context" | "append_context";
    ttlMs?: number;
    metadata?: Record<string, string>;
  }) => Promise<unknown>;
  runtime?: {
    subagent?: {
      run: (params: {
        sessionKey: string;
        message: string;
        deliver?: boolean;
        idempotencyKey?: string;
        lane?: string;
      }) => Promise<{ runId: string }>;
    };
  };
}

export interface OpenClawService {
  id: string;
  start: (ctx: OpenClawServiceContext) => void | Promise<void>;
  stop?: (ctx: OpenClawServiceContext) => void | Promise<void>;
}

interface OpenClawServiceContext {
  config?: unknown;
  stateDir: string;
  workspaceDir?: string;
  logger: OpenClawLogger;
}

export function toolJsonResult(payload: unknown): OpenClawToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function deliveryMetadata(
  delivery: OutboundDeliveryPayload,
): Record<string, string> {
  return {
    delivery_id: delivery.delivery_id,
    watch_id: delivery.watch_id,
    type: delivery.type,
  };
}
