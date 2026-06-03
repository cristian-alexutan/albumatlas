"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/app/components/auth-provider";
import { API_BASE } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnlineUser {
  userId:   string;
  username: string;
}

interface ChatMessage {
  id?:               string;
  senderId:          string;
  senderUsername:    string;
  recipientId:       string;
  recipientUsername?: string;
  text:              string;
  createdAt:         string | Date;
}

type S2CMessage =
  | { type: "online";  users: OnlineUser[] }
  | { type: "message"; id?: string; senderId: string; senderUsername: string; recipientId: string; recipientUsername?: string; text: string; createdAt: string }
  | { type: "history"; withUserId: string; messages: ChatMessage[] }
  | { type: "pong" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWsBase(): string {
  const base = API_BASE;
  if (base.startsWith("https://")) return base.replace(/^https/, "wss");
  if (base.startsWith("http://"))  return base.replace(/^http/, "ws");
  if (typeof window === "undefined") return "ws://localhost:4000";
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:4000`;
}

function formatTime(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sortByTime(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function dedupeMessages(list: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const result: ChatMessage[] = [];
  for (const msg of list) {
    const key = msg.id ?? `${msg.senderId}|${msg.recipientId}|${String(msg.createdAt)}|${msg.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(msg);
  }
  return result;
}

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  return sortByTime(dedupeMessages([...prev, ...incoming]));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatWidget() {
  const { currentUser } = useAuth();

  const [isOpen,        setIsOpen       ] = useState(false);
  const [activeUserId,  setActiveUserId ] = useState<string | null>(null);
  const [onlineUsers,   setOnlineUsers  ] = useState<OnlineUser[]>([]);
  const [recentUsers,   setRecentUsers  ] = useState<OnlineUser[]>([]);
  const [searchTerm,    setSearchTerm   ] = useState("");
  const [searchResults, setSearchResults] = useState<OnlineUser[]>([]);
  const [isSearching,   setIsSearching  ] = useState(false);
  const [messages,      setMessages     ] = useState<Record<string, ChatMessage[]>>({});
  const [inputText,     setInputText    ] = useState("");
  const [isConnected,   setIsConnected  ] = useState(false);

  const wsRef       = useRef<WebSocket | null>(null);
  const bottomRef   = useRef<HTMLDivElement | null>(null);
  const reconnectT  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upsertRecent = useCallback((userId: string, username?: string) => {
    setRecentUsers((prev) => {
      const existing = prev.find((u) => u.userId === userId);
      const nextUser = { userId, username: username ?? existing?.username ?? userId };
      return [nextUser, ...prev.filter((u) => u.userId !== userId)].slice(0, 20);
    });
  }, []);

  const getUserById = useCallback(
    (userId: string | null) => {
      if (!userId) return null;
      return (
        onlineUsers.find((u) => u.userId === userId) ??
        recentUsers.find((u) => u.userId === userId) ??
        searchResults.find((u) => u.userId === userId)
      );
    },
    [onlineUsers, recentUsers, searchResults],
  );

  // ── WebSocket connection ───────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!currentUser) return;
    // Guard: don't open a second simultaneous connection
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;

    const ws = new WebSocket(`${getWsBase()}/chat`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "auth", userId: currentUser.id, username: currentUser.username }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as S2CMessage;

      if (msg.type === "online") {
        setOnlineUsers(msg.users.filter((u) => u.userId !== currentUser.id));
      }

      if (msg.type === "message") {
        const otherId = msg.senderId === currentUser.id ? msg.recipientId : msg.senderId;
        if (msg.senderId !== currentUser.id) {
          upsertRecent(msg.senderId, msg.senderUsername);
        } else {
          upsertRecent(msg.recipientId, msg.recipientUsername);
        }
        setMessages((prev) => ({
          ...prev,
          [otherId]: mergeMessages(prev[otherId] ?? [], [msg]),
        }));
      }

      if (msg.type === "history") {
        // Merge history with any live messages already received; keep sorted
        setMessages((prev) => ({
          ...prev,
          [msg.withUserId]: mergeMessages(prev[msg.withUserId] ?? [], msg.messages),
        }));
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectT.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [currentUser, upsertRecent]);

  // When currentUser changes (login / logout / account switch):
  //   • cancel any pending reconnect
  //   • close the old socket WITHOUT triggering auto-reconnect
  //     (critical: prevents stale identity being reused on the server)
  //   • clear all chat state
  //   • if a user is now logged in, open a fresh connection
  useEffect(() => {
    if (reconnectT.current) {
      clearTimeout(reconnectT.current);
      reconnectT.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null; // suppress reconnect
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setOnlineUsers([]);
    setRecentUsers([]);
    setSearchResults([]);
    setMessages({});
    setActiveUserId(null);

    if (currentUser) {
      connect();
    }

    return () => {
      if (reconnectT.current) clearTimeout(reconnectT.current);
    };
  }, [currentUser, connect]);

  // Auto-scroll to bottom when active messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeUserId]);

  // ── Fetch recent users from server ─────────────────────────────────────────

  useEffect(() => {
    if (!currentUser || !isOpen) return;
    const controller = new AbortController();

    fetch(`${API_BASE}/api/chat/partners`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data: { users?: { id: string; username: string }[] }) => {
        const users = (data.users ?? [])
          .filter((u) => u.id !== currentUser.id)
          .map((u) => ({ userId: u.id, username: u.username }));
        setRecentUsers(users);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [currentUser, isOpen]);

  // ── User search ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser || !isOpen) return;
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsSearching(true);
      fetch(`${API_BASE}/api/users?search=${encodeURIComponent(term)}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : { users: [] }))
        .then((data: { users?: { id: string; username: string }[] }) => {
          const users = (data.users ?? [])
            .filter((u) => u.id !== currentUser.id)
            .map((u) => ({ userId: u.id, username: u.username }));
          setSearchResults(users);
        })
        .catch(() => undefined)
        .finally(() => setIsSearching(false));
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [currentUser, isOpen, searchTerm]);

  // ── Actions ────────────────────────────────────────────────────────────────

  function openConversation(userId: string) {
    setActiveUserId(userId);
    const knownUser = getUserById(userId);
    if (knownUser) upsertRecent(knownUser.userId, knownUser.username);

    // Always request fresh history when opening a conversation.
    // dedupeMessages + sortByTime handle any overlap with live messages.
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "history", withUserId: userId }));
    }
  }

  function sendMessage() {
    const text = inputText.trim();
    if (!text || !activeUserId || !wsRef.current || !currentUser) return;
    wsRef.current.send(JSON.stringify({
      type:              "send",
      recipientId:       activeUserId,
      recipientUsername: activeUser?.username,
      text,
    }));
    setInputText("");
  }

  // ── Don't render when not logged in ───────────────────────────────────────
  if (!currentUser) return null;

  const activeMessages = activeUserId ? (messages[activeUserId] ?? []) : [];
  const activeUser     = getUserById(activeUserId);
  const recentList     = recentUsers.filter((u) => u.userId !== currentUser.id);
  const onlineList     = onlineUsers;
  const resultList     = searchResults;

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="flex h-[480px] w-[680px] flex-col overflow-hidden border border-zinc-300 bg-white shadow-xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-700 px-4 py-2.5">
            <span className="text-sm font-semibold text-zinc-100">
              {activeUserId && activeUser
                ? `Chat with ${activeUser.username}`
                : "Chat"}
            </span>
            <div className="flex gap-3">
              {activeUserId && (
                <button
                  onClick={() => setActiveUserId(null)}
                  className="text-xs text-zinc-300 hover:text-white"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-300 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* ── Sidebar ───────────────────────────────────────────────── */}
            <div className="w-56 shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50">
              <div className="px-3 py-2">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search users..."
                  className="w-full border border-zinc-300 px-2 py-1 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              {searchTerm.trim().length > 0 ? (
                <>
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Results
                  </p>
                  {isSearching && (
                    <p className="px-3 py-2 text-xs text-zinc-400">Searching…</p>
                  )}
                  {!isSearching && resultList.length === 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-400">No users found</p>
                  )}
                  {resultList.map((u) => (
                    <button
                      key={u.userId}
                      onClick={() => openConversation(u.userId)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 ${
                        activeUserId === u.userId ? "bg-zinc-200 font-medium" : ""
                      }`}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-zinc-300" />
                      <span className="truncate text-zinc-700">{u.username}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Recent
                  </p>
                  {recentList.length === 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-400">No recent chats</p>
                  )}
                  {recentList.map((u) => {
                    const isOnline = onlineList.some((o) => o.userId === u.userId);
                    return (
                      <button
                        key={u.userId}
                        onClick={() => openConversation(u.userId)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 ${
                          activeUserId === u.userId ? "bg-zinc-200 font-medium" : ""
                        }`}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            isOnline ? "bg-green-500" : "bg-zinc-300"
                          }`}
                        />
                        <span className="truncate text-zinc-700">{u.username}</span>
                      </button>
                    );
                  })}

                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Online ({onlineList.length})
                  </p>
                  {onlineList.length === 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-400">No one else online</p>
                  )}
                  {onlineList.map((u) => (
                    <button
                      key={u.userId}
                      onClick={() => openConversation(u.userId)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 ${
                        activeUserId === u.userId ? "bg-zinc-200 font-medium" : ""
                      }`}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                      <span className="truncate text-zinc-700">{u.username}</span>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* ── Chat area ────────────────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {!activeUserId ? (
                <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
                  Select a user to start chatting
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {activeMessages.length === 0 && (
                      <p className="text-xs text-zinc-400 text-center mt-4">
                        No messages yet. Say hello!
                      </p>
                    )}
                    {activeMessages.map((msg, i) => {
                      const isMine = msg.senderId === currentUser.id;
                      return (
                        <div
                          key={msg.id ?? i}
                          className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                        >
                          {!isMine && (
                            <span className="mb-0.5 text-[10px] font-medium text-zinc-500">
                              {msg.senderUsername}
                            </span>
                          )}
                          <div
                            className={`max-w-[75%] rounded px-3 py-1.5 text-sm ${
                              isMine
                                ? "bg-zinc-700 text-zinc-100"
                                : "bg-zinc-100 text-zinc-800 border border-zinc-200"
                            }`}
                          >
                            {msg.text}
                          </div>
                          <span className="mt-0.5 text-[10px] text-zinc-400">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
                  <div className="border-t border-zinc-200 flex gap-2 p-2">
                    <input
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())
                      }
                      placeholder={`Message ${activeUser?.username ?? "user"}…`}
                      className="flex-1 border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!inputText.trim()}
                      className="bg-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toggle button ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-2 bg-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-100 shadow-lg hover:bg-zinc-800"
      >
        <span>Chat</span>
        {isConnected && onlineUsers.length > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold">
            {onlineUsers.length}
          </span>
        )}
      </button>
    </div>
  );
}
