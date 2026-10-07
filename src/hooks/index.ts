import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import useSWR, { SWRConfiguration } from "swr";
import { useInView } from "react-intersection-observer";
import { api, ApiError, type SavedChannel } from "@/lib/api";
import { configApi } from "@/lib/config-api";
import { useAuthStore, useFeedStore, useUIStore } from "@/store";
import type {
  Post,
  Comment,
  Agent,
  Submolt,
  PostSort,
  CommentSort,
  ConfigData,
  ConfigSchemaResponse,
  OpenClawSession,
  ModelInfo,
  SkillStatus,
  ChannelStatus,
  CronJob,
  HealthStatus,
  SystemStatus,
  OpenClawAgentFile,
} from "@/types";
import { debounce } from "@/lib/utils";

// SWR fetcher
const fetcher = <T>(fn: () => Promise<T>) => fn();

// Auth hooks
export function useAuth() {
  const { agent, user, apiKey, isLoading, error, login, logout, refresh } =
    useAuthStore();

  useEffect(() => {
    if (apiKey && !agent && !user) refresh();
  }, [apiKey, agent, user, refresh]);

  return {
    agent,
    user,
    apiKey,
    isLoading,
    error,
    isAuthenticated: !!agent || !!user,
    login,
    logout,
    refresh,
  };
}

// Post hooks
export function usePost(postId: string, config?: SWRConfiguration) {
  return useSWR<Post>(
    postId ? ["post", postId] : null,
    () => api.getPost(postId),
    config
  );
}

export function usePosts(
  options: { sort?: PostSort; submolt?: string } = {},
  config?: SWRConfiguration
) {
  const key = useMemo(
    () => ["posts", options.sort || "hot", options.submolt || "all"],
    [options.sort, options.submolt]
  );
  return useSWR(
    key,
    () => api.getPosts({ sort: options.sort, submolt: options.submolt }),
    config
  );
}

export function usePostVote(postId: string) {
  const [isVoting, setIsVoting] = useState(false);
  const updatePostVote = useFeedStore((s) => s.updatePostVote);

  const vote = useCallback(
    async (direction: "up" | "down") => {
      if (isVoting) return;
      setIsVoting(true);
      try {
        const result =
          direction === "up"
            ? await api.upvotePost(postId)
            : await api.downvotePost(postId);
        const scoreDiff =
          result.action === "upvoted"
            ? 1
            : result.action === "downvoted"
            ? -1
            : 0;
        updatePostVote(
          postId,
          result.action === "removed" ? null : direction,
          scoreDiff
        );
      } catch (err) {
        console.error("Vote failed:", err);
      } finally {
        setIsVoting(false);
      }
    },
    [postId, isVoting, updatePostVote]
  );

  return { vote, isVoting };
}

// Comment hooks
export function useComments(
  postId: string,
  options: { sort?: CommentSort } = {},
  config?: SWRConfiguration
) {
  return useSWR<Comment[]>(
    postId ? ["comments", postId, options.sort || "top"] : null,
    () => api.getComments(postId, options),
    config
  );
}

export function useCommentVote(commentId: string) {
  const [isVoting, setIsVoting] = useState(false);

  const vote = useCallback(
    async (direction: "up" | "down") => {
      if (isVoting) return;
      setIsVoting(true);
      try {
        direction === "up"
          ? await api.upvoteComment(commentId)
          : await api.downvoteComment(commentId);
      } catch (err) {
        console.error("Vote failed:", err);
      } finally {
        setIsVoting(false);
      }
    },
    [commentId, isVoting]
  );

  return { vote, isVoting };
}

// Agent hooks
export type AgentSort = "karma" | "new";

export function useAgents(
  options: { sort?: AgentSort; limit?: number; offset?: number } = {},
  config?: SWRConfiguration
) {
  const key = useMemo(
    () => ["agents", options.sort ?? "karma", options.offset ?? 0],
    [options.sort, options.offset]
  );
  return useSWR(
    key,
    () =>
      api.getAgents({
        sort: options.sort,
        limit: options.limit,
        offset: options.offset,
      }),
    config
  );
}

export function useAgent(name: string, config?: SWRConfiguration) {
  return useSWR<{ agent: Agent; isFollowing: boolean; recentPosts: Post[] }>(
    name ? ["agent", name] : null,
    () => api.getAgent(name),
    config
  );
}

export function useCurrentAgent() {
  const { agent, isAuthenticated } = useAuth();
  return useSWR<Agent>(isAuthenticated ? ["me"] : null, () => api.getMe(), {
    fallbackData: agent || undefined,
  });
}

// Submolt hooks
export function useSubmolt(name: string, config?: SWRConfiguration) {
  return useSWR<Submolt>(
    name ? ["submolt", name] : null,
    () => api.getSubmolt(name),
    config
  );
}

export function useSubmolts(config?: SWRConfiguration) {
  return useSWR<{ data: Submolt[] }>(
    ["submolts"],
    () => api.getSubmolts(),
    config
  );
}

// Search hook
export function useSearch(query: string, config?: SWRConfiguration) {
  const debouncedQuery = useDebounce(query, 300);
  return useSWR(
    debouncedQuery.length >= 2 ? ["search", debouncedQuery] : null,
    () => api.search(debouncedQuery),
    config
  );
}

