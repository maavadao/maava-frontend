import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { debugLog } from "@/lib/logger";
import { resolveTenantBackend } from "@/lib/tenant-lookup";

export const maxDuration = 600; // 10 min — agent tool-use conversations can run long

const GATEWAY_URL =
  process.env.GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
  "";

const OPENCLAW_GATEWAY_TOKEN =
  process.env.OPENCLAW_GATEWAY_TOKEN ||
  process.env.NEXT_PUBLIC_GATEWAY_TOKEN ||
  "dev-token-local";

const CLOUD_MODE = process.env.NEXT_PUBLIC_CLOUD_MODE === "true";

// Direct provider fallback — used when no local gateway is running.
// Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local to use direct mode.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ── AI SDK v6 UIMessage types ─────────────────────────────────────────────
type UIMessagePart =
  | { type: "text"; text: string }
  | { type: "file"; url: string; mediaType: string; filename?: string }
  | { type: "step-start" }
  | { type: "reasoning"; reasoning: string }
  | { type: string; [key: string]: unknown };

interface UIMessage {
  id?: string;
  role: string;
  parts?: UIMessagePart[];
  content?: string; // legacy support
  [key: string]: unknown;
}

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type OpenAIMessage =
  | { role: string; content: string }
  | { role: string; content: OpenAIContentPart[] };

function extractLastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role === 'user') {
      return extractText(msg).trim();
    }
  }
  return '';
}

function extractWeatherLocation(query: string): string | null {
  const q = query.trim();
  if (!q) return null;

  // Common patterns: "weather in baku", "what is the weather in london now"
  const inMatch = q.match(/\bweather\s+(?:in|at|for)\s+([^?.!,\n]+)/i);
  if (inMatch?.[1]) return inMatch[1].trim();

  // Pattern: "baku weather"
  const suffixMatch = q.match(/^([^?.!,\n]+)\s+weather\b/i);
  if (suffixMatch?.[1]) return suffixMatch[1].trim();

  // If user asks generic weather, default to null and let model ask follow-up.
  return null;
}

async function buildWeatherSkillSystemContext(userText: string): Promise<string | null> {
  const location = extractWeatherLocation(userText);
  if (!location) {
    return null;
  }

  const encoded = encodeURIComponent(location.replace(/\s+/g, '+'));
  const url = `https://wttr.in/${encoded}?format=%l:+%c+%t+%h+%w`;

  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const weatherLine = (await res.text()).trim();
    if (!weatherLine) return null;

    return [
      'Weather skill is enabled and live weather was fetched via wttr.in.',
      `Live weather now: ${weatherLine}`,
      'Use this live weather data directly in the answer and avoid saying you cannot access real-time weather.',
    ].join('\n');
  } catch {
    return null;
  }
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSearchResultUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  if (!url) return url;

  // DuckDuckGo result redirects carry the real URL in `uddg`.
  if (url.startsWith('//duckduckgo.com/l/?') || url.startsWith('https://duckduckgo.com/l/?')) {
    try {
      const absolute = url.startsWith('//') ? `https:${url}` : url;
      const parsed = new URL(absolute);
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) {
        return decodeURIComponent(uddg);
      }
    } catch {
      // keep original
    }
  }

  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
}

type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

type BrowserUseLookup = {
  results: SearchResult[];
  error?: string;
};

function parseDuckDuckGoResults(html: string, limit = 5): SearchResult[] {
  const results: SearchResult[] = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && results.length < limit) {
    const url = stripHtmlTags(m[1] ?? '');
    const title = stripHtmlTags(m[2] ?? '');
    const snippet = stripHtmlTags(m[3] ?? m[4] ?? '');
    if (!url || !title) continue;
    results.push({ title, url: normalizeSearchResultUrl(url), snippet: snippet || undefined });
  }
  return results;
}

async function fetchBrowserUseFindings(query: string, limit = 5): Promise<BrowserUseLookup> {
  const q = query.trim();
  if (!q) return { results: [], error: 'empty query' };

  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
    });
    if (!res.ok) return { results: [], error: `search failed (${res.status})` };

    const html = await res.text();
    return { results: parseDuckDuckGoResults(html, limit) };
  } catch {
    return { results: [], error: 'search unavailable' };
  }
}

function isLikelyBrowserTaskQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (!q.trim()) return false;
  return (
    q.includes('go to ') ||
    q.includes('search ') ||
    q.includes('find ') ||
    q.includes('most viewed') ||
    q.includes('top ') ||
    q.includes('.com') ||
    q.includes('youtube') ||
    q.includes('booking')
  );
}

