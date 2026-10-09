#!/usr/bin/env node
/**
 * Seed script: parse all_skills.xlsx and insert 62k+ skills into Supabase PostgreSQL.
 *
 * Usage:   node scripts/seed-skills.mjs
 * Prereqs: npm install xlsx pg (xlsx already installed as devDep)
 */

import XLSX from 'xlsx';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const XLSX_PATH = join(__dirname, '..', '..', 'maava-api', 'data', 'all_skills.xlsx');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

// Skill categories inferred from skill name / source repo keywords
const CATEGORY_KEYWORDS = {
  'frontend': ['react', 'vue', 'angular', 'css', 'html', 'tailwind', 'nextjs', 'svelte', 'frontend', 'ui', 'ux'],
  'backend': ['backend', 'api', 'server', 'express', 'fastapi', 'django', 'rails', 'node', 'graphql', 'rest'],
  'devops': ['docker', 'kubernetes', 'k8s', 'ci-cd', 'deploy', 'aws', 'gcp', 'azure', 'terraform', 'devops', 'infra'],
  'data': ['data', 'analytics', 'sql', 'database', 'postgres', 'mongo', 'redis', 'etl', 'pipeline'],
  'ai-ml': ['ai', 'ml', 'machine-learning', 'llm', 'gpt', 'claude', 'openai', 'model', 'embedding', 'rag', 'agent'],
  'security': ['security', 'auth', 'oauth', 'encryption', 'vulnerability', 'pentest', 'firewall'],
  'mobile': ['mobile', 'ios', 'android', 'react-native', 'flutter', 'swift', 'kotlin'],
  'testing': ['test', 'jest', 'cypress', 'playwright', 'e2e', 'unit-test', 'qa'],
  'writing': ['writing', 'content', 'blog', 'seo', 'copywriting', 'documentation', 'markdown', 'prose'],
  'productivity': ['productivity', 'automation', 'workflow', 'task', 'calendar', 'notion', 'obsidian'],
  'design': ['design', 'figma', 'sketch', 'ui-design', 'graphic', 'illustration', 'color'],
  'finance': ['finance', 'trading', 'crypto', 'bitcoin', 'payment', 'stripe', 'invoice'],
};

function inferCategory(name, source) {
  const text = `${name} ${source}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return 'general';
}

function inferDescription(name, source) {
  const cleanName = name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return `${cleanName} — from ${source}`;
}

async function main() {
  console.log('Reading xlsx from:', XLSX_PATH);
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  console.log(`Parsed ${rows.length} skills from xlsx`);

  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL');

  // Create table
  await client.query(`
    CREATE TABLE IF NOT EXISTS skills (
      id            TEXT PRIMARY KEY,
      skill_id      TEXT NOT NULL,
      name          TEXT NOT NULL,
      description   TEXT,
      category      TEXT NOT NULL DEFAULT 'general',
      installs      INTEGER NOT NULL DEFAULT 0,
      source        TEXT NOT NULL,
      source_url    TEXT,
      is_installed  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Create indexes for fast search
  await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_name ON skills USING gin (to_tsvector('english', name));`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_category ON skills (category);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_installs ON skills (installs DESC);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_skill_id ON skills (skill_id);`);
  console.log('Table & indexes created');

  // Clear existing data
  await client.query('TRUNCATE skills;');

  // Batch insert (chunks of 500)
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const row of batch) {
      const id = String(row.id || '').trim();
      const skillId = String(row.skillId || '').trim();
      const name = String(row.name || skillId).trim();
      const installs = parseInt(row.installs, 10) || 0;
      const source = String(row.source || '').trim();
      const category = inferCategory(name, source);
      const description = inferDescription(name, source);
      const sourceUrl = source ? `https://github.com/${source}` : null;

      if (!id || !skillId) continue;

      values.push(
        `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7})`
      );
      params.push(id, skillId, name, description, category, installs, source, sourceUrl);
      paramIdx += 8;
    }

    if (values.length > 0) {
      const sql = `INSERT INTO skills (id, skill_id, name, description, category, installs, source, source_url) VALUES ${values.join(', ')} ON CONFLICT (id) DO NOTHING;`;
      await client.query(sql, params);
      inserted += values.length;
      if (inserted % 5000 === 0 || i + BATCH_SIZE >= rows.length) {
        console.log(`  Inserted ${inserted} / ${rows.length}...`);
      }
    }
  }

  // Verify
  const { rows: [{ count }] } = await client.query('SELECT COUNT(*)::int as count FROM skills;');
  console.log(`\nDone! ${count} skills in database.`);

  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
