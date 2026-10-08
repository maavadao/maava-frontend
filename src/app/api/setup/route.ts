import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/setup
 * Creates conversations, messages, and marketplace_agents tables.
 * Seeds marketplace_agents if empty.
 */
export async function POST() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ===== Conversations table =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ DEFAULT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id) WHERE deleted_at IS NULL
    `);

    // Migrate: add deleted_at if the table already existed without it
    await client.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL
    `);

    // Migrate: add streaming state columns for stream-recovery on refresh
    await client.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_streaming BOOLEAN DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS streaming_started_at TIMESTAMPTZ DEFAULT NULL
    `);

    // ===== Messages table =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ DEFAULT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at) WHERE deleted_at IS NULL
    `);

    // Migrate: add deleted_at if the table already existed without it
    await client.query(`
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL
    `);

    // ===== User Skills table (per-user skill installations) =====
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
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id) WHERE is_active = TRUE
    `);

    // ===== Marketplace Agents table =====
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
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agents_category ON marketplace_agents(category)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agents_slug ON marketplace_agents(slug)
    `);

    // ===== Seed agents if table is empty =====
    const { rows } = await client.query('SELECT COUNT(*)::int AS cnt FROM marketplace_agents');
    if (rows[0].cnt === 0) {
      const agents = getSeedAgents();
      for (const a of agents) {
        await client.query(
          `INSERT INTO marketplace_agents (slug, name, description, short_description, category, developer, price, price_label, rating, review_count, total_installs, version, verified, tags, integrations, capabilities, key_benefits, about)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            a.slug, a.name, a.description, a.short_description, a.category,
            a.developer, a.price, a.price_label, a.rating, a.review_count,
            a.total_installs, a.version, a.verified, a.tags, a.integrations,
            a.capabilities, JSON.stringify(a.key_benefits), a.about,
          ]
        );
      }
    }

    // ===== Skills catalog table =====
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

    // ===== Seed skills if table is empty =====
    const { rows: skillsCount } = await client.query('SELECT COUNT(*)::int AS cnt FROM skills');
    if (skillsCount[0].cnt === 0) {
      for (const s of getSeedSkills()) {
        await client.query(
          `INSERT INTO skills (skill_id, name, description, category, installs, source, source_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (skill_id, source) DO NOTHING`,
          [s.skill_id, s.name, s.description, s.category, s.installs, s.source, s.source_url]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Setup complete — tables created, agents and skills seeded.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Setup error:', err);
    return NextResponse.json({ error: 'Setup failed', details: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}

function getSeedAgents() {
  return [
    {
      slug: 'customer-support-pro',
      name: 'Customer Support Pro',
      short_description: 'AI-powered customer support agent with multi-channel capabilities.',
      description: 'Customer Support Pro is an advanced AI agent designed to handle customer inquiries across multiple channels including email, chat, and social media. It uses natural language processing to understand customer intent, provides accurate responses, and seamlessly escalates complex issues to human agents.',
      category: 'customer-support',
      developer: 'mawaDao Labs',
      price: 29,
      price_label: '$29/mo',
      rating: 4.8,
      review_count: 1247,
      total_installs: 15820,
      version: '2.4.1',
      verified: true,
      tags: ['customer-support', 'multi-channel', 'nlp', 'ticketing', 'live-chat'],
      integrations: ['Discord', 'Slack', 'Telegram', 'Zendesk', 'Intercom'],
      capabilities: ['Ticket Resolution', 'Sentiment Analysis', 'Multi-language Support', 'Automated Escalation', 'Knowledge Base Integration'],
      key_benefits: [
        { title: '24/7 Availability', description: 'Provide round-the-clock customer support without additional staffing costs.' },
        { title: 'Instant Responses', description: 'Reduce wait times to under 5 seconds with intelligent auto-responses.' },
        { title: 'Smart Escalation', description: 'Automatically detect complex issues and route them to human agents.' },
        { title: 'Multi-language', description: 'Support customers in 50+ languages with real-time translation.' },
      ],
      about: 'Customer Support Pro leverages advanced AI to transform your customer service operations. Built on years of training data from millions of support interactions, it understands context, sentiment, and intent to provide helpful, accurate responses.',
    },
    {
      slug: 'sales-autopilot',
      name: 'Sales Autopilot',
      short_description: 'Automated lead qualification and follow-up sales agent.',
      description: 'Sales Autopilot handles lead generation, qualification, follow-up sequences, and CRM integration. It scores leads based on engagement, crafts personalized outreach, and books meetings automatically.',
      category: 'sales',
      developer: 'GrowthAI',
      price: 49,
      price_label: '$49/mo',
      rating: 4.6,
      review_count: 892,
      total_installs: 11340,
      version: '3.1.0',
      verified: true,
      tags: ['sales', 'lead-gen', 'crm', 'outreach', 'automation'],
      integrations: ['Salesforce', 'HubSpot', 'Slack', 'Gmail', 'Calendly'],
      capabilities: ['Lead Scoring', 'Email Sequences', 'Meeting Scheduling', 'CRM Sync', 'Pipeline Analytics'],
      key_benefits: [
        { title: 'Higher Conversion', description: 'Increase lead-to-customer conversion by up to 40% with intelligent follow-ups.' },
        { title: 'Zero Manual Work', description: 'Fully automated outreach sequences that feel personal.' },
        { title: 'Smart Scheduling', description: 'AI books meetings at optimal times based on prospect behavior.' },
        { title: 'Pipeline Visibility', description: 'Real-time analytics on every deal stage.' },
      ],
      about: 'Sales Autopilot is the sales rep that never sleeps. It qualifies leads, sends personalized emails, follows up at the right time, and books meetings — all without human intervention.',
    },
    {
      slug: 'content-writer-ai',
      name: 'Content Writer AI',
      short_description: 'Generate blog posts, social media content, and marketing copy.',
      description: 'Content Writer AI creates high-quality, SEO-optimized content for blogs, social media, emails, and ads. It maintains your brand voice and generates content calendars.',
      category: 'writing',
      developer: 'Prose Labs',
      price: 19,
      price_label: '$19/mo',
      rating: 4.7,
      review_count: 2103,
      total_installs: 28450,
      version: '4.0.2',
      verified: true,
      tags: ['content', 'writing', 'seo', 'blog', 'social-media'],
      integrations: ['WordPress', 'Medium', 'Buffer', 'Notion', 'Google Docs'],
      capabilities: ['Blog Writing', 'SEO Optimization', 'Social Media Posts', 'Email Newsletters', 'Content Calendar'],
      key_benefits: [
        { title: 'Brand Voice', description: 'Learns and maintains your unique brand voice across all content.' },
        { title: 'SEO Built-in', description: 'Auto-optimizes for search engines with keyword research and placement.' },
        { title: '10x Faster', description: 'Produce a week\'s worth of content in under an hour.' },
        { title: 'Multi-format', description: 'Adapts content for blogs, social, email, and ads automatically.' },
      ],
      about: 'Content Writer AI is your creative partner that never runs out of ideas. It produces publication-ready content across formats while maintaining SEO best practices.',
    },
    {
      slug: 'code-reviewer',
      name: 'Code Reviewer',
      short_description: 'Automated code review agent with security and performance analysis.',
      description: 'Code Reviewer provides thorough code reviews analyzing security vulnerabilities, performance bottlenecks, code style, and best practices across 20+ programming languages.',
      category: 'coding',
      developer: 'DevForge',
      price: 39,
      price_label: '$39/mo',
      rating: 4.9,
      review_count: 3401,
      total_installs: 42100,
      version: '5.2.0',
      verified: true,
      tags: ['code-review', 'security', 'performance', 'devops', 'ci-cd'],
      integrations: ['GitHub', 'GitLab', 'Bitbucket', 'VS Code', 'Jira'],
      capabilities: ['Security Scanning', 'Performance Analysis', 'Style Enforcement', 'Bug Detection', 'Auto-fix Suggestions'],
      key_benefits: [
        { title: 'Catch Bugs Early', description: 'Detect 95% of common bugs before they hit production.' },
        { title: 'Security First', description: 'OWASP Top 10 vulnerability scanning on every commit.' },
        { title: '20+ Languages', description: 'Supports JavaScript, Python, Go, Rust, Java, and more.' },
        { title: 'CI/CD Ready', description: 'Integrates seamlessly into your existing build pipeline.' },
      ],
      about: 'Code Reviewer acts as your most experienced team member, providing thoughtful, detailed code reviews on every pull request.',
    },
    {
      slug: 'data-analyst-ai',
      name: 'Data Analyst AI',
      short_description: 'Transform raw data into insights with natural language queries.',
      description: 'Data Analyst AI connects to your databases and data warehouses, letting you ask questions in plain English and get charts, reports, and actionable insights.',
      category: 'data',
      developer: 'InsightFlow',
      price: 59,
      price_label: '$59/mo',
      rating: 4.5,
      review_count: 678,
      total_installs: 8920,
      version: '2.1.0',
      verified: true,
      tags: ['analytics', 'data', 'visualization', 'sql', 'reporting'],
      integrations: ['PostgreSQL', 'BigQuery', 'Snowflake', 'Tableau', 'Slack'],
      capabilities: ['Natural Language Queries', 'Auto Visualization', 'Report Generation', 'Anomaly Detection', 'Scheduled Reports'],
      key_benefits: [
        { title: 'Ask in English', description: 'No SQL needed — ask questions in plain language.' },
        { title: 'Auto Charts', description: 'Instantly generates the right visualization for your data.' },
        { title: 'Scheduled Reports', description: 'Automated daily/weekly reports delivered to your inbox.' },
        { title: 'Anomaly Alerts', description: 'Proactive notifications when data looks unusual.' },
      ],
      about: 'Data Analyst AI democratizes data access. Anyone on your team can get insights without writing a single query.',
    },
    {
      slug: 'hr-recruiter',
      name: 'HR Recruiter Bot',
      short_description: 'Streamline hiring with automated screening, scheduling, and outreach.',
      description: 'HR Recruiter Bot automates candidate screening, interview scheduling, and personalized outreach. It integrates with your ATS and job boards.',
      category: 'hr',
      developer: 'TalentAI',
      price: 45,
      price_label: '$45/mo',
      rating: 4.4,
      review_count: 432,
      total_installs: 5670,
      version: '1.8.0',
      verified: true,
      tags: ['hr', 'recruiting', 'hiring', 'screening', 'ats'],
      integrations: ['LinkedIn', 'Greenhouse', 'Lever', 'Slack', 'Google Calendar'],
      capabilities: ['Resume Screening', 'Interview Scheduling', 'Candidate Outreach', 'Skill Assessment', 'Diversity Analytics'],
      key_benefits: [
        { title: 'Faster Hiring', description: 'Reduce time-to-hire by 60% with automated screening.' },
        { title: 'Better Matches', description: 'AI-powered candidate matching based on skills and culture fit.' },
        { title: 'Bias Reduction', description: 'Structured scoring reduces unconscious bias in hiring.' },
        { title: 'Candidate Experience', description: 'Instant responses and seamless scheduling for candidates.' },
      ],
      about: 'HR Recruiter Bot helps you find the best talent faster. It screens resumes, reaches out to candidates, and schedules interviews — all automatically.',
    },
    {
      slug: 'finance-assistant',
      name: 'Finance Assistant',
      short_description: 'Automated bookkeeping, expense tracking, and financial reporting.',
      description: 'Finance Assistant handles invoice processing, expense categorization, financial reporting, and budget tracking with bank-level accuracy.',
      category: 'finance',
      developer: 'FinOps AI',
      price: 35,
      price_label: '$35/mo',
      rating: 4.6,
      review_count: 567,
      total_installs: 7340,
      version: '2.0.1',
      verified: true,
      tags: ['finance', 'bookkeeping', 'invoicing', 'expense', 'reporting'],
      integrations: ['QuickBooks', 'Xero', 'Stripe', 'Plaid', 'Slack'],
      capabilities: ['Invoice Processing', 'Expense Categorization', 'Financial Reports', 'Budget Tracking', 'Tax Preparation'],
      key_benefits: [
        { title: 'Zero Errors', description: 'Bank-level accuracy in all financial calculations.' },
        { title: 'Real-time View', description: 'Live dashboard of your financial health.' },
        { title: 'Tax Ready', description: 'Automatically categorizes expenses for tax time.' },
        { title: 'Smart Alerts', description: 'Notifies you of unusual spending or budget overruns.' },
      ],
      about: 'Finance Assistant is your AI CFO. It handles the tedious work of bookkeeping and reporting so you can focus on growing your business.',
    },
    {
      slug: 'ops-commander',
      name: 'Ops Commander',
      short_description: 'Intelligent operations management and workflow automation.',
      description: 'Ops Commander monitors your infrastructure, automates workflows, manages incidents, and optimizes operational processes across your stack.',
      category: 'operations',
      developer: 'mawaDao Labs',
      price: 55,
      price_label: '$55/mo',
      rating: 4.7,
      review_count: 389,
      total_installs: 4560,
      version: '3.0.0',
      verified: true,
      tags: ['operations', 'monitoring', 'automation', 'incidents', 'workflows'],
      integrations: ['PagerDuty', 'Datadog', 'AWS', 'Slack', 'Jira'],
      capabilities: ['Incident Management', 'Workflow Automation', 'Infrastructure Monitoring', 'Capacity Planning', 'Runbook Execution'],
      key_benefits: [
        { title: 'Fewer Incidents', description: 'Proactive monitoring reduces incidents by 70%.' },
        { title: 'Faster MTTR', description: 'Automated runbooks resolve common issues in seconds.' },
        { title: 'Cost Optimization', description: 'Identifies underutilized resources to cut cloud spend.' },
        { title: '24/7 Monitoring', description: 'Never miss an alert with intelligent on-call management.' },
      ],
      about: 'Ops Commander is your tireless operations team member. It monitors, responds, and resolves issues before they become problems.',
    },
    {
      slug: 'legal-advisor',
      name: 'Legal Advisor AI',
      short_description: 'Contract review, compliance checking, and legal document drafting.',
      description: 'Legal Advisor AI reviews contracts, checks compliance requirements, drafts legal documents, and identifies potential risks in agreements.',
      category: 'legal',
      developer: 'LegalTech AI',
      price: 69,
      price_label: '$69/mo',
      rating: 4.3,
      review_count: 234,
      total_installs: 3210,
      version: '1.5.0',
      verified: true,
      tags: ['legal', 'contracts', 'compliance', 'risk', 'documents'],
      integrations: ['DocuSign', 'Notion', 'Google Drive', 'Slack', 'SharePoint'],
      capabilities: ['Contract Review', 'Compliance Checking', 'Document Drafting', 'Risk Analysis', 'Clause Library'],
      key_benefits: [
        { title: 'Faster Review', description: 'Review contracts 10x faster than manual review.' },
        { title: 'Risk Detection', description: 'Automatically flags problematic clauses and terms.' },
        { title: 'Always Current', description: 'Compliance checks updated with latest regulations.' },
        { title: 'Template Library', description: 'Generate legal documents from customizable templates.' },
      ],
      about: 'Legal Advisor AI provides first-pass legal review and document drafting, helping your team move faster while staying compliant.',
    },
    {
      slug: 'creative-designer',
      name: 'Creative Designer',
      short_description: 'Generate brand assets, social graphics, and marketing materials.',
      description: 'Creative Designer generates brand-consistent visual assets including social media graphics, presentations, logos, and marketing materials using AI.',
      category: 'creative',
      developer: 'PixelAI Studio',
      price: 25,
      price_label: '$25/mo',
      rating: 4.5,
      review_count: 1560,
      total_installs: 19870,
      version: '3.2.1',
      verified: true,
      tags: ['design', 'creative', 'graphics', 'branding', 'social-media'],
      integrations: ['Figma', 'Canva', 'Adobe CC', 'Slack', 'Notion'],
      capabilities: ['Social Graphics', 'Brand Kit', 'Presentation Design', 'Image Generation', 'Template Builder'],
      key_benefits: [
        { title: 'Brand Consistent', description: 'Every asset matches your brand guidelines automatically.' },
        { title: 'Instant Design', description: 'Generate professional designs in seconds, not hours.' },
        { title: 'Multi-format', description: 'Auto-resize for any platform — Instagram, LinkedIn, Twitter.' },
        { title: 'Template Library', description: 'Hundreds of customizable templates for any occasion.' },
      ],
      about: 'Creative Designer is your AI design team. It produces stunning, brand-consistent visuals at the speed of thought.',
    },
    {
      slug: 'email-marketer',
      name: 'Email Marketer AI',
      short_description: 'AI-powered email campaigns with personalization and A/B testing.',
      description: 'Email Marketer AI creates, personalizes, and optimizes email marketing campaigns. It handles segmentation, A/B testing, and send-time optimization.',
      category: 'sales',
      developer: 'MailGenius',
      price: 29,
      price_label: '$29/mo',
      rating: 4.6,
      review_count: 945,
      total_installs: 13200,
      version: '2.3.0',
      verified: true,
      tags: ['email', 'marketing', 'campaigns', 'personalization', 'automation'],
      integrations: ['Mailchimp', 'SendGrid', 'HubSpot', 'Shopify', 'Slack'],
      capabilities: ['Campaign Creation', 'Personalization', 'A/B Testing', 'Send Optimization', 'Analytics Dashboard'],
      key_benefits: [
        { title: 'Higher Open Rates', description: 'AI-optimized subject lines boost open rates by 35%.' },
        { title: 'Smart Timing', description: 'Sends at the optimal time for each individual subscriber.' },
        { title: 'Auto A/B Testing', description: 'Continuously tests and optimizes for best performance.' },
        { title: 'Hyper-personal', description: 'Each email feels personally crafted for the recipient.' },
      ],
      about: 'Email Marketer AI turns your email list into a revenue engine with hyper-personalized campaigns that convert.',
    },
    {
      slug: 'devops-pipeline',
      name: 'DevOps Pipeline Agent',
      short_description: 'Automated CI/CD management, deployment, and infrastructure as code.',
      description: 'DevOps Pipeline Agent manages your CI/CD pipelines, automates deployments, handles rollbacks, and maintains infrastructure as code.',
      category: 'coding',
      developer: 'DevForge',
      price: 45,
      price_label: '$45/mo',
      rating: 4.8,
      review_count: 789,
      total_installs: 9870,
      version: '2.5.0',
      verified: true,
      tags: ['devops', 'ci-cd', 'deployment', 'infrastructure', 'kubernetes'],
      integrations: ['GitHub Actions', 'Jenkins', 'ArgoCD', 'Terraform', 'AWS'],
      capabilities: ['Pipeline Management', 'Auto Deployment', 'Rollback Automation', 'Infrastructure as Code', 'Cost Monitoring'],
      key_benefits: [
        { title: 'Zero-downtime', description: 'Blue-green and canary deployments out of the box.' },
        { title: 'Auto Rollback', description: 'Detects failures and rolls back automatically.' },
        { title: 'Cost Aware', description: 'Tracks infrastructure costs per deployment.' },
        { title: 'Multi-cloud', description: 'Works with AWS, GCP, Azure, and any Kubernetes cluster.' },
      ],
      about: 'DevOps Pipeline Agent removes the toil from deployments. Push code, and it handles the rest.',
    },
    {
      slug: 'social-media-manager',
      name: 'Social Media Manager',
      short_description: 'Schedule, publish, and analyze social media content across platforms.',
      description: 'Social Media Manager automates your entire social presence — from content creation to scheduling, publishing, engagement monitoring, and analytics.',
      category: 'creative',
      developer: 'SocialFlow AI',
      price: 22,
      price_label: '$22/mo',
      rating: 4.4,
      review_count: 1823,
      total_installs: 24560,
      version: '3.0.1',
      verified: true,
      tags: ['social-media', 'scheduling', 'analytics', 'engagement', 'content'],
      integrations: ['Twitter/X', 'Instagram', 'LinkedIn', 'TikTok', 'Buffer'],
      capabilities: ['Content Scheduling', 'Auto Posting', 'Engagement Analytics', 'Trend Detection', 'Hashtag Optimization'],
      key_benefits: [
        { title: 'Auto Schedule', description: 'Posts at optimal times for maximum engagement.' },
        { title: 'Trend Riding', description: 'Detects trends early and suggests timely content.' },
        { title: 'Cross-platform', description: 'Manage all platforms from a single dashboard.' },
        { title: 'Engagement Insights', description: 'Deep analytics on what content resonates.' },
      ],
      about: 'Social Media Manager is your AI social team that keeps your brand active and engaging across every platform.',
    },
    {
      slug: 'project-manager-ai',
      name: 'Project Manager AI',
      short_description: 'Intelligent project planning, task assignment, and deadline tracking.',
      description: 'Project Manager AI creates project plans, assigns tasks based on team capacity, tracks deadlines, identifies blockers, and sends intelligent status updates.',
      category: 'operations',
      developer: 'mawaDao Labs',
      price: 35,
      price_label: '$35/mo',
      rating: 4.5,
      review_count: 567,
      total_installs: 7890,
      version: '2.0.0',
      verified: true,
      tags: ['project-management', 'tasks', 'planning', 'agile', 'tracking'],
      integrations: ['Jira', 'Asana', 'Linear', 'Slack', 'Notion'],
      capabilities: ['Project Planning', 'Task Assignment', 'Deadline Tracking', 'Resource Optimization', 'Status Reports'],
      key_benefits: [
        { title: 'Auto Planning', description: 'Generates project plans from requirements in minutes.' },
        { title: 'Smart Assignment', description: 'Assigns tasks based on skills and current workload.' },
        { title: 'Blocker Detection', description: 'Proactively identifies and flags potential blockers.' },
        { title: 'Stakeholder Updates', description: 'Auto-generates status reports for stakeholders.' },
      ],
      about: 'Project Manager AI keeps your projects on track with intelligent planning, assignment, and proactive risk management.',
    },
    {
      slug: 'seo-optimizer',
      name: 'SEO Optimizer',
      short_description: 'Comprehensive SEO analysis, keyword research, and content optimization.',
      description: 'SEO Optimizer provides full-site SEO audits, keyword research, content optimization suggestions, backlink analysis, and rank tracking.',
      category: 'writing',
      developer: 'RankAI',
      price: 32,
      price_label: '$32/mo',
      rating: 4.7,
      review_count: 1102,
      total_installs: 16780,
      version: '2.8.0',
      verified: true,
      tags: ['seo', 'keywords', 'ranking', 'optimization', 'backlinks'],
      integrations: ['Google Search Console', 'Ahrefs', 'WordPress', 'Shopify', 'Slack'],
      capabilities: ['Site Audit', 'Keyword Research', 'Content Scoring', 'Rank Tracking', 'Backlink Analysis'],
      key_benefits: [
        { title: 'Higher Rankings', description: 'Data-driven recommendations that actually improve rankings.' },
        { title: 'Content Scoring', description: 'Score and optimize content before publishing.' },
        { title: 'Competitor Intel', description: 'Track and analyze competitor SEO strategies.' },
        { title: 'Auto Monitoring', description: 'Alerts when rankings drop or issues are detected.' },
      ],
      about: 'SEO Optimizer is your competitive edge in search. Get higher rankings with AI-powered analysis and optimization.',
    },
    {
      slug: 'translation-agent',
      name: 'Translation Agent',
      short_description: 'Real-time multi-language translation with context awareness.',
      description: 'Translation Agent provides context-aware translation across 100+ languages, maintaining tone, idioms, and cultural nuance for business communications.',
      category: 'writing',
      developer: 'LinguaAI',
      price: 15,
      price_label: '$15/mo',
      rating: 4.6,
      review_count: 890,
      total_installs: 21340,
      version: '3.1.0',
      verified: true,
      tags: ['translation', 'localization', 'multi-language', 'i18n', 'communication'],
      integrations: ['Slack', 'Teams', 'Notion', 'Gmail', 'Zendesk'],
      capabilities: ['Real-time Translation', 'Document Translation', 'Tone Matching', 'Cultural Adaptation', 'Glossary Management'],
      key_benefits: [
        { title: '100+ Languages', description: 'Translate between over 100 language pairs instantly.' },
        { title: 'Context Aware', description: 'Understands business context for accurate translations.' },
        { title: 'Tone Matching', description: 'Maintains your brand voice across languages.' },
        { title: 'Team Integration', description: 'Drop into Slack and Teams for instant translation.' },
      ],
      about: 'Translation Agent breaks down language barriers for global teams with accurate, context-aware translation.',
    },
    {
      slug: 'security-sentinel',
      name: 'Security Sentinel',
      short_description: 'Continuous security monitoring, threat detection, and incident response.',
      description: 'Security Sentinel monitors your infrastructure for threats, detects anomalies, responds to incidents, and maintains security compliance.',
      category: 'coding',
      developer: 'CyberShield AI',
      price: 79,
      price_label: '$79/mo',
      rating: 4.8,
      review_count: 445,
      total_installs: 5670,
      version: '2.0.0',
      verified: true,
      tags: ['security', 'monitoring', 'threat-detection', 'compliance', 'incident-response'],
      integrations: ['AWS GuardDuty', 'Splunk', 'PagerDuty', 'Slack', 'Jira'],
      capabilities: ['Threat Detection', 'Incident Response', 'Vulnerability Scanning', 'Compliance Monitoring', 'Access Audit'],
      key_benefits: [
        { title: 'Real-time Threats', description: 'Detect and respond to threats in milliseconds.' },
        { title: 'Auto Response', description: 'Automated playbooks for common security incidents.' },
        { title: 'Compliance Ready', description: 'SOC 2, HIPAA, and GDPR compliance monitoring.' },
        { title: 'Zero Trust', description: 'Continuous verification of every access request.' },
      ],
      about: 'Security Sentinel is your AI security team that never sleeps. Continuous monitoring, instant response, and full compliance.',
    },
    {
      slug: 'meeting-assistant',
      name: 'Meeting Assistant',
      short_description: 'AI notetaker, action item tracker, and meeting summarizer.',
      description: 'Meeting Assistant joins your meetings to take notes, generate summaries, track action items, and distribute follow-ups automatically.',
      category: 'operations',
      developer: 'mawaDao Labs',
      price: 12,
      price_label: '$12/mo',
      rating: 4.7,
      review_count: 2340,
      total_installs: 31200,
      version: '4.1.0',
      verified: true,
      tags: ['meetings', 'notes', 'summaries', 'action-items', 'productivity'],
      integrations: ['Zoom', 'Google Meet', 'Teams', 'Slack', 'Notion'],
      capabilities: ['Auto Transcription', 'Meeting Summaries', 'Action Items', 'Follow-up Emails', 'Decision Tracking'],
      key_benefits: [
        { title: 'Perfect Notes', description: 'Never miss a detail with AI-powered transcription.' },
        { title: 'Action Tracking', description: 'Automatically identifies and tracks action items.' },
        { title: 'Auto Follow-ups', description: 'Sends meeting summaries and next steps to attendees.' },
        { title: 'Decision Log', description: 'Maintains a searchable log of all decisions made.' },
      ],
      about: 'Meeting Assistant ensures every meeting is productive. Perfect notes, clear action items, and automatic follow-ups every time.',
    },
    {
      slug: 'research-analyst',
      name: 'Research Analyst AI',
      short_description: 'Deep research, competitive analysis, and market intelligence.',
      description: 'Research Analyst AI conducts comprehensive research across the web, analyzes competitors, monitors markets/industries, and produces detailed reports.',
      category: 'data',
      developer: 'InsightFlow',
      price: 42,
      price_label: '$42/mo',
      rating: 4.5,
      review_count: 612,
      total_installs: 8430,
      version: '2.2.0',
      verified: true,
      tags: ['research', 'analysis', 'competitive-intel', 'market', 'reports'],
      integrations: ['Notion', 'Google Docs', 'Slack', 'Airtable', 'Tableau'],
      capabilities: ['Web Research', 'Competitive Analysis', 'Market Monitoring', 'Report Generation', 'Trend Forecasting'],
      key_benefits: [
        { title: 'Deep Research', description: 'Analyzes hundreds of sources in minutes, not days.' },
        { title: 'Competitor Watch', description: 'Track competitors and get alerts on their moves.' },
        { title: 'Market Intel', description: 'Real-time market trends and industry insights.' },
        { title: 'Auto Reports', description: 'Professional research reports generated on demand.' },
      ],
      about: 'Research Analyst AI does in minutes what takes human researchers days. Deep, comprehensive research delivered in actionable reports.',
    },
    {
      slug: 'chatbot-builder',
      name: 'Chatbot Builder',
      short_description: 'No-code chatbot creation for websites and messaging platforms.',
      description: 'Chatbot Builder lets you create intelligent chatbots for your website, WhatsApp, Facebook, and more — no coding required. Train with your docs and FAQs.',
      category: 'customer-support',
      developer: 'ChatFlow AI',
      price: 19,
      price_label: '$19/mo',
      rating: 4.4,
      review_count: 1567,
      total_installs: 18900,
      version: '3.5.0',
      verified: true,
      tags: ['chatbot', 'no-code', 'website', 'messaging', 'faq'],
      integrations: ['WhatsApp', 'Facebook', 'Telegram', 'Shopify', 'WordPress'],
      capabilities: ['Visual Bot Builder', 'Knowledge Training', 'Multi-channel Deploy', 'Analytics', 'Human Handoff'],
      key_benefits: [
        { title: 'No Code', description: 'Build powerful chatbots with a visual drag-and-drop interface.' },
        { title: 'Train with Docs', description: 'Upload your docs and FAQs to instantly train your bot.' },
        { title: 'Multi-channel', description: 'Deploy to website, WhatsApp, Facebook, and more.' },
        { title: 'Smart Handoff', description: 'Seamlessly escalate to human agents when needed.' },
      ],
      about: 'Chatbot Builder makes it easy for anyone to create intelligent chatbots. No coding, no complexity — just results.',
    },
  ];
}

function getSeedSkills() {
  return [
    // ai-ml
    { skill_id: 'weather', name: 'Weather', description: 'Get real-time weather conditions, temperature, humidity, wind, and forecasts for any city worldwide.', category: 'ai-ml', installs: 48000, source: 'wttr.in', source_url: 'https://wttr.in' },
    { skill_id: 'browser_use', name: 'Browser Use', description: 'Browse the web, search for information, and extract live data from websites in real-time.', category: 'ai-ml', installs: 46000, source: 'mawa', source_url: 'https://github.com/nicepkg/openclaw' },
    { skill_id: 'web_search', name: 'Web Search', description: 'Search the internet in real-time for current information and news.', category: 'ai-ml', installs: 50000, source: 'openai_official', source_url: 'https://platform.openai.com/docs/plugins/getting-started' },
    { skill_id: 'code_interpreter', name: 'Code Interpreter', description: 'Execute Python code, analyze data, and run computations securely.', category: 'ai-ml', installs: 45000, source: 'openai_official', source_url: 'https://platform.openai.com/docs/assistants/tools/code-interpreter' },
    { skill_id: 'image_analysis', name: 'Image Analysis', description: 'Analyze, describe, and extract information from images using vision AI.', category: 'ai-ml', installs: 32000, source: 'Meta Community', source_url: 'https://ai.meta.com' },
    { skill_id: 'sentiment_analyzer', name: 'Sentiment Analyzer', description: 'Detect sentiment, emotion, and tone in any text input.', category: 'ai-ml', installs: 28000, source: 'HuggingFace', source_url: 'https://huggingface.co' },
    { skill_id: 'text_summarizer', name: 'Text Summarizer', description: 'Summarize long documents, articles, and research papers into concise summaries.', category: 'ai-ml', installs: 35000, source: 'Google Labs', source_url: 'https://labs.google' },
    { skill_id: 'document_qa', name: 'Document Q&A', description: 'Answer questions from PDF, DOCX, and text documents using RAG.', category: 'ai-ml', installs: 22000, source: 'LlamaIndex', source_url: 'https://www.llamaindex.ai' },
    { skill_id: 'translate', name: 'Language Translator', description: 'Translate text between 100+ languages with high accuracy.', category: 'ai-ml', installs: 41000, source: 'DeepL Community', source_url: 'https://www.deepl.com' },
    { skill_id: 'speech_to_text', name: 'Speech to Text', description: 'Convert audio recordings and voice input to accurate text transcripts.', category: 'ai-ml', installs: 19000, source: 'Whisper Community', source_url: 'https://openai.com/research/whisper' },
    { skill_id: 'embeddings_search', name: 'Semantic Search', description: 'Vector-based semantic similarity search over your knowledge base.', category: 'ai-ml', installs: 17000, source: 'Pinecone Community', source_url: 'https://www.pinecone.io' },
    { skill_id: 'ocr_reader', name: 'OCR Reader', description: 'Extract text and structured data from scanned images and PDFs.', category: 'ai-ml', installs: 15000, source: 'Tesseract Community', source_url: 'https://github.com/tesseract-ocr' },
    // frontend
    { skill_id: 'react_helper', name: 'React Dev Assistant', description: 'Get expert help with React components, hooks, state management, and patterns.', category: 'frontend', installs: 38000, source: 'Vercel Community', source_url: 'https://vercel.com' },
    { skill_id: 'vue_helper', name: 'Vue.js Helper', description: 'Vue 3, Composition API, Pinia, and Nuxt.js expert assistance.', category: 'frontend', installs: 22000, source: 'Vue Community', source_url: 'https://vuejs.org' },
    { skill_id: 'css_optimizer', name: 'CSS Optimizer', description: 'Optimize, debug, and modernize your CSS including Tailwind and CSS-in-JS.', category: 'frontend', installs: 29000, source: 'Tailwind Labs', source_url: 'https://tailwindcss.com' },
    { skill_id: 'accessibility_check', name: 'Accessibility Checker', description: 'Check WCAG 2.1 compliance and fix accessibility issues in your UI.', category: 'frontend', installs: 14000, source: 'A11y Community', source_url: 'https://www.w3.org/WAI' },
    { skill_id: 'performance_audit', name: 'Web Performance', description: 'Audit Core Web Vitals, Lighthouse scores, and page load performance.', category: 'frontend', installs: 17000, source: 'Google Community', source_url: 'https://web.dev' },
    { skill_id: 'seo_helper', name: 'SEO Optimizer', description: 'Improve meta tags, structured data, Open Graph, and overall SEO.', category: 'frontend', installs: 21000, source: 'Moz Labs', source_url: 'https://moz.com' },
    { skill_id: 'web_scraper', name: 'Web Scraper', description: 'Extract structured data from websites using CSS selectors and XPath.', category: 'frontend', installs: 25000, source: 'Open Source', source_url: 'https://github.com' },
    // backend
    { skill_id: 'rest_tester', name: 'REST API Tester', description: 'Test REST endpoints, inspect responses, and generate API documentation.', category: 'backend', installs: 33000, source: 'Postman Community', source_url: 'https://www.postman.com' },
    { skill_id: 'sql_query', name: 'SQL Assistant', description: 'Write, debug, and optimize SQL queries for PostgreSQL, MySQL, and SQLite.', category: 'backend', installs: 36000, source: 'Postgres Community', source_url: 'https://www.postgresql.org' },
    { skill_id: 'graphql_helper', name: 'GraphQL Helper', description: 'Build and debug GraphQL schemas, queries, mutations, and resolvers.', category: 'backend', installs: 18000, source: 'Apollo Community', source_url: 'https://www.apollographql.com' },
    { skill_id: 'docker_advisor', name: 'Docker Expert', description: 'Container management, Dockerfile optimization, and compose configuration.', category: 'backend', installs: 27000, source: 'Docker Hub', source_url: 'https://hub.docker.com' },
    { skill_id: 'redis_helper', name: 'Redis Helper', description: 'Redis commands, caching strategies, pub/sub patterns, and Lua scripting.', category: 'backend', installs: 16000, source: 'Redis Labs', source_url: 'https://redis.io' },
    { skill_id: 'microservices', name: 'Microservices Advisor', description: 'Architecture patterns, service mesh, and distributed system design guidance.', category: 'backend', installs: 13000, source: 'CNCF', source_url: 'https://www.cncf.io' },
    { skill_id: 'webhook_handler', name: 'Webhook Builder', description: 'Create, test, and manage webhook integrations across services.', category: 'backend', installs: 11000, source: 'Open Source', source_url: 'https://github.com' },
    // devops
    { skill_id: 'ci_cd', name: 'CI/CD Helper', description: 'GitHub Actions, GitLab CI, and CircleCI pipeline configuration and debugging.', category: 'devops', installs: 24000, source: 'GitHub Community', source_url: 'https://github.com/features/actions' },
    { skill_id: 'kubernetes', name: 'Kubernetes Expert', description: 'K8s deployment, scaling, networking, RBAC, and troubleshooting.', category: 'devops', installs: 20000, source: 'CNCF', source_url: 'https://kubernetes.io' },
    { skill_id: 'terraform_iac', name: 'Terraform IaC', description: 'Infrastructure as code for AWS, GCP, and Azure with best practices.', category: 'devops', installs: 18000, source: 'HashiCorp', source_url: 'https://www.terraform.io' },
    { skill_id: 'log_analyzer', name: 'Log Analyzer', description: 'Parse, analyze, and extract insights from application and system logs.', category: 'devops', installs: 15000, source: 'Elastic Community', source_url: 'https://www.elastic.co' },
    { skill_id: 'monitoring', name: 'Monitoring Setup', description: 'Set up metrics, alerting, dashboards, and SLOs with Prometheus and Grafana.', category: 'devops', installs: 13000, source: 'Grafana Labs', source_url: 'https://grafana.com' },
    // data
    { skill_id: 'csv_analyzer', name: 'CSV Analyzer', description: 'Analyze, filter, aggregate, and transform CSV data with natural language.', category: 'data', installs: 26000, source: 'Pandas Community', source_url: 'https://pandas.pydata.org' },
    { skill_id: 'json_tools', name: 'JSON Tools', description: 'Parse, validate, format, query (JMESPath/jq), and transform JSON data.', category: 'data', installs: 30000, source: 'Open Source', source_url: 'https://github.com' },
    { skill_id: 'data_validator', name: 'Data Validator', description: 'Validate data schemas, constraints, and quality with automated checks.', category: 'data', installs: 14000, source: 'Great Expectations', source_url: 'https://greatexpectations.io' },
    { skill_id: 'chart_builder', name: 'Chart Builder', description: 'Create bar, line, pie, and scatter charts from your data with natural language.', category: 'data', installs: 19000, source: 'D3 Community', source_url: 'https://d3js.org' },
    { skill_id: 'etl_assistant', name: 'ETL Helper', description: 'Design and automate data pipeline ETL workflows between sources and destinations.', category: 'data', installs: 11000, source: 'Airbyte Community', source_url: 'https://airbyte.com' },
    // security
    { skill_id: 'dep_checker', name: 'Dependency Checker', description: 'Scan npm, pip, and Maven dependencies for known CVE vulnerabilities.', category: 'security', installs: 21000, source: 'Snyk Community', source_url: 'https://snyk.io' },
    { skill_id: 'owasp_guide', name: 'OWASP Guide', description: 'Web application security best practices and OWASP Top 10 checklists.', category: 'security', installs: 18000, source: 'OWASP', source_url: 'https://owasp.org' },
    { skill_id: 'secret_detector', name: 'Secret Detector', description: 'Find exposed API keys, passwords, and credentials in code and git history.', category: 'security', installs: 16000, source: 'TruffleHog', source_url: 'https://github.com/trufflesecurity/trufflehog' },
    { skill_id: 'ssl_checker', name: 'SSL Analyzer', description: 'Validate SSL/TLS certificates, HTTPS configuration, and cipher suites.', category: 'security', installs: 12000, source: 'SSL Labs', source_url: 'https://www.ssllabs.com' },
    { skill_id: 'pen_test_guide', name: 'Pen Test Helper', description: 'Ethical hacking methodology, recon techniques, and vulnerability assessment guidance.', category: 'security', installs: 9000, source: 'HackerOne', source_url: 'https://www.hackerone.com' },
    // testing
    { skill_id: 'unit_test_gen', name: 'Unit Test Generator', description: 'Automatically generate Jest, Vitest, and PyTest test cases for your functions.', category: 'testing', installs: 22000, source: 'Jest Community', source_url: 'https://jestjs.io' },
    { skill_id: 'e2e_helper', name: 'E2E Test Helper', description: 'Write and debug Playwright and Cypress end-to-end tests with AI assistance.', category: 'testing', installs: 17000, source: 'Playwright', source_url: 'https://playwright.dev' },
    { skill_id: 'mock_generator', name: 'Mock Generator', description: 'Generate realistic fake data, fixtures, and mocks for testing.', category: 'testing', installs: 20000, source: 'Faker Labs', source_url: 'https://fakerjs.dev' },
    { skill_id: 'coverage_reporter', name: 'Coverage Reporter', description: 'Analyze test coverage gaps and generate reports with Istanbul and c8.', category: 'testing', installs: 12000, source: 'Istanbul', source_url: 'https://istanbul.js.org' },
    // writing
    { skill_id: 'blog_writer', name: 'Blog Writer', description: 'Create SEO-optimized blog posts, articles, and long-form content.', category: 'writing', installs: 28000, source: 'Prose Labs', source_url: 'https://github.com' },
    { skill_id: 'grammar_fix', name: 'Grammar Checker', description: 'Advanced grammar, style, clarity, and tone checking for any text.', category: 'writing', installs: 35000, source: 'Grammarly Model', source_url: 'https://www.grammarly.com' },
    { skill_id: 'doc_generator', name: 'Doc Generator', description: 'Auto-generate README files, API docs, and inline code documentation.', category: 'writing', installs: 15000, source: 'Mintlify', source_url: 'https://mintlify.com' },
    { skill_id: 'content_planner', name: 'Content Planner', description: 'Plan, schedule, and organize content calendars for blogs and social media.', category: 'writing', installs: 12000, source: 'HubSpot Model', source_url: 'https://www.hubspot.com' },
    // productivity
    { skill_id: 'meeting_notes', name: 'Meeting Notes', description: 'Summarize meetings, extract action items, and create follow-up email drafts.', category: 'productivity', installs: 19000, source: 'Otter.ai Model', source_url: 'https://otter.ai' },
    { skill_id: 'task_manager', name: 'Task Manager', description: 'Organize tasks, set priorities, track deadlines, and manage projects with AI.', category: 'productivity', installs: 24000, source: 'Notion Community', source_url: 'https://www.notion.so' },
    { skill_id: 'email_writer', name: 'Email Writer', description: 'Compose professional, clear, and effective emails for any business context.', category: 'productivity', installs: 22000, source: 'Superhuman Model', source_url: 'https://superhuman.com' },
    // general
    { skill_id: 'calculator', name: 'Calculator', description: 'Perform math, scientific, statistical, and financial calculations.', category: 'general', installs: 42000, source: 'Open Source', source_url: 'https://github.com' },
    { skill_id: 'timezone_converter', name: 'Timezone Tool', description: 'Convert times and dates across all world timezones and daylight saving rules.', category: 'general', installs: 38000, source: 'Open Source', source_url: 'https://github.com' },
    { skill_id: 'unit_converter', name: 'Unit Converter', description: 'Convert measurement units: length, weight, temperature, volume, and more.', category: 'general', installs: 33000, source: 'Open Source', source_url: 'https://github.com' },
    { skill_id: 'regex_helper', name: 'Regex Helper', description: 'Write, test, explain, and debug regular expressions for any use case.', category: 'general', installs: 27000, source: 'Open Source', source_url: 'https://regex101.com' },
    { skill_id: 'code_snippet', name: 'Code Search', description: 'Find, explain, and adapt code examples and snippets for common programming tasks.', category: 'general', installs: 31000, source: 'Stack Overflow', source_url: 'https://stackoverflow.com' },
  ];
}
