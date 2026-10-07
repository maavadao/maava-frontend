import * as React from "react";
import type { UIMessage } from "ai";
import { isStreamStatusSSE } from "@/lib/feature-flags";

type SetMessages = React.Dispatch<React.SetStateAction<UIMessage[]>>;

interface StreamStatusData {
  isStreaming: boolean;
  content?: string | null;
}

function applyContent(setMessages: SetMessages, content: string | null | undefined) {
  if (!content) return;
  setMessages((prev) => {
    const updated = [...prev];
    const lastIdx = updated.length - 1;
    if (lastIdx < 0 || updated[lastIdx].role !== "assistant") return prev;
    updated[lastIdx] = {
      ...updated[lastIdx],
      parts: [{ type: "text" as const, text: content }],
    };
    return updated;
  });
}

function useSSEStreamRecovery(
  conversationId: string | undefined,
  setMessages: SetMessages,
  isStreamRecovery: boolean,
) {
  const [recovering, setRecovering] = React.useState(isStreamRecovery);

  React.useEffect(() => {
    if (!recovering || !conversationId) return;

    const evtSource = new EventSource(
      `/api/conversations/${encodeURIComponent(conversationId)}/stream-events`,
    );

    function handleStatus(e: MessageEvent) {
      try {
        const data: StreamStatusData = JSON.parse(e.data);
        applyContent(setMessages, data.content);
        if (!data.isStreaming) setRecovering(false);
      } catch { /* ignore */ }
    }

    function handleDone(e: MessageEvent) {
      try {
        const data: StreamStatusData = JSON.parse(e.data);
        applyContent(setMessages, data.content);
      } catch { /* ignore */ }
      setRecovering(false);
    }

    function handleError() {
      evtSource.close();
      setRecovering(false);
    }

    evtSource.addEventListener("status", handleStatus);
    evtSource.addEventListener("done", handleDone);
    evtSource.addEventListener("timeout", handleDone);
    evtSource.addEventListener("error", handleError);

    return () => { evtSource.close(); };
  }, [recovering, conversationId, setMessages]);

  return { recovering, setRecovering };
}

function usePollStreamRecovery(
  conversationId: string | undefined,
  setMessages: SetMessages,
  isStreamRecovery: boolean,
) {
  const [recovering, setRecovering] = React.useState(isStreamRecovery);

  React.useEffect(() => {
    if (!recovering || !conversationId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/stream-status`);
        if (!res.ok || cancelled) return;
        const data: StreamStatusData = await res.json();
        if (cancelled) return;
        applyContent(setMessages, data.content);
        if (!data.isStreaming) setRecovering(false);
      } catch { /* retry next interval */ }
    };

    poll();
    const timer = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [recovering, conversationId, setMessages]);

  return { recovering, setRecovering };
}

export function useStreamRecovery(
  conversationId: string | undefined,
  setMessages: SetMessages,
  isStreamRecovery: boolean,
) {
  if (isStreamStatusSSE()) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSSEStreamRecovery(conversationId, setMessages, isStreamRecovery);
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return usePollStreamRecovery(conversationId, setMessages, isStreamRecovery);
}
