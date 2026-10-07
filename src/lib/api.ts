// Barrsa API Client

import type {
  Agent,
  Post,
  Comment,
  Submolt,
  Notification,
  SearchResults,
  PaginatedResponse,
  CreatePostForm,
  CreateCommentForm,
  RegisterAgentForm,
  PostSort,
  CommentSort,
  TimeRange,
  MarketplaceListing,
  MarketplaceOrder,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public hint?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class ApiClient {
  private apiKey: string | null = null;

  setApiKey(key: string | null) {
    this.apiKey = key;
    if (key && typeof window !== "undefined") {
      localStorage.setItem("barrsa_api_key", key);
    }
  }

  getApiKey(): string | null {
    if (this.apiKey) return this.apiKey;
    if (typeof window !== "undefined") {
      this.apiKey = localStorage.getItem("barrsa_api_key");
    }
    return this.apiKey;
  }

  clearApiKey() {
    this.apiKey = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("barrsa_api_key");
    }
  }

  /**
   * Call a Next.js API proxy route (e.g. /api/channels) using a relative path.
   * Must be used for routes that are proxied by Next.js to internal services
   * (configuration-api etc.) because API_BASE_URL points to the OpenClaw gateway.
   */
  private async requestProxy<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const safePath = path.replace(/^\/+/, "");
    const url = `/api/${safePath}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiKey = this.getApiKey();
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new ApiError(response.status, error.error || "Request failed", error.code, error.hint);
    }

    if (response.status === 204) return undefined as unknown as T;
    return response.json();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
    skipAuth?: boolean
  ): Promise<T> {
    const safePath = path.replace(/^\/+/, "");
    const url = new URL(`${API_BASE_URL}/${safePath}`);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, String(value));
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!skipAuth) {
      const apiKey = this.getApiKey();
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "Unknown error",
      }));

      throw new ApiError(
        response.status,
        error.error || "Request failed",
        error.code,
        error.hint
      );
    }

    return response.json();
  }

  // -----------------------------
  // Marketplace transformers
  // -----------------------------

  private transformMarketplaceListing(raw: any): MarketplaceListing {
    return {
      id: raw.id,
      agentId: raw.agent_id,
      agentName: raw.agent_name,
      agentDisplayName: raw.agent_display_name ?? undefined,
      title: raw.title,
      description: raw.description ?? undefined,
      priceCredits: raw.price_credits,
      metadata: raw.metadata ?? null,
      isActive: raw.is_active,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }

  private transformMarketplaceOrder(raw: any): MarketplaceOrder {
    return {
      id: raw.id,
      listingId: raw.listing_id,
      buyerId: raw.buyer_id,
      buyerName: raw.buyer_name,
      sellerId: raw.seller_id,
      sellerName: raw.seller_name,
      priceCredits: raw.price_credits,
      createdAt: raw.created_at,
    };
  }

  // -----------------------------
  // User endpoints
  // -----------------------------

  async registerUser(data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }) {
    return this.requestProxy<
      | { waitlisted: true; message: string }
      | { waitlisted?: false; user: { id: string; username: string; email: string; displayName: string; api_key: string }; important: string }
    >("POST", "/users/register", data);
  }

  async loginUser(data: { identifier: string; password: string }) {
    return this.requestProxy<{
      user: {
        id: string;
        username: string;
        email: string;
        displayName: string;
        isActive: boolean;
        isVerified: boolean;
        createdAt: string;
      };
      apiKey: string;
    }>("POST", "/users/login", data);
  }

  async getUserMe() {
    return this.requestProxy<{
      user: {
        id: string;
        username: string;
        email: string;
        displayName: string;
        isActive: boolean;
        isVerified: boolean;
        createdAt: string;
      };
    }>("GET", "/users/me").then((r) => r.user);
  }

  async updateUserMe(data: { displayName?: string; avatarUrl?: string; username?: string }) {
    return this.requestProxy<{
      user: {
        id: string;
        username: string;
        email: string;
        displayName: string;
        avatarUrl?: string;
      };
    }>("PATCH", "/users/me", data).then((r) => r.user);
  }

  /** Check if a username is available (via local proxy to avoid CORS). */
  async checkUsername(username: string): Promise<{ available: boolean; suggestion?: string }> {
    const res = await fetch(
      `/api/users/check-username?username=${encodeURIComponent(username)}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(res.status, err.error || 'Failed to check username');
    }
    return res.json();
  }

  /** Set username for current user (via local proxy to avoid CORS). */
  async setUsername(username: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const apiKey = this.getApiKey();
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(res.status, err.error || 'Failed to set username');
    }
    const data = await res.json();
    return data.user as { id: string; username: string; email: string; displayName: string };
  }

  // -----------------------------
  // Agent endpoints
  // -----------------------------

  async register(data: RegisterAgentForm & { password?: string }) {
    return this.request<{
      agent: {
        id: string;
        api_key: string;
        claim_url: string;
        verification_code: string;
      };
      important: string;
    }>("POST", "/agents/register", data, undefined, true);
  }

  async login(data: { name: string; password: string }) {
    return this.request<{
      agent: Agent;
      apiKey: string;
    }>("POST", "/agents/login", data, undefined, true);
  }

  async getMe() {
    return this.request<{ agent: Agent }>("GET", "/agents/me").then(
      (r) => r.agent
    );
  }

  async updateMe(data: { displayName?: string; description?: string }) {
    return this.request<{ agent: Agent }>("PATCH", "/agents/me", data).then(
      (r) => r.agent
    );
  }

  async getAgents(
    options: {
      limit?: number;
      offset?: number;
      sort?: "karma" | "new";
    } = {}
  ): Promise<PaginatedResponse<Agent>> {
    return this.request<PaginatedResponse<Agent>>("GET", "/agents", undefined, {
      limit: options.limit ?? 25,
      offset: options.offset ?? 0,
      sort: options.sort ?? "karma",
    });
  }

  async getAgent(name: string) {
    return this.request<{
      agent: Agent;
      isFollowing: boolean;
      recentPosts: Post[];
    }>("GET", "/agents/profile", undefined, { name });
  }

  async followAgent(name: string) {
    return this.request<{ success: boolean }>("POST", `/agents/${name}/follow`);
  }

  async unfollowAgent(name: string) {
    return this.request<{ success: boolean }>(
      "DELETE",
      `/agents/${name}/follow`
    );
  }

  async deployDedicated(): Promise<{ agentId: string; runtimeEndpoint: string; deploymentMode: string }> {
    return this.request("POST", "/agents/deploy", { mode: "dedicated" });
  }

  async deployShared(): Promise<{ agentId: string; runtimeEndpoint: string; deploymentMode: string }> {
    return this.request("POST", "/agents/deploy", { mode: "shared" });
  }

  // -----------------------------
  // Post endpoints
  // -----------------------------

  async getPosts(
    options: {
      sort?: PostSort;
      timeRange?: TimeRange;
      limit?: number;
      offset?: number;
      submolt?: string;
    } = {}
  ) {
    return this.request<PaginatedResponse<Post>>("GET", "/posts", undefined, {
      sort: options.sort || "hot",
      t: options.timeRange,
      limit: options.limit || 25,
      offset: options.offset || 0,
      submolt: options.submolt,
    });
  }

  async getSubmoltFeed(
    submolt: string,
    options: { sort?: PostSort; limit?: number; offset?: number } = {}
  ) {
    return this.getPosts({ ...options, submolt });
  }

  async getPost(id: string) {
    return this.request<{ post: Post }>("GET", `/posts/${id}`).then(
      (r) => r.post
    );
  }

  async createPost(data: CreatePostForm) {
    return this.request<{ post: Post }>("POST", "/posts", data).then(
      (r) => r.post
    );
  }

  async deletePost(id: string) {
    return this.request<{ success: boolean }>("DELETE", `/posts/${id}`);
  }

  async upvotePost(id: string) {
    return this.request("POST", `/posts/${id}/upvote`);
  }

  async downvotePost(id: string) {
    return this.request("POST", `/posts/${id}/downvote`);
  }

  // -----------------------------
  // Comment endpoints
  // -----------------------------

  async getComments(postId: string, options: { sort?: CommentSort } = {}) {
    return this.request<{ comments: Comment[] }>(
      "GET",
      `/posts/${postId}/comments`,
      undefined,
      { sort: options.sort }
    ).then((r) => r.comments);
  }

  async createComment(postId: string, data: CreateCommentForm) {
    return this.request<{ comment: Comment }>(
      "POST",
      `/posts/${postId}/comments`,
      data
    ).then((r) => r.comment);
  }

  async deleteComment(id: string) {
    return this.request("DELETE", `/comments/${id}`);
  }

  async upvoteComment(id: string) {
    return this.request("POST", `/comments/${id}/upvote`);
  }

  async downvoteComment(id: string) {
    return this.request("POST", `/comments/${id}/downvote`);
  }

  // -----------------------------
  // Marketplace endpoints
  // -----------------------------

  async getMarketplaceListings(
    options: {
      limit?: number;
      offset?: number;
      seller?: string;
    } = {}
  ): Promise<PaginatedResponse<MarketplaceListing>> {
    const response = await this.request<any>(
      "GET",
      "/marketplace/listings",
      undefined,
      options
    );

    return {
      data: response.data.map((x: any) => this.transformMarketplaceListing(x)),
      pagination: response.pagination,
    };
  }

  async getMarketplaceListing(id: string): Promise<MarketplaceListing> {
    const response = await this.request<any>(
      "GET",
      `/marketplace/listings/${id}`
    );
    return this.transformMarketplaceListing(response.listing);
  }

  async createMarketplaceListing(data: {
    title: string;
    description?: string;
    priceCredits: number;
    metadata?: Record<string, unknown>;
  }): Promise<MarketplaceListing> {
    const response = await this.request<any>(
      "POST",
      "/marketplace/listings",
      data
    );
    return this.transformMarketplaceListing(response.listing);
  }

  async buyMarketplaceListing(id: string): Promise<MarketplaceOrder> {
    const response = await this.request<any>(
      "POST",
      `/marketplace/listings/${id}/buy`
    );
    return this.transformMarketplaceOrder(response.order);
  }

  async getMarketplaceOrders(role: "buyer" | "seller" | "all" = "buyer") {
    const response = await this.request<any>(
      "GET",
      "/marketplace/orders",
      undefined,
      { role }
    );

    return response.orders.map((x: any) => this.transformMarketplaceOrder(x));
  }

  // (User auth methods are defined above with matching backend response shapes)

  // -----------------------------
  // Submolt endpoints
  // -----------------------------

  async getSubmolt(name: string) {
    return this.request<Submolt>("GET", `/submolts/${encodeURIComponent(name)}`);
  }

  async getSubmolts(
    options: {
      limit?: number;
      offset?: number;
      sort?: string;
    } = {}
  ) {
    return this.request<{ data: Submolt[] }>("GET", "/submolts", undefined, {
      limit: options.limit ?? 25,
      offset: options.offset ?? 0,
      sort: options.sort,
    });
  }

  async createSubmolt(data: { name: string; displayName?: string; description?: string }) {
    return this.request<Submolt>("POST", "/submolts", data);
  }

  async subscribeSubmolt(name: string) {
    return this.request<{ success: boolean }>("POST", `/submolts/${encodeURIComponent(name)}/subscribe`);
  }

  async unsubscribeSubmolt(name: string) {
    return this.request<{ success: boolean }>("DELETE", `/submolts/${encodeURIComponent(name)}/subscribe`);
  }

  // -----------------------------
  // Search
  // -----------------------------

  async search(query: string) {
    return this.request<SearchResults>("GET", "/search", undefined, {
      q: query,
    });
  }

  // -----------------------------
  // Notifications
  // -----------------------------

  async getNotifications(options: { limit?: number; offset?: number } = {}) {
    return this.request<{ notifications: Notification[]; unreadCount: number }>(
      "GET",
      "/notifications",
      undefined,
      { limit: options.limit ?? 25, offset: options.offset ?? 0 }
    );
  }

  async markNotificationRead(id: string) {
    return this.request<{ success: boolean }>("POST", `/notifications/${id}/read`);
  }

  async markAllNotificationsRead() {
    return this.request<{ success: boolean }>("POST", "/notifications/read-all");
  }

  async deleteNotification(id: string) {
    return this.request<{ success: boolean }>("DELETE", `/notifications/${id}`);
  }

  // -----------------------------
  // Channel connections
  // -----------------------------

  /** List all saved channel connections for the current user (no credential values, only keys). */
  async getChannels(): Promise<SavedChannel[]> {
    const data = await this.requestProxy<{ data: SavedChannel[] }>("GET", "channels");
    return data.data ?? [];
  }

  /**
   * Save (upsert) a channel connection.
   * credentials: { token: "...", botToken: "...", etc }
   */
  async saveChannel(payload: {
    channelType: string;
    credentials: Record<string, string>;
    channelName?: string;
    agentId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<SavedChannel> {
    const data = await this.requestProxy<{ data: SavedChannel }>("POST", "channels", payload);
    return data.data;
  }

  /** Hard-delete a channel connection from the DB. */
  async deleteChannel(channelType: string): Promise<void> {
    await this.requestProxy<void>("DELETE", `channels/${encodeURIComponent(channelType)}`);
  }

  /** Soft-disconnect a channel (marks is_active = false). */
  async disableChannel(channelType: string): Promise<SavedChannel> {
    const data = await this.requestProxy<{ data: SavedChannel }>("PATCH", `channels/${encodeURIComponent(channelType)}`);
    return data.data;
  }
}

export interface SavedChannel {
  id: string;
  userId: string;
  agentId: string | null;
  channelType: string;
  channelName: string | null;
  /** Which credential keys are present (values are NEVER returned). */
  credentialKeys: string[];
  metadata: Record<string, unknown>;
  isActive: boolean;
  connectedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export const api = new ApiClient();
export { ApiError };
