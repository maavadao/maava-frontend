import { Pool } from 'pg';
import type { NextRequest } from 'next/server';

const rawConnString = process.env.DATABASE_URL ?? '';

// Singleton pool — shared across all API routes
const pool = new Pool({
  connectionString: rawConnString.replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]$/, ''),
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

// Prevent uncaughtException when Supabase pooler silently drops idle connections.
pool.on('error', (err) => {
  console.error('[db] Idle client error (safe to ignore ECONNRESET):', err.message);
});

// Run schema migrations idempotently on pool startup
pool.connect()
  .then(async (client) => {
    try {
      await client.query(`ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL`);
      await client.query(`ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC) WHERE deleted_at IS NULL`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_conv_created_live ON messages(conversation_id, created_at ASC) WHERE deleted_at IS NULL`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at ASC)`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_skills (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          skill_id TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT '',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, skill_id)
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id) WHERE is_active = TRUE`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_user_skills_lookup ON user_skills(user_id, skill_id, source)`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_chat_preferences (
          user_id TEXT PRIMARY KEY,
          selected_model TEXT NOT NULL DEFAULT 'openclaw',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_onboarding_preferences (
          user_id TEXT PRIMARY KEY,
          interests TEXT[] NOT NULL DEFAULT '{}',
          provider TEXT NOT NULL DEFAULT 'moonshot',
          onboarding_completed_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      /* Skills catalog — community skill cards browsed from Skills Hub */
      await client.query(`
        CREATE TABLE IF NOT EXISTS skills (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          skill_id    TEXT NOT NULL,
          name        TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          category    TEXT NOT NULL DEFAULT 'general',
          installs    INTEGER NOT NULL DEFAULT 0,
          source      TEXT NOT NULL DEFAULT '',
          source_url  TEXT NOT NULL DEFAULT '',
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (skill_id, source)
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_installs ON skills(installs DESC)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_category_installs ON skills(category, installs DESC)`);
      /* Marketplace agents catalog */
      await client.query(`
        CREATE TABLE IF NOT EXISTS marketplace_agents (
          id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          slug              TEXT UNIQUE NOT NULL,
          name              TEXT NOT NULL,
          description       TEXT NOT NULL DEFAULT '',
          short_description TEXT NOT NULL DEFAULT '',
          category          TEXT NOT NULL DEFAULT 'general',
          developer         TEXT NOT NULL DEFAULT '',
          price             NUMERIC(10,2) NOT NULL DEFAULT 0,
          price_label       TEXT NOT NULL DEFAULT 'Free',
          rating            NUMERIC(3,2) NOT NULL DEFAULT 0,
          review_count      INTEGER NOT NULL DEFAULT 0,
          total_installs    INTEGER NOT NULL DEFAULT 0,
          version           TEXT NOT NULL DEFAULT '1.0.0',
          verified          BOOLEAN NOT NULL DEFAULT FALSE,
          tags              TEXT[] NOT NULL DEFAULT '{}',
          integrations      TEXT[] NOT NULL DEFAULT '{}',
          capabilities      TEXT[] NOT NULL DEFAULT '{}',
          key_benefits      JSONB NOT NULL DEFAULT '[]',
          about             TEXT NOT NULL DEFAULT '',
          icon_url          TEXT,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_agents_category ON marketplace_agents(category)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_agents_rating ON marketplace_agents(rating DESC)`);

      /* Agent architecture columns (SOUL/SKILL/HEARTBEAT/CHANNEL) on marketplace_agents */
      await client.query(`ALTER TABLE marketplace_agents ADD COLUMN IF NOT EXISTS soul_config JSONB DEFAULT '{}'::jsonb`);
      await client.query(`ALTER TABLE marketplace_agents ADD COLUMN IF NOT EXISTS skills_config JSONB DEFAULT '[]'::jsonb`);
      await client.query(`ALTER TABLE marketplace_agents ADD COLUMN IF NOT EXISTS heartbeat_config JSONB DEFAULT '{}'::jsonb`);
      await client.query(`ALTER TABLE marketplace_agents ADD COLUMN IF NOT EXISTS channels_config JSONB DEFAULT '{}'::jsonb`);
      await client.query(`ALTER TABLE marketplace_agents ADD COLUMN IF NOT EXISTS system_prompt TEXT DEFAULT ''`);
      await client.query(`ALTER TABLE marketplace_agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
      await client.query(`ALTER TABLE marketplace_agents ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'openclaw'`);
      await client.query(`ALTER TABLE marketplace_agents ADD COLUMN IF NOT EXISTS creator_id TEXT`);
      await client.query(`ALTER TABLE marketplace_agents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true`);
      await client.query(`ALTER TABLE marketplace_agents ADD COLUMN IF NOT EXISTS max_runtime_hours INTEGER DEFAULT 0`);

      /* User installed agents */
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_installed_agents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          agent_id UUID NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          config_overrides JSONB DEFAULT '{}'::jsonb,
          installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_used_at TIMESTAMPTZ,
          UNIQUE (user_id, agent_id)
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_user_installed_agents_user ON user_installed_agents(user_id) WHERE is_active = true`);

      /* Agent tasks */
      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          agent_id UUID NOT NULL,
          conversation_id TEXT,
          task_prompt TEXT NOT NULL,
          task_type TEXT NOT NULL DEFAULT 'one-shot',
          status TEXT NOT NULL DEFAULT 'pending',
          result TEXT,
          error TEXT,
          progress INTEGER DEFAULT 0,
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          scheduled_for TIMESTAMPTZ,
          heartbeat_interval TEXT,
          last_heartbeat_at TIMESTAMPTZ,
          next_heartbeat_at TIMESTAMPTZ,
          max_runtime_hours INTEGER DEFAULT 24,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON agent_tasks(user_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status) WHERE status IN ('pending', 'running')`);

      /* Agent memory */
      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_memory (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id UUID NOT NULL,
          user_id TEXT NOT NULL,
          memory_type TEXT NOT NULL DEFAULT 'conversation',
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_user ON agent_memory(agent_id, user_id)`);

      /* Provider API keys — per-user keys for OpenAI, Anthropic, Google, Moonshot */
      await client.query(`
        CREATE TABLE IF NOT EXISTS provider_keys (
          id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id     UUID        NOT NULL,
          provider    VARCHAR(50) NOT NULL,
          api_key     TEXT        NOT NULL,
          label       VARCHAR(255),
          is_active   BOOLEAN     NOT NULL DEFAULT true,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, provider)
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_provider_keys_user_id ON provider_keys(user_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_provider_keys_active ON provider_keys(user_id, is_active) WHERE is_active = true`);
    } catch (e) {
      console.error('[db] Auto-migration error:', e);
    } finally {
      client.release();
    }
  })
  .catch((e) => console.error('[db] Failed to connect for auto-migration:', e));

export default pool;

/**
 * Returns true when the error is a network / connection-level failure
 * rather than a SQL / logic error. Used by read-only endpoints to
 * return empty data instead of 500 when the DB is unreachable.
 */
export function isDbConnectionError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code ?? '');
  const msg  = String((err as { message?: string })?.message ?? '').toLowerCase();
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND'    ||
    code === 'ETIMEDOUT'    ||
    code === 'EHOSTUNREACH' ||
    code === 'ECONNRESET'   ||
    msg.includes('getaddrinfo') ||
    msg.includes('connect etimedout') ||
    msg.includes('connection timeout') ||
    msg.includes('could not connect') ||
    msg.includes('timeout exceeded')
  );
}

/**
 * Extract the authenticated user's ID from a request.
 * Reads from the `x-user-id` header set by the frontend.
 * Returns null when the header is absent or equals "anonymous".
 */
export function getUserId(request: NextRequest): string | null {
  const id = request.headers.get('x-user-id');
  if (!id || id === 'anonymous') return null;
  return id;
}
