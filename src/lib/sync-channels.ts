import pool from "@/lib/db";
import { debugWarn } from "@/lib/logger";

const BUCKET_MANAGER_URL = process.env.BUCKET_MANAGER_URL || "";
const BUCKET_MANAGER_API_SECRET = process.env.BUCKET_MANAGER_API_SECRET || "";
const SHARED_BUCKET =
  process.env.GCS_SHARED_BUCKET ||
  process.env.GCS_BUCKET ||
  "mawadao-agent-data";

const MANAGED_CHANNEL_TYPES = [
  "discord",
  "telegram",
  "slack",
  "teams",
  "whatsapp",
  "signal",
  "line",
  "viber",
  "web",
];

type ChannelRow = {
  channel_type: string;
  credentials: unknown;
  is_active: boolean;
};

const DEFAULT_OPENCLAW_CONFIG = {
  meta: {
    version: "1.0.0",
    createdAt: "",
  },
  gateway: {
    auth: {
      token: "",
    },
    http: {
      endpoints: {
        chatCompletions: { enabled: true },
      },
    },
    reload: {
      mode: "debounce",
      debounceMs: 500,
    },
    nodes: {
      browser: false,
    },
  },
  agents: {
    defaults: {
      workspace: "~/.openclaw",
      models: ["openclaw"],
      memorySearch: true,
    },
    list: [],
  },
  channels: {
    defaults: {
      groupPolicy: "disabled",
      heartbeat: false,
    },
  },
  skills: {
    load: {
      watch: true,
      watchDebounceMs: 500,
    },
  },
  tools: {
    web: { enabled: true },
    exec: { enabled: false },
  },
  memory: {
    backend: "sqlite",
    citations: true,
  },
};

function parseCredentials(raw: unknown): Record<string, string> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return {};
}

function buildChannelEntry(
  channelType: string,
  credentials: Record<string, string>,
): Record<string, unknown> {
  const pick = (key: string) => credentials[key]?.trim() || undefined;

  switch (channelType) {
    case "telegram":
      return {
        enabled: true,
        botToken: pick("botToken"),
        dmPolicy: "open",
        groupPolicy: "open",
        allowFrom: ["*"],
      };
    case "discord":
      return {
        enabled: true,
        token: pick("token"),
        groupPolicy: "open",
        dm: {
          enabled: true,
          policy: "open",
          allowFrom: ["*"],
        },
      };
    case "slack":
      return {
        enabled: true,
        botToken: pick("botToken"),
        appToken: pick("appToken"),
      };
    case "teams": {
      const entry: Record<string, unknown> = {
        enabled: true,
        appId: pick("appId"),
        appPassword: pick("appPassword"),
      };
      if (pick("tenantId")) {
        entry.tenantId = pick("tenantId");
      }
      return entry;
    }
    case "whatsapp":
      return {
        enabled: true,
        phoneNumberId: pick("phoneNumberId"),
        accessToken: pick("accessToken"),
        verifyToken: pick("verifyToken"),
        dm: {
          enabled: true,
          policy: "open",
          allowFrom: ["*"],
        },
      };
    case "signal":
      return {
        enabled: true,
        phoneNumber: pick("phoneNumber"),
        apiUrl: pick("apiUrl"),
        dm: {
          enabled: true,
          policy: "open",
          allowFrom: ["*"],
        },
      };
    case "line":
      return {
        enabled: true,
        channelAccessToken: pick("channelAccessToken"),
        channelSecret: pick("channelSecret"),
        dm: {
          enabled: true,
          policy: "open",
          allowFrom: ["*"],
        },
      };
    case "viber":
      return {
        enabled: true,
        authToken: pick("authToken"),
        botName: pick("botName"),
        dm: {
          enabled: true,
          policy: "open",
          allowFrom: ["*"],
        },
      };
    default:
      return {
        enabled: true,
        ...Object.fromEntries(Object.entries(credentials).filter(([, value]) => value?.trim())),
      };
  }
}

async function getCloudRunIdentityToken(audience: string): Promise<string | null> {
  if (!process.env.K_SERVICE) {
    return null;
  }

  try {
    const metaUrl =
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity" +
      `?audience=${encodeURIComponent(audience)}`;
    const res = await fetch(metaUrl, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.text()).trim();
  } catch {
    return null;
  }
}

