'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks';
import { useSkillsStore } from '@/store';
import { ROUTES, APP_NAME } from '@/lib/constants';
import { Avatar, AvatarImage, AvatarFallback, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui';
import {
  Home,
  MessageSquare,
  Compass,
  Bell,
  Users,
  Bot,
  Store,
  LayoutDashboard,
  Radio,
  Settings,
  Search,
  Plus,
  Pin,
  CreditCard,
  Shield,
  Key,
  ChevronDown,
  LogOut,
  User,
  Palette,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Pencil,
  Check,
  X,
  HardDrive,
  Wand2,
} from 'lucide-react';

// =============================================================================
// Sidebar Shell — consistent frame for all sidebar variants
// =============================================================================
function SidebarShell({
  children,
  className,
  collapsed = false,
}: {
  children: React.ReactNode;
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen border-r border-border bg-gradient-to-b from-background to-muted/30 sticky top-0 overflow-y-auto transition-all duration-300 ease-in-out',
        collapsed ? 'w-[68px] min-w-[68px]' : 'w-[260px] min-w-[260px]',
        className
      )}
    >
      {children}
    </aside>
  );
}

// Sidebar logo header with collapse toggle
function SidebarLogo({ collapsed, onToggleCollapse }: { collapsed?: boolean; onToggleCollapse?: () => void }) {
  if (collapsed) {
    return (
      <div className="flex justify-center py-5 px-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors"
          title="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4 text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-5 py-5">
      <Link href={ROUTES.HOME} className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">m</span>
        </div>
        <span className="text-lg font-bold text-foreground">{APP_NAME}</span>
      </Link>
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Sidebar nav item
function SidebarItem({
  href,
  icon: Icon,
  label,
  isActive,
  badge,
  onClick,
  external,
  collapsed,
}: {
  href?: string;
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  badge?: string | number;
  onClick?: () => void;
  external?: boolean;
  collapsed?: boolean;
}) {
  const classes = cn(
    'flex items-center rounded-lg text-sm font-medium transition-colors w-full',
    collapsed ? 'justify-center px-2 py-2.5' : 'justify-start text-left gap-3 px-3 py-2.5',
    isActive
      ? 'bg-mawadao-50 dark:bg-primary/10 text-primary'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
  );

  const content = (
    <>
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge !== undefined && (
        <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-normal">
          {badge}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} title={collapsed ? label : undefined}>
        {content}
      </button>
    );
  }

  if (external) {
    return (
      <a href={href || '#'} target="_blank" rel="noopener noreferrer" className={classes} title={collapsed ? label : undefined}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href || '#'} className={classes} title={collapsed ? label : undefined}>
      {content}
    </Link>
  );
}

// Section label
function SidebarSection({ label, collapsed }: { label: string; collapsed?: boolean }) {
  if (collapsed) return <div className="my-2 mx-2 h-px bg-border" />;
  return (
    <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
  );
}

// =============================================================================
// APP SIDEBAR — used for Marketplace and general authenticated pages
// =============================================================================
export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, user, agent } = useAuth();
  const currentTab = searchParams.get('tab');
  const isHub = !!pathname?.startsWith('/marketplace');
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <SidebarShell collapsed={collapsed}>
      <SidebarLogo collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />

      <nav className={cn('flex-1 space-y-0.5', collapsed ? 'px-2' : 'px-3')}>
        <SidebarItem href={ROUTES.HOME} icon={Home} label="Home" isActive={pathname === '/'} collapsed={collapsed} />
        <SidebarItem href="/explore" icon={Compass} label="Explore" isActive={pathname === '/explore'} collapsed={collapsed} />
        <SidebarItem href="/marketplace?tab=notifications" icon={Bell} label="Notifications" isActive={isHub && currentTab === 'notifications'} collapsed={collapsed} />

        <SidebarSection label="Workspace" collapsed={collapsed} />
        <SidebarItem href="/marketplace?tab=communities" icon={Users} label="Communities" isActive={isHub && currentTab === 'communities'} collapsed={collapsed} />
        <SidebarItem href="/marketplace?tab=agents" icon={Bot} label="Agents" isActive={isHub && currentTab === 'agents'} collapsed={collapsed} />
        <SidebarItem href={ROUTES.MARKETPLACE} icon={Store} label="Marketplace" isActive={isHub && (!currentTab || currentTab === 'marketplace')} collapsed={collapsed} />
        <SidebarItem href={ROUTES.SKILLS} icon={Sparkles} label="Skills Hub" isActive={!!pathname?.startsWith('/skills')} collapsed={collapsed} />
        <SidebarItem href="/agent-builder" icon={Wand2} label="Agent Builder" isActive={pathname === '/agent-builder'} collapsed={collapsed} />
      </nav>

      <div className={cn('border-t border-border space-y-2', collapsed ? 'p-2' : 'p-4')}>
        {isAuthenticated ? (
          <SidebarUserCard compact={collapsed} />
        ) : (
          !collapsed && (
            <div className="space-y-2">
              <Link href={ROUTES.LOGIN}>
                <Button variant="outline" className="w-full justify-center">Log in</Button>
              </Link>
              <Link href={ROUTES.LOGIN}>
                <Button className="w-full justify-center">Sign up</Button>
              </Link>
            </div>
          )
        )}
      </div>
    </SidebarShell>
  );
}

