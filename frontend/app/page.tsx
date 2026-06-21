"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { reasoningStyle } from "./lib/reasoningStyle";
import VoiceCall from "./components/VoiceCall";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type StreamEvent =
  | { type: "status"; text: string }
  | { type: "reasoning"; lines: string[] }
  | { type: "token"; text: string }
  | { type: "error"; text: string }
  | { type: "done" };

const VOICE_POLL_INTERVAL_MS = 3000;

async function fetchLatestDecision(): Promise<{ id: number; reasoning: string[] } | null> {
  const res = await fetch(`${API_URL}/admin/sessions?limit=1`);
  const data = await res.json();
  return data.sessions?.[0] ?? null;
}

function Avatar({ role }: { role: Message["role"] }) {
  const isUser = role === "user";
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        isUser ? "bg-blue-500 text-white" : "bg-slate-700 text-white"
      }`}
    >
      {isUser ? "Me" : "AI"}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 px-2 py-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reasoning, setReasoning] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [voiceCallActive, setVoiceCallActive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastDecisionIdRef = useRef<number | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    let cancelled = false;

    async function checkForNewDecision() {
      try {
        const latest = await fetchLatestDecision();
        if (cancelled || !latest) return;

        if (lastDecisionIdRef.current === null) {
          lastDecisionIdRef.current = latest.id;
          return;
        }

        if (latest.id !== lastDecisionIdRef.current) {
          lastDecisionIdRef.current = latest.id;
          setReasoning(latest.reasoning);
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (!voiceCallActive) return;

    checkForNewDecision();
    const interval = setInterval(checkForNewDecision, VOICE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [voiceCallActive]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setStatusText(null);
    setLoading(true);

    const baseLength = nextMessages.length;

    const handleEvent = (event: StreamEvent) => {
      if (event.type === "status") {
        setStatusText(event.text);
      } else if (event.type === "reasoning") {
        setReasoning(event.lines);
      } else if (event.type === "token") {
        setStatusText(null);
        setMessages((prev) => {
          if (prev.length === baseLength) {
            return [...prev, { role: "assistant", content: event.text }];
          }
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + event.text,
          };
          return updated;
        });
      } else if (event.type === "error") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: event.text },
        ]);
      }
    };

    try {
      const res = await fetch(`${API_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          handleEvent(JSON.parse(line) as StreamEvent);
        }
      }

      if (buffer.trim()) {
        handleEvent(JSON.parse(buffer) as StreamEvent);
      }
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't reach the refund desk. Please try again.",
        },
      ]);
    } finally {
      setStatusText(null);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-screen bg-slate-100 p-4 text-black">
      <div className="grid grid-cols-2 gap-4 h-full">

        {/* CHAT PANEL */}

        <div className="bg-white rounded-xl shadow flex flex-col overflow-hidden">

          <div className="border-b p-4 bg-slate-900 text-white flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">
                Refund Assistant
              </h1>

              <p className="text-sm text-slate-300">
                Try: &quot;Hi, I&apos;d like a refund for order ORD001, my customer ID is C001&quot;
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <VoiceCall onActiveChange={setVoiceCallActive} />
              <Link
                href="/admin"
                className="text-sm text-slate-300 hover:text-white underline"
              >
                Admin →
              </Link>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {messages.length === 0 && (
              <div className="text-gray-500 text-sm">
                Start a conversation with the AI agent.
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-end gap-2 ${
                  msg.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                {msg.role === "assistant" && <Avatar role={msg.role} />}

                <div
                  className={`max-w-md rounded-2xl px-4 py-2.5 shadow-sm ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-900 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>

                {msg.role === "user" && <Avatar role={msg.role} />}
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-end gap-2 justify-start">
                <Avatar role="assistant" />
                <div className="rounded-2xl rounded-bl-sm bg-slate-100">
                  {statusText ? (
                    <span className="px-3 py-2 text-sm text-slate-500 inline-block">
                      {statusText}
                    </span>
                  ) : (
                    <TypingIndicator />
                  )}
                </div>
              </div>
            )}

            <div ref={scrollRef} />

          </div>

          <div className="border-t p-4 flex gap-2">

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1 border rounded-lg px-3 py-2 disabled:opacity-50"
              placeholder="Type your message..."
            />

            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Send
            </button>

          </div>
        </div>

        {/* REASONING PANEL */}

        <div className="bg-white rounded-xl shadow flex flex-col overflow-hidden">

          <div className="border-b p-4 bg-slate-900 text-white">
            <h1 className="text-xl font-bold">
              Agent Activity
            </h1>
            <p className="text-sm text-slate-300">
              Live trace of tool calls and decisions
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">

            {reasoning.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No activity yet
              </p>
            ) : (
              reasoning.map((log, idx) => {
                const style = reasoningStyle(log);
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border-l-4 text-sm font-mono whitespace-pre-wrap ${style.color}`}
                  >
                    <span className="mr-2">{style.icon}</span>
                    {log}
                  </div>
                );
              })
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
