// Application constants

export const APP_NAME = "mawaDao";
export const APP_DESCRIPTION = "AI agents for every classroom";

// Domain
export const MAWADAO_DOMAIN = process.env.NEXT_PUBLIC_MAWADAO_DOMAIN || "mawadao.com";

/** Where members' workspaces live (mawa-dashboard). One host for everyone. */
export const MEMBER_SPACE_URL = (
  process.env.NEXT_PUBLIC_MEMBER_SPACE_URL || "https://agent.mawadao.com"
).replace(/\/+$/, "");
export const MEMBER_SPACE_HOST = MEMBER_SPACE_URL.replace(/^https?:\/\//, "");

/**
 * The mawa Marketplace: AI agents and tools, listed by the community. It lives on
 * mawadao.com now (merged with the old, separate "Explore AI tools" page), not here.
 */
export const MARKETPLACE_URL = process.env.NEXT_PUBLIC_MARKETPLACE_URL || `https://${MAWADAO_DOMAIN}/marketplace`;

/**
 * Names that can't be claimed as a username: infrastructure names, plus paths the
 * member space serves itself (agent.mawadao.com/<username> shares the URL space).
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "_next",
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "beta",
  "blog",
  "c",
  "cdn",
  "channels",
  "chat",
  "console",
  "dashboard",
  "demo",
  "dev",
  "docs",
  "favicon.ico",
  "ftp",
  "health",
  "help",
  "images",
  "inbox",
  "integrations",
  "mail",
  "marketplace",
  "media",
  "mission-control",
  "panel",
  "seller",
  "settings",
  "site.webmanifest",
  "staging",
  "static",
  "status",
  "support",
  "test",
  "www",
]);

/** A member's own space: https://agent.mawadao.com/<username>. */
export function memberSpaceUrl(username: string | undefined | null): string {
  return username ? `${MEMBER_SPACE_URL}/${encodeURIComponent(username)}` : MEMBER_SPACE_URL;
}

/** Build the member-space chat URL for a given username. */
export function getUserChatUrl(username: string | undefined | null): string {
  if (!username) return "/chat";
  const safe = username.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!safe) return "/chat";
  return `${MEMBER_SPACE_URL}/${safe}`;
}

// API
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Auth microservice base URL.
 * In the browser the URL is derived entirely from window.location so that no
 * build-time env var or .env.local file can accidentally bake in localhost.
 * Convention: auth service lives at  auth.<frontend-host>  (e.g. auth.mawadao.com).
 */
export function getAuthApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    const authHost = hostname.startsWith('auth.') ? hostname : `auth.${hostname}`;
    return `${protocol}//${authHost}`;
  }
  // Server-side only (API routes, SSR) — fall back to env var
  return (process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:8080').replace(/\/+$/, '');
}

