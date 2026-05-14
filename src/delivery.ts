import type { WatchlineOpenClawConfig } from "./config.js";
import type {
  OutboundDeliveryPayload,
  WatchlineClient,
} from "@watchline/sdk-js";
import { WatchlineClient as WatchlineSdkClient } from "@watchline/sdk-js";

export interface DeliveryLogger {
  debug?: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export interface DeliveryTarget {
  deliver: (delivery: OutboundDeliveryPayload, text: string) => Promise<void>;
}

export interface PollResult {
  delivered: number;
  acknowledged: number;
}

export function createWatchlineClient(
  config: WatchlineOpenClawConfig,
): WatchlineClient {
  return new WatchlineSdkClient({
    apiKey: config.apiKey,
    ...(config.apiBaseUrl ? { baseUrl: config.apiBaseUrl } : {}),
  });
}

export async function pollDeliveriesOnce(input: {
  client: WatchlineClient;
  channelId: string;
  target: DeliveryTarget;
  logger: DeliveryLogger;
}): Promise<PollResult> {
  let cursor: string | undefined;
  const ackIds: string[] = [];
  let delivered = 0;

  do {
    const response = await input.client.deliveries.pending({
      channel_id: input.channelId,
      limit: 50,
      ...(cursor ? { cursor } : {}),
    });

    for (const delivery of response.data) {
      const text = formatDeliveryForOpenClaw(delivery);
      await input.target.deliver(delivery, text);
      ackIds.push(delivery.delivery_id);
      delivered += 1;
    }

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  if (ackIds.length > 0) {
    await input.client.deliveries.ack({
      channel_id: input.channelId,
      delivery_ids: ackIds,
    });
    input.logger.info(
      `[watchline] acknowledged ${String(ackIds.length)} deliver${ackIds.length === 1 ? "y" : "ies"}.`,
    );
  }

  return { delivered, acknowledged: ackIds.length };
}

export function formatDeliveryForOpenClaw(
  delivery: OutboundDeliveryPayload,
): string {
  if (delivery.type === "watchline.match") {
    return [
      `Matched event with user intent: ${delivery.intent}`,
      "",
      "Use this event as the fresh context for the current task. Only act if the user intent asks for action.",
      "",
      "Event:",
      JSON.stringify(delivery.event, null, 2),
    ].join("\n");
  }

  return [
    `Watch needs action: ${delivery.action}`,
    "",
    `User intent: ${delivery.intent}`,
    "",
    "Connection links:",
    JSON.stringify(delivery.connect_urls ?? {}, null, 2),
  ].join("\n");
}
