"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { reasoningStyle } from "../lib/reasoningStyle";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const POLL_INTERVAL_MS = 4000;

type DecisionLog = {
  id: number;
  timestamp: string;
  customer_id: string;
  order_id: string;
  decision: "Approved" | "Denied" | "Manual Review";
  reason: string;
  message: string;
  reasoning: string[];
  guardrail_overridden: boolean;
};

function decisionBadge(decision: DecisionLog["decision"]) {
  if (decision === "Approved") {
    return "bg-emerald-100 text-emerald-800 border-emerald-300";
  }
  if (decision === "Denied") {
    return "bg-red-100 text-red-800 border-red-300";
  }
  return "bg-amber-100 text-amber-800 border-amber-300";
}

async function fetchSessionsData(): Promise<DecisionLog[]> {
  const res = await fetch(`${API_URL}/admin/sessions`);
  const data = await res.json();
  return data.sessions ?? [];
}

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<DecisionLog[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchSessionsData();
        if (!cancelled) {
          setSessions(data);
          setLastUpdated(new Date());
          setConnected(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleRefreshClick = async () => {
    setLoading(true);
    try {
      const data = await fetchSessionsData();
      setSessions(data);
      setLastUpdated(new Date());
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-100 p-4 text-black">
      <div className="bg-white rounded-xl shadow flex flex-col h-full overflow-hidden">

        <div className="border-b p-4 bg-slate-900 text-white flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-slate-300">
              Every refund decision the agent has made, across all sessions
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {lastUpdated && (
              <span className="text-xs text-slate-400">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleRefreshClick}
              disabled={loading}
              className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              Refresh
            </button>
            <Link href="/" className="text-sm text-slate-300 hover:text-white underline">
              ← Customer Chat
            </Link>
          </div>
        </div>

        {!connected && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm px-4 py-2">
            Can&apos;t reach the backend yet — retrying automatically every {POLL_INTERVAL_MS / 1000}s...
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {sessions.length === 0 ? (
            <p className="text-gray-500 text-sm">
              {connected ? "No refund decisions logged yet" : "Waiting for backend connection..."}
            </p>
          ) : (
            sessions.map((session) => {
              const isExpanded = expanded === session.id;
              return (
                <div
                  key={session.id}
                  className="border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : session.id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50"
                  >
                    <span className="text-xs text-slate-400 w-20 shrink-0">
                      {new Date(session.timestamp).toLocaleTimeString()}
                    </span>

                    <span className="text-sm font-mono shrink-0">
                      {session.customer_id} / {session.order_id}
                    </span>

                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${decisionBadge(
                        session.decision
                      )}`}
                    >
                      {session.decision}
                    </span>

                    {session.guardrail_overridden && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-400 bg-amber-50 text-amber-900 shrink-0">
                        guardrail override
                      </span>
                    )}

                    <span className="text-sm text-slate-600 truncate">
                      {session.reason}
                    </span>

                    <span className="ml-auto text-slate-400 shrink-0">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-slate-50 p-3 space-y-2">
                      {session.reasoning.map((line, idx) => {
                        const style = reasoningStyle(line);
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border-l-4 text-sm font-mono whitespace-pre-wrap ${style.color}`}
                          >
                            <span className="mr-2">{style.icon}</span>
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

        </div>
      </div>
    </div>
  );
}
