import { tryNormalizeConfig } from "./config.js";
import type { WatchlineOpenClawConfig } from "./config.js";
import {
  createWatchlineClient,
  formatDeliveryForOpenClaw,
  pollDeliveriesOnce,
} from "./delivery.js";
import type { DeliveryTarget } from "./delivery.js";
import {
  deliveryMetadata,
  type OpenClawPluginApiLike,
  type OpenClawService,
} from "./openclaw-types.js";
import { registerTools } from "./tools.js";

const configSchema = {
  parse: (value: unknown) => (isRecord(value) ? value : {}),
  validate: (value: unknown) =>
    isRecord(value)
      ? { ok: true, value }
      : { ok: false, errors: ["Watchline config must be an object."] },
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
          "OpenClaw session key to receive proactive Watchline events.",
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
    "Register Watchline watches and deliver matched events into OpenClaw.",
  configSchema,
  register(api: OpenClawPluginApiLike) {
    registerTools(api);
    registerCli(api);
    api.registerService?.(createDeliveryService(api));
    api.logger.info("[watchline] plugin loaded.");
  },
};

function createDeliveryService(api: OpenClawPluginApiLike): OpenClawService {
  let timeout: NodeJS.Timeout | undefined;
  let stopped = false;

  return {
    id: "watchline-delivery",
    start(ctx) {
      stopped = false;
      const configResult = tryNormalizeConfig(api.pluginConfig ?? ctx.config);
      if (!configResult.ok) {
        ctx.logger.warn(`[watchline] delivery disabled: ${configResult.error}`);
        return;
      }

      const config = configResult.config;
      if (!config.sessionKey) {
        ctx.logger.warn(
          "[watchline] delivery disabled: sessionKey is required.",
        );
        return;
      }
      const deliveryConfig = { ...config, sessionKey: config.sessionKey };
      const client = createWatchlineClient(config);
      const target = createOpenClawDeliveryTarget(api, deliveryConfig);

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
  api: OpenClawPluginApiLike,
  config: WatchlineOpenClawConfig & { sessionKey: string },
): DeliveryTarget {
  return {
    deliver: async (delivery, text) => {
      if (api.runtime?.subagent?.run) {
        await api.runtime.subagent.run({
          sessionKey: config.sessionKey,
          message: text,
          deliver: true,
          idempotencyKey: delivery.delivery_id,
          lane: "watchline-delivery",
        });
        return;
      }

      if (api.enqueueNextTurnInjection) {
        await api.enqueueNextTurnInjection({
          sessionKey: config.sessionKey,
          text,
          idempotencyKey: delivery.delivery_id,
          placement: "append_context",
          ttlMs: 10 * 60 * 1000,
          metadata: deliveryMetadata(delivery),
        });
        return;
      }

      throw new Error("OpenClaw delivery runtime is unavailable.");
    },
  };
}

function registerCli(api: OpenClawPluginApiLike): void {
  api.registerCli?.(
    ({ program }) => {
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
          console.log(`  sessionKey: ${result.config.sessionKey ?? ""}`);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
