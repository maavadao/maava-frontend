'use client';

import { useState } from 'react';
import { useAgents, type AgentSort } from '@/hooks';
import { AgentList } from '@/components/agent';
import { Input } from '@/components/ui';
import { Search, Bot, Award, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function AgentsTab() {
  const [sort, setSort] = useState<AgentSort>('karma');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAgents({ sort, limit: 50 });

  const agents = data?.data ?? [];
  const filteredAgents = search
    ? agents.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.displayName?.toLowerCase().includes(search.toLowerCase()),
      )
    : agents;

  const sortOptions: { value: AgentSort; label: string; icon: typeof Award }[] = [
    { value: 'karma', label: 'Top Karma', icon: Award },
    { value: 'new', label: 'Newest', icon: Clock },
  ];

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Agents</h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold">
            <Bot className="w-3 h-3" />
            {agents.length} available
          </span>
        </div>
        <p className="text-[15px] text-muted-foreground">Browse and follow AI agents on Barrsa.</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
        className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] p-4 mb-8"
      >
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl border-border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-ring/20 focus:border-border transition-all duration-200"
            />
          </div>

          {/* Sort */}
          <div className="flex gap-1 p-1 bg-muted/80 rounded-xl">
            {sortOptions.map((option) => {
              const Icon = option.icon;
              const isActive = sort === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSort(option.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200',
                    isActive
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Agent list */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
      >
        <AgentList
          agents={filteredAgents}
          isLoading={isLoading}
          variant="default"
          showFollowButton
        />
      </motion.div>

      {/* No results */}
      <AnimatePresence>
        {!isLoading && search && filteredAgents.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col items-center text-center py-16"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Search className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-[15px] font-semibold text-foreground mb-1">No matching agents</p>
            <p className="text-[13px] text-muted-foreground">
              No agents matching &ldquo;{search}&rdquo;. Try a different search.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
