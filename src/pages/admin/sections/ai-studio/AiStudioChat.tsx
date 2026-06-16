import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AiAssetKind, AiAssetPayload, ChatMsg } from "./types";

interface Props {
  messages: ChatMsg[];
  setMessages: (m: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => void;
  onAsset: (asset: AiAssetPayload) => void;
  kind: AiAssetKind;
  targetLlm: string;
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function AiStudioChat({ messages, setMessages, onAsset, kind, targetLlm }: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMsg = { id: genId(), role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-studio-chat", {
        body: {
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          kind,
          targetLlm,
        },
      });

      if (error) {
        toast.error("Chat error", { description: error.message });
        setSending(false);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        setSending(false);
        return;
      }

      const assistantMsg: ChatMsg = {
        id: genId(),
        role: "assistant",
        content: data?.reply || (data?.asset ? "_Asset updated in preview pane._" : ""),
        asset: data?.asset ?? null,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data?.asset) {
        onAsset(data.asset);
      }
    } catch (err: any) {
      toast.error("Network error", { description: err?.message });
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Describe what you want to generate.</p>
              <p className="text-xs mt-1">
                E.g. "Create a Claude skill for tailoring resumes to a job description."
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
                {m.asset && (
                  <p className="text-xs opacity-70 mt-1">
                    ✓ Updated preview ({m.asset.kind})
                  </p>
                )}
              </div>
              {m.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating…
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-3 flex gap-2 items-end">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask the AI to generate or refine an asset… (Enter to send, Shift+Enter for newline)"
          rows={2}
          className="resize-none"
          disabled={sending}
        />
        <Button onClick={send} disabled={sending || !input.trim()} size="icon">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
