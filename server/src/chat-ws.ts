import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { getChatHistory, saveMessage } from "./mongodb.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnlineUser {
  ws:       WebSocket;
  userId:   string;
  username: string;
}

// Client → Server messages
type C2SMessage =
  | { type: "auth";    userId: string; username: string }
  | { type: "send";    recipientId: string; recipientUsername?: string; text: string }
  | { type: "history"; withUserId: string }
  | { type: "ping" };

// ── State ─────────────────────────────────────────────────────────────────────

const online = new Map<string, OnlineUser>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastOnlineList() {
  const users = [...online.values()].map(({ userId, username }) => ({ userId, username }));
  const payload = JSON.stringify({ type: "online", users });
  for (const { ws } of online.values()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

// ── Server ────────────────────────────────────────────────────────────────────

export function createChatWebSocketServer() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    let me: OnlineUser | null = null;

    ws.on("message", async (raw) => {
      let msg: C2SMessage;
      try {
        msg = JSON.parse(raw.toString()) as C2SMessage;
      } catch {
        return;
      }

      // ── auth ──────────────────────────────────────────────────────────────
      if (msg.type === "auth") {
        const { userId, username } = msg;
        if (!userId || !username) return;

        me = { ws, userId, username };
        online.set(userId, me);
        broadcastOnlineList();
        return;
      }

      if (!me) return;

      // ── send ──────────────────────────────────────────────────────────────
      if (msg.type === "send") {
        const { recipientId, recipientUsername, text } = msg;
        if (!recipientId || !text?.trim()) return;

        const chatMsg = {
          id:             randomUUID(),
          senderId:       me.userId,
          senderUsername: me.username,
          recipientId,
          recipientUsername,
          text:           text.trim(),
          createdAt:      new Date(),
        };

        saveMessage(chatMsg).catch((err) =>
          console.error("MongoDB save error:", err),
        );

        send(ws, { type: "message", ...chatMsg });

        const recipient = online.get(recipientId);
        if (recipient) {
          send(recipient.ws, { type: "message", ...chatMsg });
        }
        return;
      }

      // ── history ───────────────────────────────────────────────────────────
      if (msg.type === "history") {
        const { withUserId } = msg;
        if (!withUserId) return;

        try {
          const messages = await getChatHistory(me.userId, withUserId);
          send(ws, { type: "history", withUserId, messages });
        } catch (err) {
          console.error("MongoDB history error:", err);
          send(ws, { type: "history", withUserId, messages: [] });
        }
        return;
      }

      // ── ping ──────────────────────────────────────────────────────────────
      if (msg.type === "ping") {
        send(ws, { type: "pong" });
      }
    });

    ws.on("close", () => {
      if (me) {
        online.delete(me.userId);
        broadcastOnlineList();
      }
    });
  });

  return wss;
}

export function attachChatWebSocketServer(server: Server) {
  const wss = createChatWebSocketServer();

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== "/chat") return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });
}