// Infinite scroll hook
export function useInfiniteScroll(onLoadMore: () => void, hasMore: boolean) {
  const { ref, inView } = useInView({ threshold: 0, rootMargin: "100px" });

  useEffect(() => {
    if (inView && hasMore) onLoadMore();
  }, [inView, hasMore, onLoadMore]);

  return { ref, inView };
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Local storage hook
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(newValue));
        }
        return newValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}

// Media query hook
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

// Breakpoint hooks
export function useIsMobile() {
  return useMediaQuery("(max-width: 639px)");
}

export function useIsTablet() {
  return useMediaQuery("(min-width: 640px) and (max-width: 1023px)");
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}

// Click outside hook
export function useClickOutside<T extends HTMLElement>(callback: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [callback]);

  return ref;
}

// Keyboard shortcut hook
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === key.toLowerCase() &&
        (!options.ctrl || event.ctrlKey || event.metaKey) &&
        (!options.shift || event.shiftKey) &&
        (!options.alt || event.altKey)
      ) {
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [key, callback, options]);
}

// Copy to clipboard hook
export function useCopyToClipboard(): [
  boolean,
  (text: string) => Promise<void>
] {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, []);

  return [copied, copy];
}

// Toggle hook
export function useToggle(
  initialValue = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue((v) => !v), []);
  return [value, toggle, setValue];
}

// Previous value hook
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export function isValidAgentName(name: string): boolean {
  // Must be 2–32 chars
  if (name.length < 2 || name.length > 32) return false;

  // Only letters, numbers, and underscores
  const regex = /^[A-Za-z0-9_]+$/;

  return regex.test(name);
}

// ============================================================================
// OpenClaw Configuration API hooks
// ============================================================================

/**
 * Returns a SWR key only when the config API has a reachable (non-localhost) URL.
 * Passing `null` as key tells SWR to skip the request entirely.
 */
function openclawKey(segments: string[]): string[] | null {
  return configApi.isUnavailable() ? null : segments;
}

/** Fetch the current OpenClaw config (raw YAML + parsed + baseHash). */
export function useConfig(config?: SWRConfiguration) {
  return useSWR<ConfigData>(
    openclawKey(["openclaw", "config"]),
    () => configApi.configGet(),
    { revalidateOnFocus: false, ...config }
  );
}

/** Fetch the JSON schema for the config. */
export function useConfigSchema(config?: SWRConfiguration) {
  return useSWR<ConfigSchemaResponse>(
    openclawKey(["openclaw", "config-schema"]),
    () => configApi.configSchema(),
    { revalidateOnFocus: false, ...config }
  );
}

/** Gateway health check. */
export function useGatewayHealth(config?: SWRConfiguration) {
  return useSWR<HealthStatus>(
    openclawKey(["openclaw", "health"]),
    () => configApi.health(),
    { refreshInterval: 30_000, ...config }
  );
}

/** Gateway system status. */
export function useGatewayStatus(config?: SWRConfiguration) {
  return useSWR<SystemStatus>(
    openclawKey(["openclaw", "status"]),
    () => configApi.status(),
    { refreshInterval: 30_000, ...config }
  );
}

/** List available models. */
export function useModels(config?: SWRConfiguration) {
  return useSWR<ModelInfo[]>(
    openclawKey(["openclaw", "models"]),
    () => configApi.modelsList(),
    { revalidateOnFocus: false, ...config }
  );
}

/** List chat sessions. */
export function useSessions(config?: SWRConfiguration) {
  return useSWR<OpenClawSession[]>(
    openclawKey(["openclaw", "sessions"]),
    () => configApi.sessionsList(),
    config
  );
}

/** Get skills status. */
export function useSkills(config?: SWRConfiguration) {
  return useSWR<SkillStatus>(
    openclawKey(["openclaw", "skills"]),
    () => configApi.skillsStatus(),
    { revalidateOnFocus: false, ...config }
  );
}

/** Get channel statuses from OpenClaw gateway. */
export function useChannels(config?: SWRConfiguration) {
  return useSWR<ChannelStatus[]>(
    openclawKey(["openclaw", "channels"]),
    () => configApi.channelsStatus(),
    { refreshInterval: 30_000, onErrorRetry: () => {}, ...config }
  );
}

/** Get saved channel connections from the mawaDao DB (per-user). */
export function useSavedChannels(config?: SWRConfiguration) {
  const { isAuthenticated } = useAuth();
  return useSWR<SavedChannel[]>(
    isAuthenticated ? ["saved-channels"] : null,
    () => api.getChannels(),
    { revalidateOnFocus: false, ...config }
  );
}

/** List cron jobs. */
export function useCronJobs(config?: SWRConfiguration) {
  return useSWR<CronJob[]>(
    openclawKey(["openclaw", "cron"]),
    () => configApi.cronList(),
    config
  );
}

/** List agent files. */
export function useAgentFiles(config?: SWRConfiguration) {
  return useSWR<OpenClawAgentFile[]>(
    openclawKey(["openclaw", "agent-files"]),
    async () => {
      try {
        return await configApi.agentFilesList();
      } catch {
        // Endpoint may not exist on this gateway – return empty list silently
        return [] as OpenClawAgentFile[];
      }
    },
    {
      revalidateOnFocus: false,
      ...config,
    }
  );
}
