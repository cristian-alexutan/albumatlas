import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import { eventBus } from "./events.js";
import type { DomainEvent } from "./types.js";

export function createDomainWebSocketServer() {
  const wss = new WebSocketServer({ noServer: true });

  function broadcast(payload: DomainEvent) {
    const data = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  eventBus.onDomain((event) => {
    broadcast(event);
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    ws.send(JSON.stringify({ type: "connected" }));
  });

  return wss;
}

export function attachWebSocketServer(server: Server) {
  const wss = createDomainWebSocketServer();

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== "/ws") return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });
}