function formatBrowserUseDirectAnswer(query: string, findings: BrowserUseLookup): string {
  if (findings.results.length === 0) {
    return [
      `## Browser-Use Results`,
      `I could not retrieve live browser-search results for: "${query}".`,
      '',
      'Browser-use is enabled, but live browsing is unavailable right now.',
      'Please try again in a moment or provide a direct URL to inspect.',
    ].join('\n\n');
  }

  const lines = findings.results
    .slice(0, 5)
    .map(
      (r, i) => {
        const title = r.title.replace(/\|/g, '\\|');
        const snippet = (r.snippet ?? '').replace(/\|/g, '\\|');
        return `| ${i + 1} | [${title}](${r.url}) | ${snippet} |`;
      },
    );

  return [
    `## Browser-Use Results`,
    `Query: **${query}**`,
    '',
    '| # | Result | Snippet |',
    '|---|---|---|',
    ...lines,
    '',
    'Note: Only fetched live results are listed (no fabricated prices/ratings/views).',
  ].join('\n\n');
}

async function buildBrowserUseSkillSystemContext(userText: string): Promise<string | null> {
  const query = userText.trim();
  if (!query) return null;

  try {
    const findings = await fetchBrowserUseFindings(query, 5);
    if (findings.results.length === 0) {
      return [
        'Browser-use skill is enabled, but no live web results were fetched for this query.',
        'Do NOT fabricate specific listings or prices. Ask the user to refine the query or provide direct target site details.',
      ].join('\n');
    }

    const lines = findings.results.map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}${r.snippet ? `\n   Snippet: ${r.snippet}` : ''}`);
    return [
      'Browser-use skill is enabled. Use the following LIVE web findings as evidence:',
      ...lines,
      'Rules: (1) Do not invent prices/ratings/listings not present in findings. (2) If exact data requested is missing, say so explicitly and propose next browsing step.',
    ].join('\n');
  } catch {
    return [
      'Browser-use skill is enabled, but live browsing is currently unavailable.',
      'Do NOT fabricate specific factual results. Clearly state the limitation and ask for retry/permission.',
    ].join('\n');
  }
}

/**
 * Extract plain text from a UIMessage (for DB storage / preview).
 */
function extractText(msg: UIMessage): string {
  if (msg.parts) {
    return msg.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");
  }
  return typeof msg.content === "string" ? msg.content : "";
}

/**
 * Fire-and-forget: ask the gateway to generate a short title for a conversation.
 */
async function generateTitle(conversationId: string, authHeader: string): Promise<void> {
  const { rows: messages } = await pool.query(
    `SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 4`,
    [conversationId]
  );
  if (messages.length === 0) return;

  const context = messages
    .map((m: { role: string; content: string }) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n");

  const base = GATEWAY_URL.replace(/\/+$/, "");
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      model: "openclaw",
      messages: [
        {
          role: "system",
          content:
            "Generate a very short title (3-6 words, no quotes, no punctuation at the end) that summarizes this conversation. Respond with ONLY the title, nothing else.",
        },
        { role: "user", content: context },
      ],
      stream: false,
    }),
  });

  if (!res.ok) return;

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  let title = data?.choices?.[0]?.message?.content?.trim() || "";
  title = title.replace(/^["']|["']$/g, "").trim();
  if (title.length > 60) title = title.slice(0, 60);
  if (!title) return;

  await pool.query(
    `UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2`,
    [title, conversationId]
  );
}

// ── Streaming-state helpers (stream-recovery on page refresh) ──────────────

let _streamColsMigrated = false;
async function ensureStreamingColumns(): Promise<void> {
  if (_streamColsMigrated) return;
  try {
    await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_streaming BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS streaming_started_at TIMESTAMPTZ DEFAULT NULL`);
    _streamColsMigrated = true;
  } catch { /* column already exists or table doesn't exist yet */ }
}

async function startStreamingMessage(conversationId: string): Promise<string | null> {
  try {
    await ensureStreamingColumns();
    const { rows } = await pool.query(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'assistant', '') RETURNING id`,
      [conversationId]
    );
    const msgId = rows[0]?.id as string;
    await pool.query(
      `UPDATE conversations SET is_streaming = TRUE, streaming_started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );
    return msgId;
  } catch (e) {
    console.error('[streaming] Failed to start streaming message:', e);
    return null;
  }
}

async function updateStreamingContent(messageId: string, content: string): Promise<void> {
  try {
    await pool.query(`UPDATE messages SET content = $1 WHERE id = $2`, [content, messageId]);
  } catch { /* best-effort */ }
}

