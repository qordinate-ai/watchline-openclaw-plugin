/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// OpenClaw provides this type at runtime/plugin load time; keep it type-only so
// the published plugin does not depend on the full OpenClaw npm package.
// @ts-expect-error - OpenClaw is intentionally not a package dependency.
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

import { tryNormalizeConfig } from "./config.js";
import type { WatchlineOpenClawConfig } from "./config.js";
import {
  createWatchlineClient,
  formatDeliveryForOpenClaw,
  pollDeliveriesOnce,
} from "./delivery.js";
import type { DeliveryLogger, DeliveryTarget } from "./delivery.js";

const configSchema = {
  safeParse: (value: unknown) => ({
    success: true,
    data: isRecord(value) ? value : {},
  }),
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      apiKey: {
        type: "string",
        description: "Watchline project API key.",
      },
      channelId: {
        type: "string",
        description: "Watchline pull channel ID.",
      },
      sessionKey: {
        type: "string",
        description:
          "Optional OpenClaw session key override for proactive Watchline events. Defaults to the main session.",
      },
      apiBaseUrl: {
        type: "string",
        description: "Watchline API base URL.",
      },
      userId: {
        type: "string",
        description: "Default Watchline user_id for personal OpenClaw watches.",
      },
      pollIntervalSeconds: {
        type: "number",
        description: "Seconds between pull-delivery polls.",
      },
    },
  },
};

const watchlinePlugin = {
  id: "watchline",
  name: "Watchline",
  description:
    "Deliver matched Watchline events into OpenClaw from a local pull channel.",
  configSchema,
  register(api: OpenClawPluginApi) {
    registerCli(api);
    api.registerService(createDeliveryService(api));
    api.logger.info("[watchline] plugin loaded.");
  },
};