// =============================================================================
// CHAT SIDEBAR — used for Chat page with thread history
// =============================================================================

type InstalledSkill = {
  id: string;
  skill_id: string;
  name: string;
  description?: string;
  category: string;
  source?: string;
  is_installed: boolean;
};

/** Extract human-readable display name from a skill.
 * Description format: "Pretty Name → from source/repo"
 * The stored name field is just the raw slug (same as skill_id).
 */
function getSkillDisplayName(skill: InstalledSkill): string {
  if (skill.description) {
    // Split on " â " (mangled â†') or " → " or " - from "
    const arrowIdx = skill.description.indexOf(' â ');
    if (arrowIdx > 0) return skill.description.slice(0, arrowIdx).trim();
    const arrowIdx2 = skill.description.indexOf(' → ');
    if (arrowIdx2 > 0) return skill.description.slice(0, arrowIdx2).trim();
  }
  // Fallback: convert kebab-case slug to Title Case
  return skill.name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function InstalledSkillsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, agent } = useAuth();
  const userId = user?.id || agent?.id || 'anonymous';
  const { setEnabledSkills } = useSkillsStore();
  const [skills, setSkills] = React.useState<InstalledSkill[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [toggling, setToggling] = React.useState<string | null>(null);
  const [uninstalling, setUninstalling] = React.useState<string | null>(null);

  const toEnabledSkills = React.useCallback((list: InstalledSkill[]) => (
    list
      .filter((s) => s.is_installed)
      .map((s) => ({ skill_id: s.skill_id, name: s.name, category: s.category }))
  ), []);

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      fetch('/api/skills?installed=true&limit=100', {
        headers: { 'x-user-id': userId },
      })
        .then((res) => res.json())
        .then((data) => {
          const list = data.data || [];
          setSkills(list);
          setEnabledSkills(toEnabledSkills(list));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, userId, setEnabledSkills, toEnabledSkills]);

  const handleToggle = async (skill: InstalledSkill) => {
    setToggling(skill.skill_id);
    const previous = skills;
    const newEnabled = !skill.is_installed;
    setSkills((prev) => {
      const next = prev.map((s) =>
        s.skill_id === skill.skill_id && (s.source ?? '') === (skill.source ?? '')
          ? { ...s, is_installed: newEnabled }
          : s
      );
      setEnabledSkills(toEnabledSkills(next));
      return next;
    });
    try {
      const res = await fetch('/api/skills/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ skillId: skill.skill_id, source: skill.source, enabled: newEnabled }),
      });
      if (!res.ok) {
        setSkills(previous);
        setEnabledSkills(toEnabledSkills(previous));
      }
    } catch {
      setSkills(previous);
      setEnabledSkills(toEnabledSkills(previous));
    } finally {
      setToggling(null);
    }
  };

  const handleUninstall = async (skill: InstalledSkill) => {
    setUninstalling(skill.skill_id);
    const previous = skills;
    setSkills((prev) => {
      const next = prev.filter((s) => !(s.skill_id === skill.skill_id && (s.source ?? '') === (skill.source ?? '')));
      setEnabledSkills(toEnabledSkills(next));
      return next;
    });
    try {
      const res = await fetch('/api/skills/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ skillId: skill.skill_id, source: skill.source }),
      });
      if (!res.ok) {
        setSkills(previous);
        setEnabledSkills(toEnabledSkills(previous));
      }
    } catch {
      setSkills(previous);
      setEnabledSkills(toEnabledSkills(previous));
    } finally {
      setUninstalling(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Skills
          </DialogTitle>
          <DialogDescription>
            Manage your installed skills. Toggle them on or off for this session.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto space-y-1 -mx-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : skills.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No installed skills yet</p>
              <Link
                href={ROUTES.SKILLS}
                className="text-sm text-primary hover:underline mt-2 inline-block"
              >
                Browse Skills Hub
              </Link>
            </div>
          ) : (
            skills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium text-foreground">{getSkillDisplayName(skill)}</p>
                  <p className="text-xs text-muted-foreground">{skill.source ?? skill.category}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(skill)}
                    disabled={toggling === skill.skill_id}
                    className={cn(
                      'relative h-6 w-11 rounded-full overflow-hidden transition-colors shrink-0 disabled:opacity-60',
                      skill.is_installed ? 'bg-primary' : 'bg-muted-foreground/30',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                    )}
                    aria-label={`Toggle ${skill.name}`}
                  >
                    <span
                      className={cn(
                        'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                        skill.is_installed ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUninstall(skill)}
                    disabled={uninstalling === skill.skill_id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-60"
                    aria-label={`Uninstall ${skill.name}`}
                    title="Uninstall"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChatSidebar({
  threads,
  activeThreadId,
  onNewChat,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
}: {
  threads?: { id: string; title: string; time: string; pinned?: boolean }[];
  activeThreadId?: string;
  onNewChat?: () => void;
  onSelectThread?: (id: string) => void;
  onDeleteThread?: (id: string) => void;
  onRenameThread?: (id: string, newTitle: string) => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [skillsDialogOpen, setSkillsDialogOpen] = React.useState(false);
  const [editingThreadId, setEditingThreadId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const editInputRef = React.useRef<HTMLInputElement>(null);

  const startEditing = React.useCallback((id: string, currentTitle: string) => {
    setEditingThreadId(id);
    setEditTitle(currentTitle);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, []);

  const saveEdit = React.useCallback(() => {
    if (editingThreadId && editTitle.trim()) {
      onRenameThread?.(editingThreadId, editTitle.trim());
    }
    setEditingThreadId(null);
    setEditTitle('');
  }, [editingThreadId, editTitle, onRenameThread]);

  const cancelEdit = React.useCallback(() => {
    setEditingThreadId(null);
    setEditTitle('');
  }, []);

  const pinnedThreads = threads?.filter((t) => t.pinned) ?? [];
  const todayThreads = threads?.filter((t) => !t.pinned && t.time === 'Today') ?? [];
  const yesterdayThreads = threads?.filter((t) => !t.pinned && t.time === 'Yesterday') ?? [];
  const olderThreads = threads?.filter((t) => !t.pinned && t.time !== 'Today' && t.time !== 'Yesterday') ?? [];

  const renderThread = (t: { id: string; title: string; time: string; pinned?: boolean }) => {
    const isEditing = editingThreadId === t.id;

    if (isEditing) {
      return (
        <div key={t.id} className="flex items-center gap-0.5 px-1">
          <div className="flex items-center gap-1 flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-muted border border-primary/30">
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-40" />
            <input
              ref={editInputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              onBlur={saveEdit}
              className="flex-1 min-w-0 bg-transparent text-sm text-foreground focus:outline-none"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={saveEdit}
            className="p-1 rounded text-emerald-500 hover:bg-emerald-500/10 transition-all shrink-0"
            title="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="p-1 rounded text-muted-foreground hover:text-red-500 transition-all shrink-0"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div key={t.id} className="group flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onSelectThread?.(t.id)}
          className={cn(
            'flex items-center gap-2 flex-1 min-w-0 px-3 py-2 rounded-lg text-sm transition-colors text-left',
            activeThreadId === t.id
              ? 'bg-mawadao-50 dark:bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          {t.pinned ? (
            <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-40" />
          )}
          <span className="truncate">{t.title}</span>
        </button>
        {onRenameThread && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); startEditing(t.id, t.title); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-primary transition-all shrink-0"
            title="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onDeleteThread && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDeleteThread(t.id); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-500 transition-all shrink-0"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <SidebarShell collapsed={collapsed}>
        <SidebarLogo collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />

        {/* New Chat + Search */}
        <div className={cn('space-y-2 pb-3', collapsed ? 'px-2' : 'px-3')}>
          <button
            type="button"
            onClick={onNewChat}
            className={cn(
              'flex items-center gap-2 w-full rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors',
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
            )}
            title={collapsed ? 'New Chat' : undefined}
          >
            <Plus className="h-4 w-4" />
            {!collapsed && 'New Chat'}
          </button>
          {!collapsed && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-muted text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
              />
            </div>
          )}
        </div>

        {/* Thread Lists */}
        <div className={cn('flex-1 overflow-y-auto', collapsed ? 'px-2' : 'px-3 space-y-1')}>
          {!collapsed && (
            <>
              {pinnedThreads.length > 0 && (
                <>
                  <SidebarSection label="Pinned" />
                  {pinnedThreads.map(renderThread)}
                </>
              )}

              {todayThreads.length > 0 && (
                <>
                  <SidebarSection label="Today" />
                  {todayThreads.map(renderThread)}
                </>
              )}

              {yesterdayThreads.length > 0 && (
                <>
                  <SidebarSection label="Yesterday" />
                  {yesterdayThreads.map(renderThread)}
                </>
              )}

              {olderThreads.length > 0 && (
                <>
                  <SidebarSection label="Older" />
                  {olderThreads.map(renderThread)}
                </>
              )}
            </>
          )}
        </div>

        {/* Bottom nav */}
        <div className={cn('border-t border-border space-y-0.5', collapsed ? 'p-2' : 'p-3')}>
          <SidebarItem icon={Sparkles} label="Skills" collapsed={collapsed} onClick={() => setSkillsDialogOpen(true)} />
          <SidebarItem href={ROUTES.MARKETPLACE} icon={Store} label="Marketplace" isActive={false} collapsed={collapsed} />
          {!collapsed && (
            <SidebarItem
              href="#"
              icon={CreditCard}
              label="Credits"
              badge="$1.96 Low"
              isActive={false}
            />
          )}
          <SidebarItem href={ROUTES.SETTINGS} icon={Settings} label="Settings" isActive={false} collapsed={collapsed} />
          {!collapsed && (
            <div className="pt-1">
              <SidebarUserCard compact />
            </div>
          )}
        </div>
      </SidebarShell>

      <InstalledSkillsDialog open={skillsDialogOpen} onOpenChange={setSkillsDialogOpen} />
    </>
  );
}

// =============================================================================
// SETTINGS SIDEBAR
// =============================================================================
export function SettingsSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');

  const items = [
    { href: '/settings?tab=profile', icon: User, label: 'Profile', match: 'profile' },
    { href: '/settings?tab=account', icon: Shield, label: 'Account', match: 'account' },
    { href: '/settings?tab=notifications', icon: Bell, label: 'Notifications', match: 'notifications' },
    { href: '/settings?tab=appearance', icon: Palette, label: 'Appearance', match: 'appearance' },
    { href: '/settings?tab=openclaw', icon: MessageSquare, label: 'OpenClaw Chat', match: 'openclaw' },
    { href: '/settings?tab=data', icon: HardDrive, label: 'Data', match: 'data' },
    { href: ROUTES.CHANNELS, icon: Radio, label: 'Connected Channels', match: '' },
  ];

  return (
    <SidebarShell>
      <SidebarLogo />

      <nav className="flex-1 px-3 space-y-0.5">
        <SidebarSection label="Settings" />
        {items.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={
              (pathname === '/channels' && item.match === '') ||
              (pathname === '/settings' && (currentTab || 'profile') === item.match)
            }
          />
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <SidebarUserCard />
      </div>
    </SidebarShell>
  );
}

// =============================================================================
// INTEGRATION SIDEBAR — used for Integration Setup pages
// =============================================================================
export function IntegrationSidebar() {
  const pathname = usePathname();

  const items = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/marketplace?tab=agents', icon: Bot, label: 'Agents' },
    { href: ROUTES.MARKETPLACE, icon: Store, label: 'Marketplace' },
    { href: ROUTES.CHANNELS, icon: Radio, label: 'Integrations' },
    { href: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
  ];

  return (
    <SidebarShell>
      <SidebarLogo />

      <nav className="flex-1 px-3 space-y-0.5">
        {items.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={
              pathname.startsWith(item.href) ||
              (item.label === 'Integrations' && pathname.startsWith('/integrations'))
            }
          />
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <SidebarUserCard />
      </div>
    </SidebarShell>
  );
}

// =============================================================================
// AGENT DETAIL TOP NAV — special top nav for agent detail page
// =============================================================================
export function AgentDetailNav() {
  const pathname = usePathname();
  const { isAuthenticated, user, agent } = useAuth();
  const displayName = user?.displayName || user?.username || agent?.displayName || agent?.name || 'User';
  const avatarUrl = user?.avatarUrl || agent?.avatarUrl;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur shadow-nav">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link href={ROUTES.HOME} className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">m</span>
            </div>
            <span className="text-lg font-bold text-foreground">{APP_NAME}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href={ROUTES.MARKETPLACE}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith('/marketplace')
                  ? 'text-primary bg-mawadao-50 dark:bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Marketplace
            </Link>
            <Link
              href="/marketplace?tab=agents"
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              My Agents
            </Link>
            <Link
              href="/marketplace?tab=communities"
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Community
            </Link>
          </nav>
        </div>

        {/* Right: Search + Avatar */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Search className="h-5 w-5" />
          </Button>
          {isAuthenticated ? (
            <Link href={ROUTES.SETTINGS}>
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-mawadao-100 text-mawadao-700 text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Link href={ROUTES.LOGIN}>
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// =============================================================================
// Footer User Card (sidebar bottom)
// =============================================================================
function SidebarUserCard({ compact }: { compact?: boolean }) {
  const { user, agent, logout } = useAuth();
  const displayName = user?.displayName || user?.username || agent?.displayName || agent?.name || 'User';
  const avatarUrl = user?.avatarUrl || agent?.avatarUrl;
  const initials = displayName.slice(0, 2).toUpperCase();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-3 w-full rounded-lg transition-colors text-left',
          compact ? 'px-3 py-2' : 'px-2 py-2',
          'hover:bg-muted'
        )}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-mawadao-100 text-mawadao-700 text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!compact && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || 'Agent account'}</p>
          </div>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-border bg-card shadow-elevated p-1.5 animate-scale-in">
          <Link
            href={ROUTES.SETTINGS}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            Settings
          </Link>
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors w-full text-left text-red-600 dark:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sidebar Layout wrapper — sidebar + content area
// =============================================================================
export function SidebarLayout({
  sidebar,
  children,
  className,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebar}
      <main className={cn('flex-1 min-w-0 overflow-x-hidden overflow-y-auto', className)}>
        {children}
      </main>
    </div>
  );
}

// =============================================================================
// Mobile Sidebar Toggle (for responsive)
// =============================================================================
export function MobileSidebarOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-[280px] bg-card shadow-xl animate-slide-in-from-left">
        {children}
      </div>
    </div>
  );
}