async function bucketManagerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (BUCKET_MANAGER_API_SECRET) {
    headers["X-Bucket-Manager-Secret"] = BUCKET_MANAGER_API_SECRET;
  }
  const token = await getCloudRunIdentityToken(BUCKET_MANAGER_URL);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function readUserConfig(userId: string): Promise<Record<string, unknown> | null> {
  if (!BUCKET_MANAGER_URL) {
    return null;
  }

  const filePath = `${userId}/mountfolder/openclaw.json`;
  try {
    const res = await fetch(
      `${BUCKET_MANAGER_URL}/api/v1/buckets/${encodeURIComponent(SHARED_BUCKET)}/files/${filePath}`,
      {
        headers: await bucketManagerHeaders(),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as unknown;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

async function writeUserConfig(userId: string, data: unknown): Promise<void> {
  if (!BUCKET_MANAGER_URL) {
    throw new Error("BUCKET_MANAGER_URL is not configured");
  }

  const filePath = `${userId}/mountfolder/openclaw.json`;
  const res = await fetch(
    `${BUCKET_MANAGER_URL}/api/v1/buckets/${encodeURIComponent(SHARED_BUCKET)}/files/${filePath}`,
    {
      method: "PUT",
      headers: await bucketManagerHeaders(),
      body: JSON.stringify(data, null, 2),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`bucket-manager write failed (HTTP ${res.status}): ${body}`);
  }
}

async function getGatewayUrl(subdomain: string | null | undefined): Promise<string | null> {
  if (!subdomain) {
    return null;
  }

  try {
    const result = await pool.query<{ runtime_endpoint: string }>(
      `SELECT runtime_endpoint FROM agents WHERE subdomain = $1 AND runtime_endpoint IS NOT NULL LIMIT 1`,
      [subdomain],
    );
    return result.rows[0]?.runtime_endpoint?.trim() || null;
  } catch {
    return null;
  }
}

async function notifyGateway(
  gatewayUrl: string,
  userJwt: string,
  channelsPatch: Record<string, unknown>,
  pluginEntriesPatch: Record<string, unknown>,
): Promise<void> {
  try {
    const res = await fetch(`${gatewayUrl}/api/v1/config/patch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({
        raw: JSON.stringify({
          channels: channelsPatch,
          plugins: { entries: pluginEntriesPatch },
        }),
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      debugWarn(`[syncChannelsToGcs] Gateway config.patch returned HTTP ${res.status}`);
    }
  } catch (err) {
    debugWarn("[syncChannelsToGcs] Gateway unreachable:", (err as Error).message);
  }
}

export async function syncChannelsToGcs(
  userId: string,
  subdomain?: string | null,
  userJwt?: string | null,
): Promise<boolean> {
  let rows: ChannelRow[];
  try {
    const result = await pool.query<ChannelRow>(
      `SELECT channel_type, credentials, is_active
       FROM agent_channels
       WHERE user_id = $1`,
      [userId],
    );
    rows = result.rows;
  } catch (err) {
    console.error("[syncChannelsToGcs] DB query failed:", err);
    return false;
  }

  let config: Record<string, unknown> = JSON.parse(JSON.stringify(DEFAULT_OPENCLAW_CONFIG));
  try {
    const existing = await readUserConfig(userId);
    if (existing) {
      config = { ...existing };
    }
  } catch {
    // Fall back to defaults.
  }

  const existingChannels =
    config.channels && typeof config.channels === "object" && !Array.isArray(config.channels)
      ? { ...(config.channels as Record<string, unknown>) }
      : {};

  for (const type of MANAGED_CHANNEL_TYPES) {
    delete existingChannels[type];
  }

  const activeChannelsPatch: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row.is_active || !MANAGED_CHANNEL_TYPES.includes(row.channel_type)) {
      continue;
    }

    const entry = buildChannelEntry(row.channel_type, parseCredentials(row.credentials));
    existingChannels[row.channel_type] = entry;
    activeChannelsPatch[row.channel_type] = entry;
  }
  config.channels = existingChannels;

  const pluginsObject =
    config.plugins && typeof config.plugins === "object" && !Array.isArray(config.plugins)
      ? { ...(config.plugins as Record<string, unknown>) }
      : {};
  const existingEntries =
    pluginsObject.entries &&
    typeof pluginsObject.entries === "object" &&
    !Array.isArray(pluginsObject.entries)
      ? { ...(pluginsObject.entries as Record<string, unknown>) }
      : {};

  for (const type of MANAGED_CHANNEL_TYPES) {
    existingEntries[type] = { enabled: type in activeChannelsPatch };
  }

  config.plugins = { ...pluginsObject, entries: existingEntries };

  let gcsOk = false;
  try {
    await writeUserConfig(userId, config);
    gcsOk = true;
  } catch (err) {
    console.error("[syncChannelsToGcs] GCS write failed:", err);
  }

  if (userJwt) {
    const gatewayUrl = await getGatewayUrl(subdomain);
    if (gatewayUrl) {
      await notifyGateway(gatewayUrl, userJwt, activeChannelsPatch, existingEntries);
    }
  }

  return gcsOk;
}