function createDeliveryService(api: OpenClawPluginApi) {
  let timeout: NodeJS.Timeout | undefined;
  let stopped = false;

  return {
    id: "watchline-delivery",
    start(ctx: { logger: DeliveryLogger }) {
      stopped = false;
      const configResult = tryNormalizeConfig(api.pluginConfig);
      if (!configResult.ok) {
        ctx.logger.warn(`[watchline] delivery disabled: ${configResult.error}`);
        return;
      }

      const config = configResult.config;
      const client = createWatchlineClient(config);
      const target = createOpenClawDeliveryTarget(api, config);

      const tick = async (): Promise<void> => {
        if (stopped) return;
        try {
          const result = await pollDeliveriesOnce({
            client,
            channelId: config.channelId,
            target,
            logger: ctx.logger,
          });
          if (result.delivered > 0) {
            ctx.logger.info(
              `[watchline] delivered ${String(result.delivered)} event${result.delivered === 1 ? "" : "s"}.`,
            );
          }
        } catch (error) {
          ctx.logger.error(
            `[watchline] delivery poll failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        } finally {
          scheduleNextTick();
        }
      };
      const scheduleNextTick = (): void => {
        if (stopped) return;
        timeout = setTimeout(() => {
          void tick();
        }, config.pollIntervalSeconds * 1000);
      };

      timeout = setTimeout(() => {
        void tick();
      }, 0);
    },
    stop() {
      stopped = true;
      if (timeout) clearTimeout(timeout);
    },
  };
}

function createOpenClawDeliveryTarget(
  api: OpenClawPluginApi,
  config: WatchlineOpenClawConfig,
): DeliveryTarget {
  return {
    deliver: async (delivery, text) => {
      await api.runtime.subagent.run({
        sessionKey: config.sessionKey,
        message: text,
        deliver: true,
        idempotencyKey: delivery.delivery_id,
        lane: "watchline-delivery",
      });
    },
  };
}

function registerCli(api: OpenClawPluginApi): void {
  api.registerCli(
    ({ program }: { program: unknown }) => {
      const command = asCommander(program)
        .command("watchline")
        .description("Watchline plugin utilities");

      command
        .command("status")
        .description("Check Watchline plugin configuration")
        .action(() => {
          const result = tryNormalizeConfig(api.pluginConfig);
          if (!result.ok) {
            console.log(`Watchline is not configured: ${result.error}`);
            return;
          }
          console.log("Watchline is configured.");
          console.log(`  channelId: ${result.config.channelId}`);
          console.log(`  userId:    ${result.config.userId}`);
          console.log(`  sessionKey: ${result.config.sessionKey}`);
          console.log("");
          console.log("Hosted MCP command for watch tools:");
          console.log(mcpSetCommand(result.config));
        });

      command
        .command("install-mcp")
        .description("Configure OpenClaw's hosted Watchline MCP server")
        .action(() => {
          const result = tryNormalizeConfig(api.pluginConfig);
          if (!result.ok) {
            throw new Error(`Watchline is not configured: ${result.error}`);
          }
          installMcpServer(result.config);
        });

      command
        .command("preview-delivery")
        .description("Print the text shape Watchline injects into OpenClaw")
        .action(() => {
          console.log(
            formatDeliveryForOpenClaw({
              type: "watchline.match",
              version: "1",
              delivery_id: "del_preview",
              watch_id: "watch_preview",
              user_id: "me",
              intent: "urgent billing emails",
              source: {
                app: "gmail",
                event_type: "gmail_email_received",
                source_event_id: "msg_preview",
              },
              occurred_at: new Date().toISOString(),
              matched_at: new Date().toISOString(),
              event: {
                from: "customer@example.com",
                subject: "Production invoice failure",
                snippet: "Our invoice payment is failing before renewal.",
              },
            }),
          );
        });
    },
    { commands: ["watchline"] },
  );
}

function installMcpServer(config: WatchlineOpenClawConfig): void {
  const configPath = resolveOpenClawConfigPath();
  const existingConfig = readOpenClawConfig(configPath);
  const openClawConfig = existingConfig.config;
  openClawConfig.mcp = {
    ...asRecord(openClawConfig.mcp),
    servers: {
      ...asRecord(asRecord(openClawConfig.mcp).servers),
      watchline: mcpServerConfig(config),
    },
  };
  mkdirSync(dirname(configPath), { recursive: true });
  if (existingConfig.raw) {
    writeFileSync(`${configPath}.watchline-mcp.bak`, existingConfig.raw, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
  writeFileSync(configPath, `${JSON.stringify(openClawConfig, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(`Saved Watchline MCP server to ${configPath}.`);
  console.log("Restart OpenClaw gateway to load the MCP server:");
  console.log("  openclaw gateway restart");
}

function resolveOpenClawConfigPath(): string {
  if (process.env.OPENCLAW_CONFIG_PATH) return process.env.OPENCLAW_CONFIG_PATH;
  if (process.env.OPENCLAW_STATE_DIR) {
    return join(process.env.OPENCLAW_STATE_DIR, "openclaw.json");
  }
  return join(homedir(), ".openclaw", "openclaw.json");
}

function readOpenClawConfig(configPath: string): {
  config: Record<string, unknown>;
  raw?: string;
} {
  if (!existsSync(configPath)) return { config: {} };
  const raw = readFileSync(configPath, "utf8");
  return {
    config: JSON.parse(raw) as Record<string, unknown>,
    raw,
  };
}

function mcpSetCommand(config: WatchlineOpenClawConfig): string {
  return `openclaw mcp set watchline '${JSON.stringify(mcpServerConfig(config))}'`;
}

function mcpServerConfig(config: WatchlineOpenClawConfig): {
  transport: "streamable-http";
  url: string;
  headers: {
    Authorization: string;
    "x-watchline-channel-id": string;
    "x-watchline-user-id": string;
  };
} {
  const baseUrl = config.apiBaseUrl ?? "https://api.watch.qordinate.ai";
  const url = new URL("/v1/mcp", baseUrl);
  return {
    transport: "streamable-http",
    url: url.toString(),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "x-watchline-channel-id": config.channelId,
      "x-watchline-user-id": config.userId,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

interface CommandLike {
  command: (name: string) => CommandLike;
  description: (description: string) => CommandLike;
  action: (handler: () => void) => CommandLike;
}

function asCommander(value: unknown): CommandLike {
  return value as CommandLike;
}

export default watchlinePlugin;
