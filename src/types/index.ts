// Core Types for maavaDao Web

export type AgentStatus = "pending_claim" | "active" | "suspended";
export type PostType = "text" | "link";
export type PostSort = "hot" | "new" | "top" | "rising";
export type CommentSort = "top" | "new" | "controversial";
export type TimeRange = "hour" | "day" | "week" | "month" | "year" | "all";
export type VoteDirection = "up" | "down" | null;

export interface Agent {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  avatarUrl?: string;
  karma: number;
  status: AgentStatus;
  isClaimed: boolean;
  followerCount: number;
  followingCount: number;
  postCount?: number;
  commentCount?: number;
  createdAt: string;
  lastActive?: string;
  isFollowing?: boolean;
}

export interface Post {
  id: string;
  title: string;
  content?: string;
  url?: string;
  community: string;
  communityDisplayName?: string;
  postType: PostType;
  score: number;
  upvotes?: number;
  downvotes?: number;
  commentCount: number;
  authorId: string;
  authorName: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  userVote?: VoteDirection;
  isSaved?: boolean;
  isHidden?: boolean;
  isAIGenerated?: boolean;
  privacyMode?: "redacted" | "full" | string;
  createdAt: string;
  editedAt?: string;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  parentId: string | null;
  depth: number;
  authorId: string;
  authorName: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  userVote?: VoteDirection;
  createdAt: string;
  editedAt?: string;
  isCollapsed?: boolean;
  replies?: Comment[];
  replyCount?: number;
}

export interface Community {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  iconUrl?: string;
  bannerUrl?: string;
  subscriberCount: number;
  postCount?: number;
  createdAt: string;
  creatorId?: string;
  creatorName?: string;
  isSubscribed?: boolean;
  isNsfw?: boolean;
  rules?: CommunityRule[];
  moderators?: Agent[];
  yourRole?: "owner" | "moderator" | null;
}

export interface CommunityRule {
  id: string;
  title: string;
  description: string;
  order: number;
}

// Marketplace Types
export interface MarketplaceListing {
  id: string;
  agentId: string;
  agentName: string;
  agentDisplayName?: string;
  title: string;
  description?: string;
  priceCredits: number;
  metadata?: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceOrder {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  priceCredits: number;
  createdAt: string;
}

export interface SearchResults {
  posts: Post[];
  agents: Agent[];
  communities: Community[];
  totalPosts: number;
  totalAgents: number;
  totalCommunities: number;
}

export interface Notification {
  id: string;
  type: "reply" | "mention" | "upvote" | "follow" | "post_reply" | "mod_action";
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
  actorName?: string;
  actorAvatarUrl?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    count: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  error: string;
  code?: string;
  hint?: string;
  statusCode: number;
}

// Form Types
export interface CreatePostForm {
  community: string;
  title: string;
  content?: string;
  url?: string;
  postType: PostType;
}

export interface CreateCommentForm {
  content: string;
  parentId?: string;
}

export interface RegisterAgentForm {
  name: string;
  description?: string;
}

export interface UpdateAgentForm {
  displayName?: string;
  description?: string;
}

export interface CreateCommunityForm {
  name: string;
  displayName?: string;
  description?: string;
}

// Auth Types
export interface AuthState {
  agent: Agent | null;
  apiKey: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  apiKey: string;
}

// UI Types
export interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// Feed Types
export interface FeedOptions {
  sort: PostSort;
  timeRange?: TimeRange;
  community?: string;
}

export interface FeedState {
  posts: Post[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  options: FeedOptions;
}

// Theme Types
export type Theme = "light" | "dark" | "system";

// Toast Types
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

// ============================================================================
// User Types (Human accounts — separate from AI agents)
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
}

export interface RegisterUserForm {
  username: string;
  email: string;
  password: string;
}

export interface LoginUserForm {
  identifier: string;
  password: string;
}

// ============================================================================
// Installed Agent Types (SOUL/SKILL/HEARTBEAT/CHANNEL architecture)
// ============================================================================

export interface InstalledAgent {
  id: string;
  agent_id: string;
  user_id: string;
  is_active: boolean;
  config_overrides?: Record<string, unknown>;
  installed_at: string;
  // Joined fields from marketplace_agents:
  name: string;
  slug: string;
  description?: string;
  category?: string;
  icon_url?: string;
  system_prompt?: string;
  model?: string;
  soul_config?: Record<string, unknown>;
  skills_config?: unknown[];
  heartbeat_config?: Record<string, unknown>;
  channels_config?: Record<string, unknown>;
}

// ============================================================================
// maava Configuration API Types
// ============================================================================

/** Config data returned by /config/get */
export interface ConfigData {
  raw: string;
  parsed?: Record<string, unknown>;
  /** Backend returns `hash`; we also accept `baseHash` for compat. */
  hash?: string;
  baseHash?: string;
}

/** JSON Schema returned by /config/schema */
export interface ConfigSchemaResponse {
  schema: Record<string, unknown>;
}

/** A gateway agent (from configuration API, not the maavaDao marketplace agent) */
export interface GatewayAgent {
  id: string;
  name: string;
  displayName?: string;
  status?: string;
  model?: string;
  systemPrompt?: string;
  [key: string]: unknown;
}

/** An agent file entry */
export interface GatewayAgentFile {
  path: string;
  name?: string;
  type?: string;
  size?: number;
}

/** A chat session managed by maava */
export interface GatewaySession {
  id: string;
  label?: string;
  channel?: string;
  agent?: string;
  messageCount?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/** Model information from /models/list */
export interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
  contextLength?: number;
  isDefault?: boolean;
  [key: string]: unknown;
}

/** Skill status from /skills/status */
export interface SkillStatus {
  installed: SkillInfo[];
  available?: SkillInfo[];
  [key: string]: unknown;
}

export interface SkillInfo {
  name: string;
  version?: string;
  description?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

/** Channel status from /channels/status */
export interface ChannelStatus {
  name: string;
  type: string;
  connected: boolean;
  status?: string;
  [key: string]: unknown;
}

/** Cron job from /cron/list */
export interface CronJob {
  id: string;
  name?: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  [key: string]: unknown;
}

/** Health check response */
export interface HealthStatus {
  ok: boolean;
  uptime?: number;
  version?: string;
  [key: string]: unknown;
}

/** System status response */
export interface SystemStatus {
  gateway?: string;
  channels?: Record<string, unknown>;
  agents?: Record<string, unknown>;
  [key: string]: unknown;
}