/** Build an auth URL pointing to the Go auth microservice. */
export function getApiAuthUrl(path: string): string {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${getAuthApiBaseUrl()}${safePath}`;
}

// Limits
export const LIMITS = {
  POST_TITLE_MAX: 300,
  POST_CONTENT_MAX: 40000,
  COMMENT_CONTENT_MAX: 10000,
  AGENT_NAME_MAX: 32,
  AGENT_NAME_MIN: 2,
  COMMUNITY_NAME_MAX: 24,
  COMMUNITY_NAME_MIN: 2,
  DESCRIPTION_MAX: 500,
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
} as const;

// Sort options for marketplace
export const SORT_OPTIONS = {
  AGENTS: [
    { value: "popular", label: "Popular", emoji: "🔥" },
    { value: "new", label: "New", emoji: "✨" },
    { value: "top", label: "Top Rated", emoji: "⭐" },
  ],
  MARKETPLACE: [
    { value: "popular", label: "Popular" },
    { value: "new", label: "New" },
    { value: "price-low", label: "Price: Low to High" },
    { value: "price-high", label: "Price: High to Low" },
  ],
} as const;

// Agent categories for marketplace
export const AGENT_CATEGORIES = [
  { value: "customer-support", label: "Customer Support", icon: "headphones" },
  { value: "sales", label: "Sales & Marketing", icon: "trending-up" },
  { value: "writing", label: "Content & Writing", icon: "pen-tool" },
  { value: "coding", label: "Code & Development", icon: "code" },
  { value: "data", label: "Data & Analytics", icon: "bar-chart" },
  { value: "hr", label: "HR & Recruiting", icon: "users" },
  { value: "finance", label: "Finance & Accounting", icon: "dollar-sign" },
  { value: "operations", label: "Operations", icon: "settings" },
  { value: "legal", label: "Legal & Compliance", icon: "shield" },
  { value: "creative", label: "Creative & Design", icon: "palette" },
] as const;

// Interest categories for onboarding wizard
export const INTEREST_CATEGORIES = [
  { id: "customer-support", label: "Customer Support", icon: "🎧" },
  { id: "sales-automation", label: "Sales Automation", icon: "📈" },
  { id: "content-creation", label: "Content Creation", icon: "✍️" },
  { id: "data-analysis", label: "Data Analysis", icon: "📊" },
  { id: "code-assistant", label: "Code Assistant", icon: "💻" },
  { id: "hr-recruiting", label: "HR & Recruiting", icon: "👥" },
  { id: "marketing", label: "Marketing", icon: "📣" },
  { id: "operations", label: "Operations", icon: "⚙️" },
  { id: "finance", label: "Finance", icon: "💰" },
  { id: "legal", label: "Legal", icon: "⚖️" },
  { id: "creative", label: "Creative", icon: "🎨" },
  { id: "research", label: "Research", icon: "🔬" },
] as const;

// Keyboard shortcuts
export const SHORTCUTS = {
  SEARCH: { key: "k", ctrl: true, label: "⌘K" },
  HOME: { key: "h", ctrl: true, label: "⌘H" },
} as const;

// External URLs
export const GATEWAY_UI_URL =
  process.env.NEXT_PUBLIC_GATEWAY_UI_URL || "";

/** mawa redirect URL for user/agent: https://{name}.run.app */
export const GATEWAY_REDIRECT_BASE = "https://{name}.run.app";

export function getGatewayRedirectUrl(name: string): string {
  if (!name || typeof name !== "string") return GATEWAY_UI_URL;
  const safe = name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "");
  if (!safe) return GATEWAY_UI_URL;
  return GATEWAY_REDIRECT_BASE.replace("{name}", safe);
}

// mawa gateway URL (for WebSocket chat; http/https auto-converted to ws/wss)
export const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_UI_URL ||
  "http://localhost:19001";

// mawa Configuration API URL — proxied through Next.js to avoid browser ERR_CONNECTION_REFUSED
// Browser always uses the relative proxy path; server-side uses GATEWAY_CONFIG_API_URL directly
export const CONFIG_API_URL =
  typeof window !== "undefined"
    ? "/api/gateway"
    : process.env.GATEWAY_CONFIG_API_URL || "http://localhost:19002/api/v1";

/** Cloud mode flag — when true, enables JWT auth and the member space */
export const CLOUD_MODE = process.env.NEXT_PUBLIC_CLOUD_MODE === "true";

/** GCP project for Cloud Run deployments */
export const GCP_PROJECT = process.env.GCP_PROJECT || "mawadao";

/** Default region for Cloud Run services */
export const GCP_REGION = process.env.GCP_REGION || "europe-west1";

/** Proxy API prefix — all backend requests route through this in cloud mode */
export const PROXY_API_URL = "/api/proxy/v1";

// Routes
export const ROUTES = {
  HOME: "/",
  /** External: the mawa Marketplace now lives on mawadao.com. See MARKETPLACE_URL. */
  MARKETPLACE: MARKETPLACE_URL,
  WORKSPACE: "/workspace",
  CHAT: "/chat",
  AGENT_BUILDER: "/agent-builder",
  SKILLS: "/skills",
  CHANNELS: "/channels",
  SETTINGS: "/settings",
  SEARCH: "/search",
  LOGIN: "/auth/login",
  ONBOARDING: "/onboarding",
  AGENT: (id: string) => `/agent/${id}`,
  AGENT_SETUP: (id: string, channel: string) => `/agent/${id}/setup/${channel}`,
  INTEGRATIONS: "/integrations",
  INTEGRATION_SETUP: (channel: string) => `/integrations/${channel}`,
} as const;

// Error messages
export const ERRORS = {
  UNAUTHORIZED: "Please sign in to continue",
  NOT_FOUND: "The requested resource was not found",
  RATE_LIMITED: "Too many requests. Please try again later.",
  NETWORK: "Network error. Please check your connection.",
  UNKNOWN: "An unexpected error occurred",
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  API_KEY: "mawadao_api_key",
  THEME: "mawadao_theme",
  ONBOARDING_COMPLETE: "mawadao_onboarding_complete",
  INTERESTS: "mawadao_interests",
  RECENT_SEARCHES: "mawadao_recent_searches",
} as const;

// Channel types supported
export const CHANNEL_TYPES = [
  { id: "discord", label: "Discord", icon: "discord", color: "#5865F2" },
  { id: "slack", label: "Slack", icon: "slack", color: "#4A154B" },
  { id: "teams", label: "Microsoft Teams", icon: "teams", color: "#6264A7" },
  { id: "whatsapp", label: "WhatsApp", icon: "whatsapp", color: "#25D366" },
  { id: "telegram", label: "Telegram", icon: "telegram", color: "#0088cc" },
  { id: "web", label: "Web Widget", icon: "globe", color: "#2563EB" },
] as const;
