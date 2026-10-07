'use client';

import * as React from 'react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter,
  Button, Input, Textarea, Badge, Skeleton, Separator,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui';
import { useModels, useAgentFiles, useConfig } from '@/hooks';
import { configApi } from '@/lib/config-api';
import {
  Bot, Cpu, FileText, Save, Trash2,
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight,
  HelpCircle, Sparkles, User, Palette, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Model Selector — visual card-based
// ---------------------------------------------------------------------------

function ModelSelector({ currentModel, onSelect }: { currentModel?: string; onSelect: (id: string) => void }) {
  const { data: models, isLoading, error } = useModels();
  const [open, setOpen] = React.useState(false);

  if (isLoading) return <Skeleton className="h-9 w-full" />;
  if (error || !models || !Array.isArray(models)) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" /> Unable to load models
      </div>
    );
  }

  const selected = models.find((m) => m.id === currentModel || m.name === currentModel);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center justify-between w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm',
          'hover:bg-accent hover:text-accent-foreground transition-colors'
        )}>
        <span className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-medium">{selected?.name || currentModel || 'Choose a model'}</p>
            {selected?.provider && <p className="text-xs text-muted-foreground">{selected.provider}</p>}
          </div>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {models.map((model) => (
            <button key={model.id} type="button"
              onClick={() => { onSelect(model.id); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between',
                (model.id === currentModel || model.name === currentModel) && 'bg-accent'
              )}>
              <div>
                <p className="font-medium">{model.name}</p>
                {model.provider && <p className="text-xs text-muted-foreground">{model.provider}{model.contextLength ? ` · ${Math.round(model.contextLength / 1000)}K context` : ''}</p>}
              </div>
              {model.isDefault && <Badge variant="secondary" className="text-xs">default</Badge>}
            </button>
          ))}
          {models.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground text-center">No models available</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Files Manager — improved UX
// ---------------------------------------------------------------------------

function AgentFilesManager() {
  const { data: files, isLoading, error, mutate } = useAgentFiles();
  const [expandedFile, setExpandedFile] = React.useState<string | null>(null);
  const [fileContent, setFileContent] = React.useState('');
  const [loadingContent, setLoadingContent] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editDraft, setEditDraft] = React.useState('');
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);

  const loadFileContent = async (path: string) => {
    if (expandedFile === path) { setExpandedFile(null); return; }
    setLoadingContent(true);
    try {
      const result = await configApi.agentFilesGet(path);
      setFileContent(result.content);
      setEditDraft(result.content);
      setExpandedFile(path);
    } catch {
      setFileContent('// Error loading file');
      setEditDraft('');
      setExpandedFile(path);
    } finally { setLoadingContent(false); }
  };

  const saveFile = async (path: string) => {
    setSaving(true);
    try {
      await configApi.agentFilesSet(path, editDraft);
      setFileContent(editDraft);
      mutate();
    } catch (err) { console.error('Failed to save file:', err); }
    finally { setSaving(false); }
  };

  if (isLoading) return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (error || !files) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" /> Unable to load agent files</div>;
  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No agent files found.</p>
        <p className="text-xs text-muted-foreground mt-1">Files like system prompts and character cards will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {files.map((file) => (
        <div key={file.path} className="border rounded-lg overflow-hidden">
          <button type="button" onClick={() => loadFileContent(file.path)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left">
            {expandedFile === file.path ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <FileText className="h-4 w-4 text-primary/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate block">{file.name || file.path.split('/').pop()}</span>
              {file.path !== file.name && <span className="text-xs text-muted-foreground truncate block">{file.path}</span>}
            </div>
            {file.type && <Badge variant="secondary" className="text-xs shrink-0">{file.type}</Badge>}
          </button>
          {expandedFile === file.path && (
            <div className="border-t p-3 space-y-2.5 bg-muted/10">
              {loadingContent ? <Skeleton className="h-32 w-full" /> : (
                <>
                  <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)}
                    className="font-mono text-xs min-h-[150px] resize-y" spellCheck={false} />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditDraft(fileContent)} disabled={editDraft === fileContent}>Reset</Button>
                    <Button size="sm" onClick={() => saveFile(file.path)} disabled={editDraft === fileContent || saving} isLoading={saving}>
                      <Save className="h-3.5 w-3.5 mr-1" /> Save File
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Agent Params Component
// ---------------------------------------------------------------------------

export function AgentParams() {
  const { data: config, isLoading: configLoading, mutate: mutateConfig } = useConfig();
  const [selectedModel, setSelectedModel] = React.useState('');
  const [systemPrompt, setSystemPrompt] = React.useState('');
  const [agentName, setAgentName] = React.useState('');
  const [agentEmoji, setAgentEmoji] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveOk, setSaveOk] = React.useState(false);

  // Extract values from parsed config
  React.useEffect(() => {
    if (config?.parsed) {
      const p = config.parsed as Record<string, unknown>;
      const agent = p.agent as Record<string, unknown> | undefined;
      const agentsDefaults = (p.agents as Record<string, unknown>)?.defaults as Record<string, unknown> | undefined;
      const identity = agentsDefaults?.identity as Record<string, unknown> | undefined;

      // Model
      const model = agentsDefaults?.model ?? agent?.model ?? p.model;
      if (typeof model === 'string') setSelectedModel(model);

      // System prompt
      const sp = agentsDefaults?.systemPrompt ?? agent?.systemPrompt ?? p.systemPrompt;
      if (typeof sp === 'string') setSystemPrompt(sp);

      // Identity
      if (identity) {
        if (typeof identity.name === 'string') setAgentName(identity.name);
        if (typeof identity.emoji === 'string') setAgentEmoji(identity.emoji);
      }
    }
  }, [config]);

  const handleSaveParams = async () => {
    setSaving(true);
    setSaveOk(false);
    try {
      const patch: Record<string, unknown> = {
        agents: {
          defaults: {
            ...(selectedModel ? { model: selectedModel } : {}),
            ...(systemPrompt ? { systemPrompt } : {}),
            identity: {
              ...(agentName ? { name: agentName } : {}),
              ...(agentEmoji ? { emoji: agentEmoji } : {}),
            },
          },
        },
      };
      const hash = config?.hash ?? config?.baseHash;
      await configApi.configPatch(patch, hash);
      mutateConfig();
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (err) {
      console.error('Failed to save params:', err);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">

      {/* Identity & Personality */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Identity & Personality</CardTitle>
              <CardDescription>Define who your agent is — its name, appearance, and personality.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Agent Name</label>
              <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="My Assistant" />
              <p className="text-xs text-muted-foreground">The name shown in conversations</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Agent Emoji</label>
              <Input value={agentEmoji} onChange={(e) => setAgentEmoji(e.target.value)} placeholder="🤖" className="w-24" />
              <p className="text-xs text-muted-foreground">Displayed alongside messages</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-medium">System Prompt</label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px]">
                    <p className="text-xs">The system prompt defines your agent&apos;s personality, tone, knowledge boundaries, and behavioral rules. It&apos;s sent to the AI model as the first message in every conversation.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful AI assistant. You are friendly, concise, and knowledgeable..."
              className="min-h-[160px] resize-y" rows={6} />
            <p className="text-xs text-muted-foreground">
              This is the most important setting — it shapes every response your agent gives. Be specific about tone, format, and expertise.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>AI Model</CardTitle>
              <CardDescription>Choose which language model powers your agent&apos;s responses.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ModelSelector currentModel={selectedModel} onSelect={setSelectedModel} />
          <p className="text-xs text-muted-foreground">
            Different models have different strengths — GPT-4 is great for reasoning, Claude excels at writing, and smaller models are faster and cheaper.
          </p>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center justify-between">
        <div>
          {saveOk && (
            <span className="flex items-center gap-1.5 text-sm text-green-500">
              <CheckCircle2 className="h-4 w-4" /> Settings saved successfully
            </span>
          )}
        </div>
        <Button onClick={handleSaveParams} disabled={saving} isLoading={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          Save Agent Settings
        </Button>
      </div>

      {/* Agent Files */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Agent Files</CardTitle>
              <CardDescription>View and edit configuration files, prompts, and scripts used by your agent.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AgentFilesManager />
        </CardContent>
      </Card>
    </div>
  );
}
