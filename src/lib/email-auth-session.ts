import { api } from "@/lib/api";
import { configApi } from "@/lib/config-api";
import { MAWADAO_DOMAIN } from "@/lib/constants";
import { useAuthStore } from "@/store";
import { useCloudStore } from "@/store/cloud";
import type { User } from "@/types";

type EmailSessionUser = {
  userId: string;
  email: string;
  username?: string | null;
  displayName?: string | null;
  isVerified?: boolean;
  createdAt?: string | null;
  subdomain: string | null;
  tenantId: string | null;
  pendingSubdomain?: string | null;
};

export type EmailSessionResponse = {
  success: boolean;
  user: EmailSessionUser;
  transferToken: string | null;
  token: string;
};

export type PostEmailAuthDestination = {
  url: string;
  external: boolean;
  pendingSubdomain: string | null;
};

async function requestEmailSession(apiKey: string): Promise<EmailSessionResponse> {
  const sessionRes = await fetch("/api/auth/email-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ apiKey }),
  });

  if (!sessionRes.ok) {
    const errData = await sessionRes.json().catch(() => ({ error: "Failed to establish session" }));
    throw new Error(errData.error || "Failed to establish session");
  }

  return sessionRes.json() as Promise<EmailSessionResponse>;
}

function buildUser(sessionUser: EmailSessionUser, fallbackUser: User | null): User {
  return {
    id: sessionUser.userId,
    email: sessionUser.email,
    username: fallbackUser?.username || sessionUser.username || sessionUser.email.split("@")[0] || "",
    displayName: fallbackUser?.displayName || sessionUser.displayName || "",
    avatarUrl: fallbackUser?.avatarUrl,
    isActive: fallbackUser?.isActive ?? true,
    isVerified: fallbackUser?.isVerified ?? sessionUser.isVerified ?? false,
    createdAt: fallbackUser?.createdAt || sessionUser.createdAt || new Date().toISOString(),
    updatedAt: fallbackUser?.updatedAt,
    lastLogin: fallbackUser?.lastLogin,
  };
}

function buildDestination(
  session: EmailSessionResponse,
  redirectTo?: string | null,
): PostEmailAuthDestination {
  const { subdomain, pendingSubdomain } = session.user;

  if (subdomain) {
    const targetUrl = new URL(`https://${subdomain}.${MAWADAO_DOMAIN}`);
    if (session.transferToken) {
      targetUrl.searchParams.set("auth_token", session.transferToken);
      targetUrl.searchParams.set("state", crypto.randomUUID());
    }

    if (redirectTo) {
      try {
        const redirectUrl = new URL(redirectTo, window.location.origin);
        if (redirectUrl.hostname === `${subdomain}.${MAWADAO_DOMAIN}`) {
          targetUrl.pathname = redirectUrl.pathname;
          redirectUrl.searchParams.forEach((value, key) => {
            if (key !== "auth_token" && key !== "state") {
              targetUrl.searchParams.set(key, value);
            }
          });
        }
      } catch {
        // Ignore invalid redirect URLs.
      }
    }

    return { url: targetUrl.toString(), external: true, pendingSubdomain: pendingSubdomain || null };
  }

  if (pendingSubdomain) {
    return {
      url: `/?step=subdomain&suggested=${encodeURIComponent(pendingSubdomain)}`,
      external: false,
      pendingSubdomain,
    };
  }

  return {
    url: "/?step=subdomain",
    external: false,
    pendingSubdomain: null,
  };
}

export async function finalizeEmailPasswordAuth(options: {
  apiKey: string;
  redirectTo?: string | null;
}) {
  const session = await requestEmailSession(options.apiKey);
  const fallbackUser = useAuthStore.getState().user;
  const user = buildUser(session.user, fallbackUser);

  api.setApiKey(options.apiKey);
  configApi.setTenantId(user.id);

  useAuthStore.setState({
    agent: null,
    user,
    apiKey: options.apiKey,
    token: session.token,
    isLoading: false,
    error: null,
  });

  useCloudStore.getState().setJWT(session.token);

  return {
    session,
    user,
    destination: buildDestination(session, options.redirectTo),
  };
}
