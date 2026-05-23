export interface WatchlineOpenClawConfig {
  apiKey: string;
  channelId: string;
  sessionKey: string;
  apiBaseUrl?: string;
  userId: string;
  pollIntervalSeconds: number;
}

const DEFAULT_POLL_INTERVAL_SECONDS = 15;
const DEFAULT_SESSION_KEY = "agent:main:main";
const DEFAULT_USER_ID = "me";

interface ConfigFields {
  apiKey?: string;
  channelId?: string;
  sessionKey?: string;
  apiBaseUrl?: string;
  userId?: string;
  pollIntervalSeconds: number;
}

export function normalizeConfig(value: unknown): WatchlineOpenClawConfig {
  const raw = isRecord(value) ? value : {};
  const config = readConfigFields(raw);
  validateConfig(config);
  return {
    apiKey: config.apiKey,
    channelId: config.channelId,
    pollIntervalSeconds: Math.max(5, Math.floor(config.pollIntervalSeconds)),
    ...(config.apiBaseUrl ? { apiBaseUrl: config.apiBaseUrl } : {}),
    sessionKey: config.sessionKey ?? DEFAULT_SESSION_KEY,
    userId: config.userId ?? DEFAULT_USER_ID,
  };
}

function readConfigFields(raw: Record<string, unknown>): ConfigFields {
  const pollIntervalSeconds =
    readNumber(raw, "pollIntervalSeconds") ?? DEFAULT_POLL_INTERVAL_SECONDS;
  return {
    pollIntervalSeconds,
    ...optionalField("apiKey", readString(raw, "apiKey")),
    ...optionalField("channelId", readString(raw, "channelId")),
    ...optionalField("sessionKey", readString(raw, "sessionKey")),
    ...optionalField("apiBaseUrl", readString(raw, "apiBaseUrl")),
    ...optionalField("userId", readString(raw, "userId")),
  };
}

function optionalField<K extends keyof ConfigFields>(
  key: K,
  value: ConfigFields[K] | undefined,
): Partial<ConfigFields> {
  return value === undefined ? {} : { [key]: value };
}

function validateConfig(
  config: ConfigFields,
): asserts config is ConfigFields & { apiKey: string; channelId: string } {
  if (!config.apiKey) throw new Error("Watchline apiKey is required.");
  if (!config.channelId) throw new Error("Watchline channelId is required.");
}

export function tryNormalizeConfig(
  value: unknown,
):
  | { ok: true; config: WatchlineOpenClawConfig }
  | { ok: false; error: string } {
  try {
    return {
      ok: true,
      config: normalizeConfig(value),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const raw = value[key];
  return typeof raw === "string" && raw.trim().length > 0
    ? raw.trim()
    : undefined;
}

function readNumber(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const raw = value[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