async function finishStreamingMessage(conversationId: string, messageId: string | null, finalContent: string): Promise<void> {
  try {
    if (messageId && finalContent) {
      await pool.query(`UPDATE messages SET content = $1 WHERE id = $2`, [finalContent, messageId]);
    } else if (messageId && !finalContent) {
      await pool.query(`DELETE FROM messages WHERE id = $1`, [messageId]);
    }
    await pool.query(
      `UPDATE conversations SET is_streaming = FALSE, streaming_started_at = NULL, updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );
  } catch (e) {
    console.error('[streaming] Failed to finish streaming message:', e);
  }
}

/**
 * Convert a UIMessage (AI SDK v6) to OpenAI-compatible message.
 * Images become image_url parts; other files become text mentions.
 */
function uiMessageToOpenAI(msg: UIMessage): OpenAIMessage {
  if (!msg.parts || msg.parts.length === 0) {
    return { role: msg.role, content: typeof msg.content === "string" ? msg.content : "" };
  }

  const fileParts = msg.parts.filter(
    (p): p is { type: "file"; url: string; mediaType: string; filename?: string } =>
      p.type === "file"
  );

  if (fileParts.length === 0) {
    const text = msg.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");
    return { role: msg.role, content: text };
  }

  // Mixed: text + files
  const content: OpenAIContentPart[] = [];
  for (const part of msg.parts) {
    if (part.type === "text") {
      content.push({ type: "text", text: (part as { type: "text"; text: string }).text });
    } else if (part.type === "file") {
      const fp = part as { type: "file"; url: string; mediaType: string; filename?: string };
      if (fp.mediaType?.startsWith("image/")) {
        content.push({ type: "image_url", image_url: { url: fp.url } });
      } else {
        content.push({
          type: "text",
          text: `[Attached: ${fp.filename || "file"} (${fp.mediaType})]`,
        });
      }
    }
  }
  return { role: msg.role, content };
}

/**
 * Convert OpenAI-format messages to Anthropic messages API body.
 * System messages are extracted to the top-level `system` param.
 */
function buildAnthropicBody(messages: OpenAIMessage[], model: string): Record<string, unknown> {
  const systemParts: string[] = [];
  const conversation: Array<{ role: string; content: string }> = [];

  for (const m of messages) {
    if (m.role === 'system') {
      const text = typeof m.content === 'string'
        ? m.content
        : (m.content as Array<{ type: string; text?: string }>)
            .filter(p => p.type === 'text').map(p => p.text ?? '').join('');
      if (text) systemParts.push(text);
    } else {
      const text = typeof m.content === 'string'
        ? m.content
        : (m.content as Array<{ type: string; text?: string }>)
            .filter(p => p.type === 'text').map(p => p.text ?? '').join('');
      conversation.push({ role: m.role, content: text });
    }
  }

  return {
    model,
    ...(systemParts.length > 0 ? { system: systemParts.join('\n\n') } : {}),
    messages: conversation,
    max_tokens: 16384,
    stream: true,
  };
}

/**
 * Proxy chat completions to mawaDao Agent gateway (or directly to an AI provider).
 * Accepts AI SDK v6 useChat format { messages: UIMessage[], model, conversationId, skills }.
 * Converts UIMessages to OpenAI-compatible format, persists to DB, streams response.
 *
 * Provider routing (in priority order):
 *   1. GATEWAY_URL → mawaDao Agent gateway  (full agent pipeline)
 *   2. OPENAI_API_KEY  → direct OpenAI  (OpenAI-compatible SSE)
 *   3. ANTHROPIC_API_KEY → direct Anthropic  (Anthropic SSE format)
 */
export async function POST(request: NextRequest) {
  debugLog(`[chat] POST /api/chat — cloud_mode=${CLOUD_MODE} gateway=${GATEWAY_URL} has_openai=${!!OPENAI_API_KEY} has_anthropic=${!!ANTHROPIC_API_KEY}`);
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Cloud mode: proxy to user's dedicated backend ─────────────────
  if (CLOUD_MODE) {
    const user = await authenticateRequest(request);
    if (!user || !user.subdomain) {
      return NextResponse.json({ error: "Unauthorized or no tenant" }, { status: 401 });
    }

    const tenant = await resolveTenantBackend(user.subdomain);
    if (!tenant?.backendUrl) {
      return NextResponse.json(
        { error: "Backend not available" },
        { status: 503 }
      );
    }

    // Forward the entire request body to the tenant's backend
    const body = await request.arrayBuffer();
    const targetUrl = `${tenant.backendUrl.replace(/\/+$/, "")}/v1/chat/completions`;

    // Extract conversationId from the body so we can pin the backend session
    let cloudConversationId: string | undefined;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body)) as { conversationId?: string };
      cloudConversationId = parsed.conversationId;
    } catch { /* ignore parse errors */ }

    try {
      const backendRes = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          "X-Tenant-ID": tenant.tenantId,
          ...(cloudConversationId ? { "X-OpenClaw-Session-Key": cloudConversationId } : {}),
        },
        body,
      });

      const contentType = backendRes.headers.get("content-type") || "";
      if (backendRes.body && contentType.includes("text/event-stream")) {
        return new NextResponse(backendRes.body, {
          status: backendRes.status,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      const responseBody = await backendRes.arrayBuffer();
      return new NextResponse(responseBody, {
        status: backendRes.status,
        headers: { "Content-Type": contentType || "application/json" },
      });
    } catch (err) {
      console.error("Cloud chat proxy error:", err);
      return NextResponse.json(
        { error: "Backend unreachable" },
        { status: 502 }
      );
    }
  }
  // ── End cloud mode ────────────────────────────────────────────────

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const conversationId = body.conversationId as string | undefined;
  const rawMessages = (body.messages ?? []) as UIMessage[];
  const model = (body.model as string | undefined) ?? "openclaw";
  const skills = body.skills as string[] | undefined;
  const agentId = body.agentId as string | undefined;
  const useCaseGuide = (body.useCaseGuide as string | undefined)?.trim();

  // ── Settings overrides from the client (Settings UI → no server restart needed) ─
  const overrideGatewayUrl   = (body.overrideGatewayUrl   as string | undefined)?.trim();
  const overrideGatewayToken = (body.overrideGatewayToken as string | undefined)?.trim();
  const overrideOpenaiKey     = (body.overrideOpenaiKey     as string | undefined)?.trim();
  const overrideAnthropicKey  = (body.overrideAnthropicKey  as string | undefined)?.trim();
  // Effective config — client override takes priority over server .env vars
  const EFF_GATEWAY_URL   = overrideGatewayUrl   || GATEWAY_URL;
  const EFF_GATEWAY_TOKEN = overrideGatewayToken || OPENCLAW_GATEWAY_TOKEN;
  const EFF_OPENAI        = overrideOpenaiKey     || OPENAI_API_KEY;
  const EFF_ANTHROPIC     = overrideAnthropicKey  || ANTHROPIC_API_KEY;

  // Normalize: support both {parts} (AI SDK v6) and {content} (legacy)
  const uiMessages: UIMessage[] = rawMessages.map((m) => ({
    ...m,
    parts: m.parts ?? (m.content ? [{ type: "text", text: m.content as string }] : []),
  }));

  // Save the latest user message to DB
  if (conversationId && uiMessages.length > 0) {
    const lastMsg = uiMessages[uiMessages.length - 1];
    if (lastMsg.role === "user") {
      const textContent = extractText(lastMsg);
      const previewTitle = textContent.slice(0, 60) + (textContent.length > 60 ? "…" : "");
      void (async () => {
        try {
          await pool.query(
            `INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)`,
            [conversationId, "user", textContent]
          );
          await pool.query(
            `UPDATE conversations
               SET title = CASE
                 WHEN title IS NULL OR title = '' OR title = 'New Chat' THEN $1
                 ELSE title
               END,
                   updated_at = NOW()
             WHERE id = $2`,
            [previewTitle || 'New Chat', conversationId]
          );
        } catch (err) {
          console.error("Failed to save user message:", err);
        }
      })();
    }
  }

  // Convert UIMessages → OpenAI format
  let openAIMessages: OpenAIMessage[] = uiMessages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system")
    .map(uiMessageToOpenAI);

  const hasBrowserUseSkill = Array.isArray(skills)
    ? skills.some((s) => {
        const key = String(s).toLowerCase().replace(/[_\s]/g, '-');
        return key === 'browser-use' || key === 'browseruse' || key === 'browser-use-skill';
      })
    : false;

  const lastUserTextForSkills = extractLastUserText(uiMessages);

  // Hard fail-safe for browser-use tasks: avoid gateway browser-tool failures by returning grounded live findings directly.
  if (hasBrowserUseSkill && isLikelyBrowserTaskQuery(lastUserTextForSkills)) {
    const findings = await fetchBrowserUseFindings(lastUserTextForSkills, 5);
    const directAnswer = formatBrowserUseDirectAnswer(lastUserTextForSkills, findings);
    return new NextResponse(directAnswer, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // ── API key request format instruction ─────────────────────────────────
  const apiKeyInstruction = [
    '[API Key Request Format]',
    'When you need API keys or credentials from the user to complete a task (e.g. configuring a provider, connecting a third-party service), request them using this EXACT block format:',
    '',
    '[API_KEYS_NEEDED]',
    'KEY_NAME: Description of what this key is for',
    '[/API_KEYS_NEEDED]',
    '',
    'Example:',
    '[API_KEYS_NEEDED]',
    'OPENAI_API_KEY: Your OpenAI API key for GPT model access',
    'STRIPE_SECRET_KEY: Your Stripe secret key for payment processing',
    '[/API_KEYS_NEEDED]',
    '',
    'Rules: Always use this block format so the UI renders secure input fields. Never ask for API keys inline in plain text.',
    'Each line inside the block must follow the format KEY_NAME: description.',
    '',
    '[Agent Creation Format]',
    'When the user asks you to create, build, or generate an AI agent, you MUST output the agent specification using this EXACT block format so the UI can create it automatically:',
    '',
    '[CREATE_AGENT]',
    'name: Short agent name (2-5 words)',
    'category: one of customer-support, sales, writing, coding, data, hr, finance, operations, legal, creative',
    'description: Detailed description of what this agent does (2-3 sentences)',
    'system_prompt: Full system prompt defining the agent personality, purpose, communication style, and instructions (200-500 words)',
    'skills: comma-separated list of skill names this agent should have',
    'tags: comma-separated list of tags',
    '[/CREATE_AGENT]',
    '',
    'Rules for agent creation:',
    '- Always use this block format when the user wants to create/generate/build an agent.',
    '- The system_prompt should be detailed and actionable — it defines the agent\'s entire behavior.',
    '- Include relevant skills based on what the agent needs to do.',
    '- Choose the most appropriate category.',
    '- The UI will detect this block and show a "Create Agent" button to the user.',
    '- You may include explanatory text before or after the block.',
    '- If the user\'s request is vague, ask clarifying questions FIRST before outputting the block.',
    '- Once you have enough information, output the block — do not just describe what the agent would do.',
  ].join('\n');
  openAIMessages = [{ role: 'system', content: apiKeyInstruction }, ...openAIMessages];

  // ── Inject use-case guide when a suggestion chip was selected ──────────
  if (useCaseGuide) {
    const guideInstruction = [
      '[Use-Case Setup Guide — follow this to help the user build their agent]',
      '',
      useCaseGuide,
      '',
      'IMPORTANT: Walk the user through this step-by-step. Start by asking for the data listed above that you need. Recommend specific skills to install from the ClawHub marketplace. Reference the documentation/APIs listed. Be practical and actionable — help them get a working agent deployed, not just a plan.',
    ].join('\n');
    openAIMessages = [{ role: 'system', content: guideInstruction }, ...openAIMessages];
  }

  // Inject skills as system prompt
  if (skills && skills.length > 0) {
    const instruction = `[Active Skills: ${skills.join(", ")}] Use these skills when relevant.`;
    openAIMessages = [{ role: "system", content: instruction }, ...openAIMessages];

    if (hasBrowserUseSkill) {
      const browserContext = await buildBrowserUseSkillSystemContext(lastUserTextForSkills);
      if (browserContext) {
        openAIMessages = [{ role: 'system', content: browserContext }, ...openAIMessages];
      }
    }

    // Weather skill runtime hook: fetch live weather and provide it as context.
    if (skills.includes('weather')) {
      const weatherContext = await buildWeatherSkillSystemContext(lastUserTextForSkills);
      if (weatherContext) {
        openAIMessages = [{ role: 'system', content: weatherContext }, ...openAIMessages];
      }
    }
  }

  // Inject agent SOUL/SKILL system prompt when an agent is selected
  if (agentId) {
    try {
      const { rows } = await pool.query(
        `SELECT system_prompt, soul_config, skills_config, name FROM marketplace_agents WHERE id = $1`,
        [agentId]
      );
      if (rows.length > 0) {
        const agent = rows[0];
        const parts: string[] = [];

        if (agent.system_prompt) {
          parts.push(agent.system_prompt);
        }

        if (agent.soul_config) {
          const soul = typeof agent.soul_config === 'string' ? JSON.parse(agent.soul_config) : agent.soul_config;
          if (soul.identity) parts.push(`Identity: ${soul.identity}`);
          if (soul.purpose) parts.push(`Purpose: ${soul.purpose}`);
          if (soul.communication_style) parts.push(`Communication style: ${soul.communication_style}`);
          if (Array.isArray(soul.principles) && soul.principles.length > 0) {
            parts.push(`Core principles: ${soul.principles.join('; ')}`);
          }
        }

        if (agent.skills_config) {
          const sk = typeof agent.skills_config === 'string' ? JSON.parse(agent.skills_config) : agent.skills_config;
          if (Array.isArray(sk) && sk.length > 0) {
            const skillNames = sk.map((s: { name?: string }) => s.name).filter(Boolean).join(', ');
            if (skillNames) parts.push(`Available skills: ${skillNames}`);
          }
        }

        if (parts.length > 0) {
          const agentSystemPrompt = `You are ${agent.name}. ${parts.join('\n')}`;
          openAIMessages = [{ role: 'system', content: agentSystemPrompt }, ...openAIMessages];
        }
      }
    } catch (err) {
      console.error('Failed to load agent config:', err);
    }
  }

  // ── Route to the appropriate AI provider ────────────────────────────────
  let aiEndpoint: string;
  let aiHeaders: Record<string, string>;
  let aiModel = model;
  let useAnthropicMode = false;

  // ── Select provider ────────────────────────────────────────────────────────
  // Priority:
  //   1. mawaDao Agent gateway — primary when configured.
  //      Routes through the gateway's agent pipeline (skills, context management, etc.)
  //      The model param selects a gateway agent ("openclaw:agentId"); unknown IDs default to agent "main".
  //   2. Direct OpenAI — when the model is an OpenAI model and OPENAI_API_KEY is set.
  //   3. Direct Anthropic — when the model is an Anthropic model and ANTHROPIC_API_KEY is set.

  const isLocalGateway = !!EFF_GATEWAY_URL;
  let useGateway = false;

  const isOpenAIModel = aiModel.startsWith('openai/')
    || aiModel.match(/^(gpt-[0-9]|o[0-9]|babbage|davinci|text-)/i) !== null;
  const isAnthropicModel = aiModel.startsWith('anthropic/') || aiModel.startsWith('claude-');

  if (isLocalGateway) {
    // mawaDao Agent gateway — primary AI backend (runs the full agent pipeline)
    const base = EFF_GATEWAY_URL.replace(/\/+$/, '');
    aiEndpoint = `${base}/v1/chat/completions`;
    aiHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EFF_GATEWAY_TOKEN}`,
      ...(conversationId ? { 'X-OpenClaw-Session-Key': conversationId } : {}),
    };
    useGateway = true;
    debugLog(`[chat] mawaDao Agent gateway → model=${aiModel}`);

  } else if (isOpenAIModel && EFF_OPENAI) {
    aiEndpoint = 'https://api.openai.com/v1/chat/completions';
    aiHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${EFF_OPENAI}` };
    aiModel = aiModel.startsWith('openai/') ? aiModel.slice(7) : aiModel;
    if (!aiModel.match(/^(gpt-[0-9]|o[0-9]|babbage|davinci|text-)/i)) aiModel = 'gpt-4o';
    debugLog(`[chat] OpenAI direct request → model=${aiModel}`);

  } else if (isAnthropicModel && EFF_ANTHROPIC) {
    aiEndpoint = 'https://api.anthropic.com/v1/messages';
    aiHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': EFF_ANTHROPIC,
      'anthropic-version': '2023-06-01',
    };
    useAnthropicMode = true;
    aiModel = aiModel.startsWith('anthropic/') ? aiModel.slice(10) : aiModel;
    if (!aiModel.startsWith('claude-')) aiModel = 'claude-3-5-sonnet-20241022';
    debugLog(`[chat] Anthropic direct request → model=${aiModel}`);

  } else if (EFF_OPENAI) {
    aiEndpoint = 'https://api.openai.com/v1/chat/completions';
    aiHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${EFF_OPENAI}` };
    if (!aiModel.match(/^(gpt-[0-9]|o[0-9]|babbage|davinci|text-)/i)) aiModel = 'gpt-4o';
    debugLog(`[chat] OpenAI fallback direct request → model=${aiModel}`);

  } else if (EFF_ANTHROPIC) {
    aiEndpoint = 'https://api.anthropic.com/v1/messages';
    aiHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': EFF_ANTHROPIC,
      'anthropic-version': '2023-06-01',
    };
    useAnthropicMode = true;
    if (!aiModel.startsWith('claude-')) aiModel = 'claude-3-5-sonnet-20241022';
    debugLog(`[chat] Anthropic fallback direct request → model=${aiModel}`);

  } else {
    // No keys at all — use gateway as last resort
    const base = EFF_GATEWAY_URL.replace(/\/+$/, '');
    aiEndpoint = `${base}/v1/chat/completions`;
    aiHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EFF_GATEWAY_TOKEN}`,
      ...(conversationId ? { 'X-OpenClaw-Session-Key': conversationId } : {}),
    };
  }

  const requestBody = useAnthropicMode
    ? buildAnthropicBody(openAIMessages, aiModel)
    : { model: aiModel, messages: openAIMessages, stream: true, max_tokens: 16384 };

  const capturedConversationId = conversationId;

  async function callAI(endpoint: string, headers: Record<string, string>, body: Record<string, unknown>) {
    return fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  }

  try {
    let res: Response;

    // Try primary endpoint; if the local gateway is unreachable (not running),
    // transparently fall back to OpenAI so the chat still works.
    try {
      res = await callAI(aiEndpoint, aiHeaders, requestBody);
      debugLog(`[chat] AI response ← status=${res.status} model=${aiModel}`);
    } catch (primaryErr) {
      if (useGateway && EFF_OPENAI) {
        // Gateway connection failed (e.g. not started) — fall back to OpenAI direct
        debugLog(`[chat] Gateway unreachable (${(primaryErr as Error).message}), falling back to OpenAI`);
        const fallbackModel = aiModel.match(/^(gpt-[0-9]|o[0-9]|babbage|davinci|text-)/i) ? aiModel : 'gpt-4o';
        res = await callAI(
          'https://api.openai.com/v1/chat/completions',
          { 'Content-Type': 'application/json', Authorization: `Bearer ${EFF_OPENAI}` },
          { model: fallbackModel, messages: openAIMessages, stream: true, max_tokens: 16384 },
        );
        debugLog(`[chat] OpenAI fallback ← status=${res.status}`);
      } else {
        throw primaryErr;
      }
    }

    if (!res.ok) {
      const errBody = await res.text();
      let message: string;
      try {
        const parsed = JSON.parse(errBody) as {
          error?: string | { message?: string };
        };
        const err = parsed?.error;
        message =
          typeof err === "string"
            ? err
            : err && typeof err === "object" && typeof err.message === "string"
            ? err.message
            : res.status === 401
            ? "Authentication failed. Please log in again."
            : res.status === 404
            ? `Model not available with the current API key. Try selecting Mistral 7B.`
            : res.status === 402
            ? "Insufficient credits. Please add credits to your AI provider account."
            : res.status === 429
            ? (errBody.includes('insufficient_quota') || errBody.includes('exceeded your current quota')
                ? "The AI provider's quota is exhausted. Please switch models or add credits."
                : "Rate limit hit. Please wait a moment and try again.")
            : res.status === 502 || res.status === 503
            ? "AI provider is unavailable. Please try again later."
            : res.status >= 500
            ? "AI provider server error. Please try again later."
            : errBody || `Request failed (${res.status})`;
      } catch {
        message =
          res.status === 401
            ? "Authentication failed. Please log in again."
            : res.status === 404
            ? `Model not available with the current API key. Try selecting Mistral 7B.`
            : res.status === 429
            ? "Rate limit or quota exhausted. Try switching to Mistral 7B."
            : res.status >= 500
            ? "AI provider server error. Please try again later."
            : errBody || `Request failed (${res.status})`;
      }
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "";
    const isStream = contentType.includes("text/event-stream");

    if (isStream) {
      const stream = res.body;
      if (!stream) {
        return NextResponse.json(
          { error: "No response body" },
          { status: 502 }
        );
      }

      // Convert SSE (OpenAI format) to plain text stream for AI SDK TextStreamChatTransport
      // Create placeholder message & mark conversation as streaming
      const streamMsgId = capturedConversationId ? await startStreamingMessage(capturedConversationId) : null;
      const textStream = new ReadableStream({
        async start(controller) {
          let fullResponse = "";
          let clientGone = false;
          let lastDbSave = Date.now();
          const MAX_CONTINUATIONS = 5;
          let currentStream: ReadableStream<Uint8Array> | null = stream;
          let continuationCount = 0;

          try {
            // Outer loop: handles auto-continuation when model hits token limit
            while (currentStream && continuationCount <= MAX_CONTINUATIONS) {
              const reader = currentStream.getReader();
              const decoder = new TextDecoder();
              let buffer = "";
              let lastFinishReason = "";

              // Inner loop: read one SSE stream to completion
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  const tail = decoder.decode();
                  if (tail) buffer += tail;
                  break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || !trimmed.startsWith("data: ")) continue;
                  const data = trimmed.slice(6);
                  if (data === "[DONE]") continue;

                  try {
                    const parsed = JSON.parse(data) as Record<string, unknown>;
                    let content: string | undefined;
                    if (useAnthropicMode) {
                      const delta = parsed.delta as { type?: string; text?: string; stop_reason?: string } | undefined;
                      if (parsed.type === 'content_block_delta' && delta?.type === 'text_delta') {
                        content = delta.text || undefined;
                      }
                      if (parsed.type === 'message_delta' && delta?.stop_reason) {
                        lastFinishReason = delta.stop_reason === 'max_tokens' ? 'length' : delta.stop_reason;
                      }
                    } else {
                      const choices = parsed.choices as Array<{ delta?: { content?: string }; finish_reason?: string | null }> | undefined;
                      content = choices?.[0]?.delta?.content;
                      if (choices?.[0]?.finish_reason) {
                        lastFinishReason = choices[0].finish_reason;
                      }
                    }
                    if (content) {
                      fullResponse += content;
                      if (!clientGone) {
                        try { controller.enqueue(new TextEncoder().encode(content)); } catch { clientGone = true; }
                      }
                    }
                  } catch {
                    // skip malformed chunks
                  }
                }
                // Periodic DB save (every 3 s)
                if (streamMsgId && Date.now() - lastDbSave > 3000 && fullResponse) {
                  lastDbSave = Date.now();
                  updateStreamingContent(streamMsgId, fullResponse).catch(() => {});
                }
              }
              // Process any remaining buffer (last SSE line without trailing newline)
              if (buffer.trim()) {
                const trimmed = buffer.trim();
                if (trimmed.startsWith("data: ")) {
                  const data = trimmed.slice(6);
                  if (data !== "[DONE]") {
                    try {
                      const parsed = JSON.parse(data) as Record<string, unknown>;
                      let content: string | undefined;
                      if (useAnthropicMode) {
                        const delta = parsed.delta as { type?: string; text?: string; stop_reason?: string } | undefined;
                        if (parsed.type === 'content_block_delta' && delta?.type === 'text_delta') {
                          content = delta.text || undefined;
                        }
                        if (parsed.type === 'message_delta' && delta?.stop_reason) {
                          lastFinishReason = delta.stop_reason === 'max_tokens' ? 'length' : delta.stop_reason;
                        }
                      } else {
                        const choices = parsed.choices as Array<{ delta?: { content?: string }; finish_reason?: string | null }> | undefined;
                        content = choices?.[0]?.delta?.content;
                        if (choices?.[0]?.finish_reason) {
                          lastFinishReason = choices[0].finish_reason;
                        }
                      }
                      if (content) {
                        fullResponse += content;
                        if (!clientGone) {
                          try { controller.enqueue(new TextEncoder().encode(content)); } catch { clientGone = true; }
                        }
                      }
                    } catch { /* skip malformed */ }
                  }
                }
              }

              // Auto-continuation: if model stopped due to max tokens, continue generating
              if (lastFinishReason === 'length' && fullResponse && !clientGone) {
                continuationCount++;
                debugLog(`[chat][stream] auto-continue #${continuationCount} — finish_reason=length, accumulated ${fullResponse.length} chars`);
                try {
                  const contMessages = [
                    ...openAIMessages,
                    { role: 'assistant', content: fullResponse },
                    { role: 'user', content: 'Continue exactly where you left off. Do not repeat anything already said.' },
                  ];
                  const contBody = useAnthropicMode
                    ? { ...buildAnthropicBody(contMessages as OpenAIMessage[], aiModel) }
                    : { model: aiModel, messages: contMessages, stream: true, max_tokens: 16384 };
                  const contRes = await callAI(aiEndpoint, aiHeaders, contBody);
                  if (contRes.ok && contRes.body) {
                    currentStream = contRes.body;
                    continue; // loop back to read the new stream
                  }
                } catch (contErr) {
                  debugLog(`[chat][stream] auto-continue #${continuationCount} failed: ${contErr}`);
                }
              }
              // Either finish_reason was "stop", or continuation failed — we're done
              currentStream = null;
            }
          } catch (err) {
            if (!clientGone) { try { controller.error(err); } catch { /* already closed */ } }
          } finally {
            if (!clientGone) { try { controller.close(); } catch { /* stream already errored */ } }
            // Finalize streaming state + generate title
            if (capturedConversationId) {
              await finishStreamingMessage(capturedConversationId, streamMsgId, fullResponse);
              if (fullResponse) {
                try {
                  const { rows } = await pool.query(
                    `SELECT title FROM conversations WHERE id = $1`,
                    [capturedConversationId]
                  );
                  const t = String(rows[0]?.title ?? '').trim().toLowerCase();
                  if (!t || t === 'new chat') {
                    generateTitle(capturedConversationId, authHeader!).catch(() => {});
                  }
                } catch { /* title generation is best-effort */ }
              }
            }
          }
        },
      });

      return new NextResponse(textStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming: extract content and return as plain text
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data?.choices?.[0]?.message?.content ?? "";
    // Save assistant response to DB
    if (conversationId && content) {
      pool.query(
        `INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)`,
        [conversationId, "assistant", content]
      ).catch((e) => console.error("Failed to save assistant message:", e));
    }
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("Chat proxy error:", err);
    const isNetwork =
      err instanceof TypeError && (err as Error).message?.includes("fetch");
    return NextResponse.json(
      {
        error: isNetwork
          ? "Cannot reach the AI backend. Make sure the mawaDao Agent gateway is running or your API keys are set."
          : "AI backend unreachable. Please try again later.",
      },
      { status: 502 }
    );
  }
}
