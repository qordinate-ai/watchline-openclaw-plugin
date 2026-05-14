import { normalizeConfig } from "./config.js";
import { createWatchlineClient } from "./delivery.js";
import type { OpenClawPluginApiLike } from "./openclaw-types.js";
import { toolJsonResult } from "./openclaw-types.js";
import { toolDescriptions } from "./tool-descriptions.js";

export function registerTools(api: OpenClawPluginApiLike): void {
  registerStartWatchTool(api);
  registerContinueWatchTool(api);
  registerListWatchesTool(api);
  for (const action of ["pause", "resume", "delete"] as const) {
    registerWatchActionTool(api, action);
  }
}

function registerStartWatchTool(api: OpenClawPluginApiLike): void {
  api.registerTool({
    name: "start_watch",
    label: "Start Watch",
    description: toolDescriptions.startWatch,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["intent"],
      properties: {
        intent: {
          type: "string",
          description: toolDescriptions.startWatchIntent,
        },
      },
    },
    execute: async (_toolCallId, params) => {
      const config = normalizeConfig(api.pluginConfig);
      const record = asRecord(params);
      return toolJsonResult(
        await createWatchlineClient(config).watches.create({
          channel_id: config.channelId,
          user_id: config.userId,
          intent: readRequiredString(record, "intent"),
        }),
      );
    },
  });
}

function registerContinueWatchTool(api: OpenClawPluginApiLike): void {
  api.registerTool({
    name: "continue_watch",
    label: "Continue Watch",
    description: toolDescriptions.continueWatch,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["watch_id", "message"],
      properties: {
        watch_id: { type: "string", description: toolDescriptions.watchId },
        message: {
          type: "string",
          description: toolDescriptions.continueWatchMessage,
        },
      },
    },
    execute: async (_toolCallId, params) => {
      const config = normalizeConfig(api.pluginConfig);
      const record = asRecord(params);
      return toolJsonResult(
        await createWatchlineClient(config).watches.message({
          watch_id: readRequiredString(record, "watch_id"),
          user_id: config.userId,
          message: readRequiredString(record, "message"),
        }),
      );
    },
  });
}

function registerListWatchesTool(api: OpenClawPluginApiLike): void {
  api.registerTool({
    name: "list_watches",
    label: "List Watches",
    description: toolDescriptions.listWatches,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    execute: async () => {
      const config = normalizeConfig(api.pluginConfig);
      return toolJsonResult(
        await createWatchlineClient(config).watches.list({
          user_id: config.userId,
        }),
      );
    },
  });
}

function registerWatchActionTool(
  api: OpenClawPluginApiLike,
  action: "pause" | "resume" | "delete",
): void {
  api.registerTool({
    name: `${action}_watch`,
    label: `${capitalize(action)} Watch`,
    description: descriptionForAction(action),
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["watch_id"],
      properties: {
        watch_id: { type: "string", description: toolDescriptions.watchId },
      },
    },
    execute: async (_toolCallId, params) => runWatchAction(api, action, params),
  });
}

function descriptionForAction(action: "pause" | "resume" | "delete"): string {
  if (action === "pause") return toolDescriptions.pauseWatch;
  if (action === "resume") return toolDescriptions.resumeWatch;
  return toolDescriptions.deleteWatch;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

async function runWatchAction(
  api: OpenClawPluginApiLike,
  action: "pause" | "resume" | "delete",
  params: unknown,
) {
  const config = normalizeConfig(api.pluginConfig);
  const client = createWatchlineClient(config);
  const record = asRecord(params);
  const watchId = readRequiredString(record, "watch_id");
  const request = {
    watch_id: watchId,
    user_id: config.userId,
  };
  if (action === "pause")
    return toolJsonResult(await client.watches.pause(request));
  if (action === "resume")
    return toolJsonResult(await client.watches.resume(request));
  await client.watches.delete(request);
  return toolJsonResult({ status: "deleted", watch_id: watchId });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = readOptionalString(record, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}
