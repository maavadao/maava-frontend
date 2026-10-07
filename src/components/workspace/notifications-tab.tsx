'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import { api } from '@/lib/api';
import { Button, Skeleton } from '@/components/ui';
import {
  Bell,
  MessageSquare,
  ArrowBigUp,
  UserPlus,
  AtSign,
  Shield,
  Check,
  CheckCheck,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { Notification } from '@/types';

// Mock notifications for demo / fallback
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'reply',
    title: 'New reply to your comment',
    body: 'agent_x replied to your comment in "Introduction to AI Agents"',
    link: '/post/123#comment-456',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    actorName: 'agent_x',
  },
  {
    id: '2',
    type: 'upvote',
    title: 'Your post is getting popular!',
    body: 'Your post "Building Better AI" received 50 upvotes',
    link: '/post/124',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '3',
    type: 'follow',
    title: 'New follower',
    body: 'neural_bot started following you',
    link: '/u/neural_bot',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    actorName: 'neural_bot',
  },
  {
    id: '4',
    type: 'mention',
    title: 'You were mentioned',
    body: 'smart_agent mentioned you in a comment',
    link: '/post/125#comment-789',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    actorName: 'smart_agent',
  },
  {
    id: '5',
    type: 'mod_action',
    title: 'Moderator action',
    body: 'Your post was approved in m/showcase',
    link: '/post/126',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
];

const notificationIcons: Record<string, typeof Bell> = {
  reply: MessageSquare,
  mention: AtSign,
  upvote: ArrowBigUp,
  follow: UserPlus,
  post_reply: MessageSquare,
  mod_action: Shield,
};

const notificationIconColors: Record<string, string> = {
  reply: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40',
  mention: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40',
  upvote: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
  follow: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
  post_reply: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40',
  mod_action: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40',
};

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'reply', label: 'Replies' },
  { value: 'mention', label: 'Mentions' },
  { value: 'upvote', label: 'Upvotes' },
  { value: 'follow', label: 'Follows' },
];

export default function NotificationsTab() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // ---- FIX: api.getNotifications() returns { notifications, unreadCount } ----
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getNotifications();
      // API returns { notifications: Notification[], unreadCount: number }
      const items = (data as { notifications?: Notification[] })?.notifications ?? [];
      setNotifications(items.length > 0 ? items : mockNotifications);
    } catch {
      setNotifications(mockNotifications);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadNotifications();
    } else {
      setNotifications(mockNotifications);
      setIsLoading(false);
    }
  }, [isAuthenticated, loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !n.read;
    return n.type === activeFilter;
  });

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
    } catch {
      /* updated locally */
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
    try {
      await api.markAllNotificationsRead();
    } catch {
      /* updated locally */
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success('Notification removed');
    try {
      await api.deleteNotification(id);
    } catch {
      /* removed locally */
    }
  };

  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
          <Bell className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <h3 className="font-bold text-lg text-foreground mb-1">Login Required</h3>
        <p className="text-muted-foreground text-[14px] max-w-sm mb-6">
          Sign in to view your notifications.
        </p>
        <Link href="/auth/login">
          <Button className="rounded-xl h-10 px-6 text-[13px] font-semibold bg-primary hover:bg-primary/90">
            Log in
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Notifications</h1>
              {unreadCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50/80 border border-red-100/60 text-red-600 text-[11px] font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-[15px] text-muted-foreground">Stay updated on activity across your workspace.</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="gap-1.5 text-[13px] font-medium rounded-lg"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void loadNotifications()}
              className="h-9 w-9 rounded-lg"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
        className="mb-6"
      >
        <div className="flex items-center gap-1 p-1 bg-muted/80 rounded-xl w-fit overflow-x-auto scrollbar-hide">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200 whitespace-nowrap',
                activeFilter === tab.value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.value === 'unread' && unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Notifications list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/60 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
            >
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : filteredNotifications.length > 0 ? (
          <AnimatePresence>
            {filteredNotifications.map((notification, i) => {
              const Icon = notificationIcons[notification.type] || Bell;
              const colorClasses = notificationIconColors[notification.type] || 'text-muted-foreground bg-muted';

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(i * 0.04, 0.2),
                    ease: [0.32, 0.72, 0, 1],
                  }}
                  className={cn(
                    'group bg-card/70 backdrop-blur-sm rounded-2xl border shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-all duration-300 cursor-pointer overflow-hidden',
                    !notification.read
                      ? 'border-blue-200/60 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/20'
                      : 'border-border/60',
                  )}
                  onClick={() => {
                    if (notification.link) {
                      void markAsRead(notification.id);
                      window.location.href = notification.link;
                    }
                  }}
                >
                  <div className="p-5 flex items-start gap-4">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                        colorClasses,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-[14px] truncate',
                              !notification.read
                                ? 'font-semibold text-foreground'
                                : 'font-medium text-foreground/80',
                            )}
                          >
                            {notification.title}
                          </p>
                          <p className="text-[13px] text-muted-foreground line-clamp-1 mt-0.5">
                            {notification.body}
                          </p>
                        </div>
                        {!notification.read && (
                          <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-2 font-medium">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>

                    {/* Hover actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                      {!notification.read && (
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            void markAsRead(notification.id);
                          }}
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-muted-foreground hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteNotification(notification.id);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
              <Bell className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-bold text-lg text-foreground mb-1">
              {activeFilter === 'unread' ? "You're all caught up!" : 'No notifications'}
            </h3>
            <p className="text-muted-foreground text-[14px] max-w-sm">
              {activeFilter === 'unread'
                ? 'All notifications have been read.'
                : 'Nothing here yet. Activity will appear here as it happens.'}
            </p>
          </motion.div>
        )}
      </div>
    </>
  );
}
