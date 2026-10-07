'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks';
import { useAuthStore } from '@/store';
import { AppSidebar, SidebarLayout } from '@/components/layout/sidebar';
import { Button, Badge, Input, Skeleton } from '@/components/ui';
import { ROUTES } from '@/lib/constants';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Download,
  TrendingUp,
  Package,
  ChevronDown,
  Check,
  ExternalLink,
  Sparkles,
  Zap,
  Code2,
  Shield,
  Cpu,
  Palette,
  PenTool,
  BarChart3,
  Smartphone,
  TestTube,
  Briefcase,
  Settings,
  X,
  ArrowUpDown,
  Star,
  GitBranch,
  Loader2,
} from 'lucide-react';

// Types
type Skill = {
  id: string;
  skill_id: string;
  name: string;
  description: string;
  category: string;
  installs: number;
  source: string;
  source_url: string;
  is_installed: boolean;
};

type Category = {
  category: string;
  count: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

// Category icon map
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'ai-ml': Cpu,
  'frontend': Code2,
  'backend': Zap,
  'devops': Settings,
  'data': BarChart3,
  'security': Shield,
  'mobile': Smartphone,
  'testing': TestTube,
  'writing': PenTool,
  'productivity': Briefcase,
  'design': Palette,
  'finance': TrendingUp,
  'general': Package,
};

const CATEGORY_COLORS: Record<string, string> = {
  'ai-ml': 'from-violet-500 to-purple-600',
  'frontend': 'from-cyan-500 to-blue-600',
  'backend': 'from-emerald-500 to-green-600',
  'devops': 'from-orange-500 to-red-600',
  'data': 'from-blue-500 to-indigo-600',
  'security': 'from-red-500 to-rose-600',
  'mobile': 'from-pink-500 to-fuchsia-600',
  'testing': 'from-yellow-500 to-amber-600',
  'writing': 'from-teal-500 to-cyan-600',
  'productivity': 'from-indigo-500 to-blue-600',
  'design': 'from-fuchsia-500 to-pink-600',
  'finance': 'from-green-500 to-emerald-600',
  'general': 'from-gray-500 to-slate-600',
};

const CATEGORY_LABELS: Record<string, string> = {
  'ai-ml': 'AI & ML',
  'frontend': 'Frontend',
  'backend': 'Backend',
  'devops': 'DevOps',
  'data': 'Data',
  'security': 'Security',
  'mobile': 'Mobile',
  'testing': 'Testing',
  'writing': 'Writing',
  'productivity': 'Productivity',
  'design': 'Design',
  'finance': 'Finance',
  'general': 'General',
};

function formatInstalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Skill Card Component
const SkillCard = React.forwardRef<HTMLDivElement, { skill: Skill; onInstall: (s: Skill) => void; onUninstall?: (s: Skill) => void }>(function SkillCard(
  { skill, onInstall, onUninstall },
  ref,
) {
  const Icon = CATEGORY_ICONS[skill.category] || Package;
  const gradient = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS['general'];
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [installed, setInstalled] = useState(skill.is_installed);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await onInstall(skill);
      setInstalled(true);
    } catch {
      // handled by parent
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async () => {
    if (!onUninstall) return;
    setUninstalling(true);
    try {
      await onUninstall(skill);
      setInstalled(false);
    } catch {
      // handled by parent
    } finally {
      setUninstalling(false);
    }
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:shadow-card-hover hover:border-primary/20 transition-all duration-300"
    >
      {/* Top gradient accent bar */}
      <div className={`h-1 bg-gradient-to-r ${gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />

      <div className="p-5">
        {/* Row 1: Icon + Badge + Install */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <Badge variant="secondary" className="text-2xs shrink-0 px-1.5 py-0">
              {CATEGORY_LABELS[skill.category] || skill.category}
            </Badge>
          </div>
          <div className="shrink-0">
            {installed ? (
              <Button
                size="sm"
                onClick={handleUninstall}
                disabled={uninstalling}
                className="rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 text-xs px-3 h-8"
              >
                {uninstalling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Uninstall
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleInstall}
                disabled={installing}
                className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/20 text-xs px-3 h-8"
              >
                {installing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Install
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Full name — no truncation */}
        <h3 className="font-semibold text-sm text-foreground leading-snug mb-1.5 break-words">
          {skill.name}
        </h3>

        {/* Row 3: Source */}
        <p className="text-xs text-muted-foreground truncate mb-3">
          <GitBranch className="inline h-3 w-3 mr-1 opacity-50" />
          {skill.source}
        </p>

        {/* Row 4: Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {formatInstalls(skill.installs)}
          </span>
          {skill.source_url && (
            <a
              href={skill.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              GitHub
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
});

SkillCard.displayName = 'SkillCard';

// Main Skills Page
export default function SkillsPage() {
  const router = useRouter();
  const { isAuthenticated, user, agent } = useAuth();
  const authStore = useAuthStore();
  const isAuth = isAuthenticated || !!authStore.user;
  const userId = user?.id || agent?.id || authStore.user?.id || 'anonymous';

  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sort, setSort] = useState('installs');
  const [page, setPage] = useState(1);
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuth) router.push('/');
  }, [isAuth, router]);

  // Fetch categories on mount
  useEffect(() => {
    fetch('/api/skills/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(console.error);
  }, []);

  // Fetch skills
  const fetchSkills = useCallback(async (p: number, q: string, cat: string, s: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '24',
        sort: s,
        includeTotal: 'true',
      });
      if (q) params.set('q', q);
      if (cat && cat !== 'all') params.set('category', cat);

      const res = await fetch(`/api/skills?${params}`, {
        headers: { 'x-user-id': userId },
      });
      const data = await res.json();
      setSkills(data.data || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills(page, search, activeCategory, sort);
  }, [page, activeCategory, sort, fetchSkills]);

  // Debounced search
  const handleSearch = (q: string) => {
    setSearch(q);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchSkills(1, q, activeCategory, sort);
    }, 300);
  };

  // Install skill
  const handleInstall = async (skill: Skill) => {
    const res = await fetch('/api/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ skillId: skill.skill_id, source: skill.source }),
    });
    const data = await res.json();
    if (!data.success) throw new Error('Install failed');
    // Refresh the list so the installed skill disappears from the hub
    fetchSkills(page, search, activeCategory, sort);
  };

  // Uninstall skill
  const handleUninstall = async (skill: Skill) => {
    const res = await fetch('/api/skills/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ skillId: skill.skill_id, source: skill.source }),
    });
    const data = await res.json();
    if (!data.success) throw new Error('Uninstall failed');
    // Refresh the list so the uninstalled skill reappears in the hub
    fetchSkills(page, search, activeCategory, sort);
  };

  const totalSkills = pagination?.total || 0;

  if (!isAuth) return null;

  return (
    <SidebarLayout sidebar={<AppSidebar />}>
      <div className="min-h-screen">
        {/* Hero header */}
        <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-purple-50/20 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-purple-950/5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent dark:from-blue-900/10" />
          <div className="relative px-6 md:px-8 py-8 md:py-12 max-w-6xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Skills Hub</h1>
                <p className="text-sm text-muted-foreground">
                  {totalSkills > 0 ? `${totalSkills.toLocaleString()} skills` : 'Browse'} from the community
                </p>
              </div>
            </div>

            {/* Search bar */}
            <div className="mt-5 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search 62,000+ skills..."
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-card/80 backdrop-blur-sm text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 shadow-sm transition-all"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(''); setPage(1); fetchSkills(1, '', activeCategory, sort); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Content */}
        <div className="px-6 md:px-8 py-6 max-w-6xl">
          {/* Category pills + Sort */}
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => { setActiveCategory('all'); setPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeCategory === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                All Skills
              </button>
              {categories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.category] || Package;
                return (
                  <button
                    key={cat.category}
                    onClick={() => { setActiveCategory(cat.category); setPage(1); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      activeCategory === cat.category
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {CATEGORY_LABELS[cat.category] || cat.category}
                    <span className="opacity-60">({formatInstalls(cat.count)})</span>
                  </button>
                );
              })}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1); }}
                className="text-xs font-medium bg-muted border-0 rounded-lg px-2 py-1.5 text-foreground focus:ring-2 focus:ring-primary/20"
              >
                <option value="installs">Most Popular</option>
                <option value="name">A → Z</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {/* Skills Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start gap-3.5">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No skills found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Try adjusting your search or category filter to find what you&apos;re looking for.
              </p>
            </div>
          ) : (
            <>
              <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {skills.map((skill) => (
                    <SkillCard key={skill.id} skill={skill} onInstall={handleInstall} onUninstall={handleUninstall} />
                  ))}
                </AnimatePresence>
              </motion.div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-xl text-xs"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (pagination.totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (page <= 4) {
                        pageNum = i + 1;
                      } else if (page >= pagination.totalPages - 3) {
                        pageNum = pagination.totalPages - 6 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`h-8 w-8 rounded-lg text-xs font-medium transition-all ${
                            page === pageNum
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={!pagination.hasMore}
                    className="rounded-xl text-xs"
                  >
                    Next
                  </Button>
                  <span className="text-xs text-muted-foreground ml-2">
                    Page {page} of {pagination.totalPages}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </SidebarLayout>
  );
}
