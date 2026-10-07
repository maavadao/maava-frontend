import pg from 'pg';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local if present
try {
  const envContent = readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch { /* no .env.local */ }

// Parse DATABASE_URL into explicit params to avoid SSL string conflicts
function parseDbUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port || '5432'),
      database: u.pathname.replace(/^\//, '') || 'mawadao',
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      ssl: { rejectUnauthorized: false },
      max: 2,
    };
  } catch {
    return null;
  }
}

const connConfig = parseDbUrl(process.env.DATABASE_URL) || {
  host: 'mawadao.db',
  port: 5432,
  database: 'mawadao',
  user: 'postgres',
  password: 'Zh%F+obR$dp-6\\A-',
  ssl: { rejectUnauthorized: false },
  max: 2,
};

const { Pool } = pg;
const pool = new Pool(connConfig);

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Conversations
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)');
    // Migrate: streaming state columns
    await client.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_streaming BOOLEAN DEFAULT FALSE');
    await client.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS streaming_started_at TIMESTAMPTZ DEFAULT NULL');

    // Messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)');

    // Marketplace agents
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        short_description TEXT,
        category TEXT NOT NULL,
        developer TEXT NOT NULL DEFAULT 'mawaDao Labs',
        price NUMERIC(10,2) DEFAULT 0,
        price_label TEXT DEFAULT 'Free',
        rating NUMERIC(3,2) DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        total_installs INTEGER DEFAULT 0,
        version TEXT DEFAULT '1.0.0',
        verified BOOLEAN DEFAULT false,
        icon_url TEXT,
        tags TEXT[] DEFAULT '{}',
        integrations TEXT[] DEFAULT '{}',
        capabilities TEXT[] DEFAULT '{}',
        key_benefits JSONB DEFAULT '[]',
        about TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_agents_category ON marketplace_agents(category)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_agents_slug ON marketplace_agents(slug)');

    // User installed agents — must exist so installs persist across restarts
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_installed_agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        agent_id UUID NOT NULL REFERENCES marketplace_agents(id) ON DELETE CASCADE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        config_overrides JSONB DEFAULT '{}'::jsonb,
        installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_used_at TIMESTAMPTZ,
        UNIQUE (user_id, agent_id)
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_installed_agents_user ON user_installed_agents(user_id) WHERE is_active = true');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_installed_agents_agent ON user_installed_agents(agent_id)');

    await client.query('COMMIT');
    console.log('✓ Tables created successfully');

    // Check if we need to seed
    const { rows } = await client.query('SELECT COUNT(*)::int AS cnt FROM marketplace_agents');
    console.log(`  Marketplace agents count: ${rows[0].cnt}`);

    if (rows[0].cnt === 0) {
      console.log('  Seeding marketplace agents...');
      // Trigger the seed via the setup route at build time — or seed inline here
      const agents = getAgents();
      for (const a of agents) {
        await pool.query(
          `INSERT INTO marketplace_agents (slug, name, description, short_description, category, developer, price, price_label, rating, review_count, total_installs, version, verified, tags, integrations, capabilities, key_benefits, about)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [a.slug, a.name, a.description, a.short_description, a.category, a.developer, a.price, a.price_label, a.rating, a.review_count, a.total_installs, a.version, a.verified, a.tags, a.integrations, a.capabilities, JSON.stringify(a.key_benefits), a.about]
        );
      }
      console.log(`  ✓ Seeded ${agents.length} agents`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

function getAgents() {
  return [
    { slug: 'customer-support-pro', name: 'Customer Support Pro', short_description: 'AI-powered customer support agent with multi-channel capabilities.', description: 'Customer Support Pro is an advanced AI agent designed to handle customer inquiries across multiple channels including email, chat, and social media.', category: 'customer-support', developer: 'mawaDao Labs', price: 29, price_label: '$29/mo', rating: 4.8, review_count: 1247, total_installs: 15820, version: '2.4.1', verified: true, tags: ['customer-support', 'multi-channel', 'nlp', 'ticketing', 'live-chat'], integrations: ['Discord', 'Slack', 'Telegram', 'Zendesk', 'Intercom'], capabilities: ['Ticket Resolution', 'Sentiment Analysis', 'Multi-language Support', 'Automated Escalation', 'Knowledge Base Integration'], key_benefits: [{ title: '24/7 Availability', description: 'Round-the-clock support without additional staffing costs.' }, { title: 'Instant Responses', description: 'Reduce wait times to under 5 seconds.' }, { title: 'Smart Escalation', description: 'Auto-detect complex issues and route to human agents.' }, { title: 'Multi-language', description: 'Support in 50+ languages with real-time translation.' }], about: 'Customer Support Pro leverages advanced AI to transform your customer service operations.' },
    { slug: 'sales-autopilot', name: 'Sales Autopilot', short_description: 'Automated lead qualification and follow-up sales agent.', description: 'Sales Autopilot handles lead generation, qualification, follow-up sequences, and CRM integration.', category: 'sales', developer: 'GrowthAI', price: 49, price_label: '$49/mo', rating: 4.6, review_count: 892, total_installs: 11340, version: '3.1.0', verified: true, tags: ['sales', 'lead-gen', 'crm', 'outreach', 'automation'], integrations: ['Salesforce', 'HubSpot', 'Slack', 'Gmail', 'Calendly'], capabilities: ['Lead Scoring', 'Email Sequences', 'Meeting Scheduling', 'CRM Sync', 'Pipeline Analytics'], key_benefits: [{ title: 'Higher Conversion', description: 'Increase conversion by up to 40%.' }, { title: 'Zero Manual Work', description: 'Fully automated outreach sequences.' }, { title: 'Smart Scheduling', description: 'AI books meetings at optimal times.' }, { title: 'Pipeline Visibility', description: 'Real-time analytics on every deal stage.' }], about: 'Sales Autopilot is the sales rep that never sleeps.' },
    { slug: 'content-writer-ai', name: 'Content Writer AI', short_description: 'Generate blog posts, social media content, and marketing copy.', description: 'Content Writer AI creates SEO-optimized content for blogs, social media, emails, and ads.', category: 'writing', developer: 'Prose Labs', price: 19, price_label: '$19/mo', rating: 4.7, review_count: 2103, total_installs: 28450, version: '4.0.2', verified: true, tags: ['content', 'writing', 'seo', 'blog', 'social-media'], integrations: ['WordPress', 'Medium', 'Buffer', 'Notion', 'Google Docs'], capabilities: ['Blog Writing', 'SEO Optimization', 'Social Media Posts', 'Email Newsletters', 'Content Calendar'], key_benefits: [{ title: 'Brand Voice', description: 'Learns and maintains your unique brand voice.' }, { title: 'SEO Built-in', description: 'Auto-optimizes for search engines.' }, { title: '10x Faster', description: 'Produce a week of content in under an hour.' }, { title: 'Multi-format', description: 'Adapts for blogs, social, email, and ads.' }], about: 'Content Writer AI is your creative partner that never runs out of ideas.' },
    { slug: 'code-reviewer', name: 'Code Reviewer', short_description: 'Automated code review with security and performance analysis.', description: 'Code Reviewer provides thorough code reviews analyzing security, performance, and best practices across 20+ languages.', category: 'coding', developer: 'DevForge', price: 39, price_label: '$39/mo', rating: 4.9, review_count: 3401, total_installs: 42100, version: '5.2.0', verified: true, tags: ['code-review', 'security', 'performance', 'devops', 'ci-cd'], integrations: ['GitHub', 'GitLab', 'Bitbucket', 'VS Code', 'Jira'], capabilities: ['Security Scanning', 'Performance Analysis', 'Style Enforcement', 'Bug Detection', 'Auto-fix Suggestions'], key_benefits: [{ title: 'Catch Bugs Early', description: 'Detect 95% of common bugs before production.' }, { title: 'Security First', description: 'OWASP Top 10 vulnerability scanning.' }, { title: '20+ Languages', description: 'Supports JS, Python, Go, Rust, Java, and more.' }, { title: 'CI/CD Ready', description: 'Integrates into your build pipeline.' }], about: 'Code Reviewer acts as your most experienced team member.' },
    { slug: 'data-analyst-ai', name: 'Data Analyst AI', short_description: 'Transform raw data into insights with natural language queries.', description: 'Data Analyst AI connects to your databases, letting you ask questions in plain English and get charts and insights.', category: 'data', developer: 'InsightFlow', price: 59, price_label: '$59/mo', rating: 4.5, review_count: 678, total_installs: 8920, version: '2.1.0', verified: true, tags: ['analytics', 'data', 'visualization', 'sql', 'reporting'], integrations: ['PostgreSQL', 'BigQuery', 'Snowflake', 'Tableau', 'Slack'], capabilities: ['Natural Language Queries', 'Auto Visualization', 'Report Generation', 'Anomaly Detection', 'Scheduled Reports'], key_benefits: [{ title: 'Ask in English', description: 'No SQL needed — ask in plain language.' }, { title: 'Auto Charts', description: 'Generates the right visualization instantly.' }, { title: 'Scheduled Reports', description: 'Automated daily/weekly reports.' }, { title: 'Anomaly Alerts', description: 'Proactive notifications on unusual data.' }], about: 'Data Analyst AI democratizes data access for your team.' },
    { slug: 'hr-recruiter', name: 'HR Recruiter Bot', short_description: 'Streamline hiring with automated screening and scheduling.', description: 'HR Recruiter Bot automates candidate screening, interview scheduling, and personalized outreach.', category: 'hr', developer: 'TalentAI', price: 45, price_label: '$45/mo', rating: 4.4, review_count: 432, total_installs: 5670, version: '1.8.0', verified: true, tags: ['hr', 'recruiting', 'hiring', 'screening', 'ats'], integrations: ['LinkedIn', 'Greenhouse', 'Lever', 'Slack', 'Google Calendar'], capabilities: ['Resume Screening', 'Interview Scheduling', 'Candidate Outreach', 'Skill Assessment', 'Diversity Analytics'], key_benefits: [{ title: 'Faster Hiring', description: 'Reduce time-to-hire by 60%.' }, { title: 'Better Matches', description: 'AI-powered matching based on skills and culture.' }, { title: 'Bias Reduction', description: 'Structured scoring reduces unconscious bias.' }, { title: 'Candidate Experience', description: 'Instant responses and seamless scheduling.' }], about: 'HR Recruiter Bot helps you find the best talent faster.' },
    { slug: 'finance-assistant', name: 'Finance Assistant', short_description: 'Automated bookkeeping, expense tracking, and financial reporting.', description: 'Finance Assistant handles invoice processing, expense categorization, and financial reporting.', category: 'finance', developer: 'FinOps AI', price: 35, price_label: '$35/mo', rating: 4.6, review_count: 567, total_installs: 7340, version: '2.0.1', verified: true, tags: ['finance', 'bookkeeping', 'invoicing', 'expense', 'reporting'], integrations: ['QuickBooks', 'Xero', 'Stripe', 'Plaid', 'Slack'], capabilities: ['Invoice Processing', 'Expense Categorization', 'Financial Reports', 'Budget Tracking', 'Tax Preparation'], key_benefits: [{ title: 'Zero Errors', description: 'Bank-level accuracy in calculations.' }, { title: 'Real-time View', description: 'Live dashboard of financial health.' }, { title: 'Tax Ready', description: 'Auto-categorizes expenses for tax time.' }, { title: 'Smart Alerts', description: 'Alerts on unusual spending.' }], about: 'Finance Assistant is your AI CFO.' },
    { slug: 'ops-commander', name: 'Ops Commander', short_description: 'Intelligent operations management and workflow automation.', description: 'Ops Commander monitors infrastructure, automates workflows, manages incidents, and optimizes operations.', category: 'operations', developer: 'mawaDao Labs', price: 55, price_label: '$55/mo', rating: 4.7, review_count: 389, total_installs: 4560, version: '3.0.0', verified: true, tags: ['operations', 'monitoring', 'automation', 'incidents', 'workflows'], integrations: ['PagerDuty', 'Datadog', 'AWS', 'Slack', 'Jira'], capabilities: ['Incident Management', 'Workflow Automation', 'Infrastructure Monitoring', 'Capacity Planning', 'Runbook Execution'], key_benefits: [{ title: 'Fewer Incidents', description: 'Proactive monitoring reduces incidents by 70%.' }, { title: 'Faster MTTR', description: 'Automated runbooks resolve issues in seconds.' }, { title: 'Cost Optimization', description: 'Identifies underutilized resources.' }, { title: '24/7 Monitoring', description: 'Intelligent on-call management.' }], about: 'Ops Commander is your tireless operations team member.' },
    { slug: 'legal-advisor', name: 'Legal Advisor AI', short_description: 'Contract review, compliance checking, and legal document drafting.', description: 'Legal Advisor AI reviews contracts, checks compliance, drafts documents, and identifies risks.', category: 'legal', developer: 'LegalTech AI', price: 69, price_label: '$69/mo', rating: 4.3, review_count: 234, total_installs: 3210, version: '1.5.0', verified: true, tags: ['legal', 'contracts', 'compliance', 'risk', 'documents'], integrations: ['DocuSign', 'Notion', 'Google Drive', 'Slack', 'SharePoint'], capabilities: ['Contract Review', 'Compliance Checking', 'Document Drafting', 'Risk Analysis', 'Clause Library'], key_benefits: [{ title: 'Faster Review', description: 'Review contracts 10x faster.' }, { title: 'Risk Detection', description: 'Flags problematic clauses automatically.' }, { title: 'Always Current', description: 'Updated with latest regulations.' }, { title: 'Template Library', description: 'Generate from customizable templates.' }], about: 'Legal Advisor AI provides first-pass legal review and drafting.' },
    { slug: 'creative-designer', name: 'Creative Designer', short_description: 'Generate brand assets, social graphics, and marketing materials.', description: 'Creative Designer generates brand-consistent visual assets using AI.', category: 'creative', developer: 'PixelAI Studio', price: 25, price_label: '$25/mo', rating: 4.5, review_count: 1560, total_installs: 19870, version: '3.2.1', verified: true, tags: ['design', 'creative', 'graphics', 'branding', 'social-media'], integrations: ['Figma', 'Canva', 'Adobe CC', 'Slack', 'Notion'], capabilities: ['Social Graphics', 'Brand Kit', 'Presentation Design', 'Image Generation', 'Template Builder'], key_benefits: [{ title: 'Brand Consistent', description: 'Every asset matches your brand guidelines.' }, { title: 'Instant Design', description: 'Professional designs in seconds.' }, { title: 'Multi-format', description: 'Auto-resize for any platform.' }, { title: 'Template Library', description: 'Hundreds of customizable templates.' }], about: 'Creative Designer is your AI design team.' },
    { slug: 'email-marketer', name: 'Email Marketer AI', short_description: 'AI-powered email campaigns with personalization and A/B testing.', description: 'Email Marketer AI creates and optimizes email campaigns with segmentation and A/B testing.', category: 'sales', developer: 'MailGenius', price: 29, price_label: '$29/mo', rating: 4.6, review_count: 945, total_installs: 13200, version: '2.3.0', verified: true, tags: ['email', 'marketing', 'campaigns', 'personalization', 'automation'], integrations: ['Mailchimp', 'SendGrid', 'HubSpot', 'Shopify', 'Slack'], capabilities: ['Campaign Creation', 'Personalization', 'A/B Testing', 'Send Optimization', 'Analytics Dashboard'], key_benefits: [{ title: 'Higher Open Rates', description: 'AI-optimized subject lines boost opens by 35%.' }, { title: 'Smart Timing', description: 'Optimal send time per subscriber.' }, { title: 'Auto A/B Testing', description: 'Continuously tests and optimizes.' }, { title: 'Hyper-personal', description: 'Each email feels personally crafted.' }], about: 'Email Marketer AI turns your list into a revenue engine.' },
    { slug: 'devops-pipeline', name: 'DevOps Pipeline Agent', short_description: 'Automated CI/CD management, deployment, and infrastructure as code.', description: 'DevOps Pipeline Agent manages CI/CD pipelines, automates deployments, and handles rollbacks.', category: 'coding', developer: 'DevForge', price: 45, price_label: '$45/mo', rating: 4.8, review_count: 789, total_installs: 9870, version: '2.5.0', verified: true, tags: ['devops', 'ci-cd', 'deployment', 'infrastructure', 'kubernetes'], integrations: ['GitHub Actions', 'Jenkins', 'ArgoCD', 'Terraform', 'AWS'], capabilities: ['Pipeline Management', 'Auto Deployment', 'Rollback Automation', 'Infrastructure as Code', 'Cost Monitoring'], key_benefits: [{ title: 'Zero-downtime', description: 'Blue-green and canary deployments.' }, { title: 'Auto Rollback', description: 'Detects failures and rolls back.' }, { title: 'Cost Aware', description: 'Tracks costs per deployment.' }, { title: 'Multi-cloud', description: 'AWS, GCP, Azure, Kubernetes.' }], about: 'DevOps Pipeline Agent removes deployment toil.' },
    { slug: 'social-media-manager', name: 'Social Media Manager', short_description: 'Schedule, publish, and analyze social media content.', description: 'Social Media Manager automates your social presence from content to analytics.', category: 'creative', developer: 'SocialFlow AI', price: 22, price_label: '$22/mo', rating: 4.4, review_count: 1823, total_installs: 24560, version: '3.0.1', verified: true, tags: ['social-media', 'scheduling', 'analytics', 'engagement', 'content'], integrations: ['Twitter/X', 'Instagram', 'LinkedIn', 'TikTok', 'Buffer'], capabilities: ['Content Scheduling', 'Auto Posting', 'Engagement Analytics', 'Trend Detection', 'Hashtag Optimization'], key_benefits: [{ title: 'Auto Schedule', description: 'Posts at optimal times.' }, { title: 'Trend Riding', description: 'Detects trends early.' }, { title: 'Cross-platform', description: 'Manage all platforms from one dashboard.' }, { title: 'Engagement Insights', description: 'Deep analytics on resonant content.' }], about: 'Social Media Manager keeps your brand active everywhere.' },
    { slug: 'project-manager-ai', name: 'Project Manager AI', short_description: 'Intelligent project planning, task assignment, and deadline tracking.', description: 'Project Manager AI creates plans, assigns tasks, tracks deadlines, and sends status updates.', category: 'operations', developer: 'mawaDao Labs', price: 35, price_label: '$35/mo', rating: 4.5, review_count: 567, total_installs: 7890, version: '2.0.0', verified: true, tags: ['project-management', 'tasks', 'planning', 'agile', 'tracking'], integrations: ['Jira', 'Asana', 'Linear', 'Slack', 'Notion'], capabilities: ['Project Planning', 'Task Assignment', 'Deadline Tracking', 'Resource Optimization', 'Status Reports'], key_benefits: [{ title: 'Auto Planning', description: 'Plans from requirements in minutes.' }, { title: 'Smart Assignment', description: 'Assigns based on skills and workload.' }, { title: 'Blocker Detection', description: 'Proactively flags blockers.' }, { title: 'Stakeholder Updates', description: 'Auto status reports.' }], about: 'Project Manager AI keeps projects on track with intelligent planning.' },
    { slug: 'seo-optimizer', name: 'SEO Optimizer', short_description: 'Comprehensive SEO analysis, keyword research, and content optimization.', description: 'SEO Optimizer provides full-site audits, keyword research, and rank tracking.', category: 'writing', developer: 'RankAI', price: 32, price_label: '$32/mo', rating: 4.7, review_count: 1102, total_installs: 16780, version: '2.8.0', verified: true, tags: ['seo', 'keywords', 'ranking', 'optimization', 'backlinks'], integrations: ['Google Search Console', 'Ahrefs', 'WordPress', 'Shopify', 'Slack'], capabilities: ['Site Audit', 'Keyword Research', 'Content Scoring', 'Rank Tracking', 'Backlink Analysis'], key_benefits: [{ title: 'Higher Rankings', description: 'Data-driven recommendations.' }, { title: 'Content Scoring', description: 'Score content before publishing.' }, { title: 'Competitor Intel', description: 'Track competitor SEO strategies.' }, { title: 'Auto Monitoring', description: 'Alerts on ranking drops.' }], about: 'SEO Optimizer is your competitive edge in search.' },
    { slug: 'translation-agent', name: 'Translation Agent', short_description: 'Real-time multi-language translation with context awareness.', description: 'Translation Agent provides context-aware translation across 100+ languages.', category: 'writing', developer: 'LinguaAI', price: 15, price_label: '$15/mo', rating: 4.6, review_count: 890, total_installs: 21340, version: '3.1.0', verified: true, tags: ['translation', 'localization', 'multi-language', 'i18n', 'communication'], integrations: ['Slack', 'Teams', 'Notion', 'Gmail', 'Zendesk'], capabilities: ['Real-time Translation', 'Document Translation', 'Tone Matching', 'Cultural Adaptation', 'Glossary Management'], key_benefits: [{ title: '100+ Languages', description: 'Translate between 100+ language pairs.' }, { title: 'Context Aware', description: 'Understands business context.' }, { title: 'Tone Matching', description: 'Maintains brand voice across languages.' }, { title: 'Team Integration', description: 'Instant translation in Slack and Teams.' }], about: 'Translation Agent breaks language barriers for global teams.' },
    { slug: 'security-sentinel', name: 'Security Sentinel', short_description: 'Continuous security monitoring, threat detection, and incident response.', description: 'Security Sentinel monitors for threats, detects anomalies, and responds to incidents.', category: 'coding', developer: 'CyberShield AI', price: 79, price_label: '$79/mo', rating: 4.8, review_count: 445, total_installs: 5670, version: '2.0.0', verified: true, tags: ['security', 'monitoring', 'threat-detection', 'compliance', 'incident-response'], integrations: ['AWS GuardDuty', 'Splunk', 'PagerDuty', 'Slack', 'Jira'], capabilities: ['Threat Detection', 'Incident Response', 'Vulnerability Scanning', 'Compliance Monitoring', 'Access Audit'], key_benefits: [{ title: 'Real-time Threats', description: 'Detect in milliseconds.' }, { title: 'Auto Response', description: 'Automated playbooks for incidents.' }, { title: 'Compliance Ready', description: 'SOC 2, HIPAA, GDPR monitoring.' }, { title: 'Zero Trust', description: 'Continuous access verification.' }], about: 'Security Sentinel never sleeps. Continuous monitoring and instant response.' },
    { slug: 'meeting-assistant', name: 'Meeting Assistant', short_description: 'AI notetaker, action item tracker, and meeting summarizer.', description: 'Meeting Assistant takes notes, generates summaries, tracks action items, and distributes follow-ups.', category: 'operations', developer: 'mawaDao Labs', price: 12, price_label: '$12/mo', rating: 4.7, review_count: 2340, total_installs: 31200, version: '4.1.0', verified: true, tags: ['meetings', 'notes', 'summaries', 'action-items', 'productivity'], integrations: ['Zoom', 'Google Meet', 'Teams', 'Slack', 'Notion'], capabilities: ['Auto Transcription', 'Meeting Summaries', 'Action Items', 'Follow-up Emails', 'Decision Tracking'], key_benefits: [{ title: 'Perfect Notes', description: 'Never miss details with AI transcription.' }, { title: 'Action Tracking', description: 'Auto-identifies action items.' }, { title: 'Auto Follow-ups', description: 'Sends summaries to attendees.' }, { title: 'Decision Log', description: 'Searchable log of decisions.' }], about: 'Meeting Assistant ensures every meeting is productive.' },
    { slug: 'research-analyst', name: 'Research Analyst AI', short_description: 'Deep research, competitive analysis, and market intelligence.', description: 'Research Analyst AI conducts comprehensive research and produces detailed reports.', category: 'data', developer: 'InsightFlow', price: 42, price_label: '$42/mo', rating: 4.5, review_count: 612, total_installs: 8430, version: '2.2.0', verified: true, tags: ['research', 'analysis', 'competitive-intel', 'market', 'reports'], integrations: ['Notion', 'Google Docs', 'Slack', 'Airtable', 'Tableau'], capabilities: ['Web Research', 'Competitive Analysis', 'Market Monitoring', 'Report Generation', 'Trend Forecasting'], key_benefits: [{ title: 'Deep Research', description: 'Hundreds of sources in minutes.' }, { title: 'Competitor Watch', description: 'Track competitors in real-time.' }, { title: 'Market Intel', description: 'Real-time market trends.' }, { title: 'Auto Reports', description: 'Professional reports on demand.' }], about: 'Research Analyst AI does in minutes what takes days.' },
    { slug: 'chatbot-builder', name: 'Chatbot Builder', short_description: 'No-code chatbot creation for websites and messaging platforms.', description: 'Chatbot Builder lets you create intelligent chatbots — no coding required.', category: 'customer-support', developer: 'ChatFlow AI', price: 19, price_label: '$19/mo', rating: 4.4, review_count: 1567, total_installs: 18900, version: '3.5.0', verified: true, tags: ['chatbot', 'no-code', 'website', 'messaging', 'faq'], integrations: ['WhatsApp', 'Facebook', 'Telegram', 'Shopify', 'WordPress'], capabilities: ['Visual Bot Builder', 'Knowledge Training', 'Multi-channel Deploy', 'Analytics', 'Human Handoff'], key_benefits: [{ title: 'No Code', description: 'Drag-and-drop interface.' }, { title: 'Train with Docs', description: 'Upload docs to train instantly.' }, { title: 'Multi-channel', description: 'Deploy to web, WhatsApp, Facebook.' }, { title: 'Smart Handoff', description: 'Seamless escalation to humans.' }], about: 'Chatbot Builder makes intelligent chatbots easy for anyone.' },
  ];
}

main();
