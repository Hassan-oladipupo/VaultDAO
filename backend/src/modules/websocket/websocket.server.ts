import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import { createLogger } from "../../shared/logging/logger.js";
import type { ContractEvent } from "../events/events.types.js";

const logger = createLogger("websocket-server");

interface ClientSubscription {
  connectionId: string;
  eventTypes?: string[];
  proposalId?: string;
  /** room IDs this connection has joined (e.g. "proposal:123", "contract:ABC") */
  rooms: Set<string>;
}

export class EventWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  /** room → set of WebSocket connections */
  private rooms: Map<string, Set<WebSocket>> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.init();
  }

  // ---------------------------------------------------------------------------
  // Room management
  // ---------------------------------------------------------------------------

  joinRoom(connectionId: string, roomId: string): boolean {
    const ws = this.findWs(connectionId);
    if (!ws) return false;

    const sub = this.clients.get(ws)!;
    if (sub.rooms.has(roomId)) return false;

    sub.rooms.add(roomId);
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Set());
    this.rooms.get(roomId)!.add(ws);
    logger.info("joined room", { connectionId, roomId });
    return true;
  }

  leaveRoom(connectionId: string, roomId: string): boolean {
    const ws = this.findWs(connectionId);
    if (!ws) return false;

    const sub = this.clients.get(ws)!;
    if (!sub.rooms.has(roomId)) return false;

    sub.rooms.delete(roomId);
    this.rooms.get(roomId)?.delete(ws);
    if (this.rooms.get(roomId)?.size === 0) this.rooms.delete(roomId);
    logger.info("left room", { connectionId, roomId });
    return true;
  }

  broadcastToRoom(roomId: string, event: unknown): number {
    const members = this.rooms.get(roomId);
    if (!members || members.size === 0) return 0;

    let message: string;
    try {
      message = JSON.stringify({
        type: "room_event",
        room: roomId,
        payload: event,
      });
    } catch {
      logger.warn("failed to serialize room event", { roomId });
      return 0;
    }

    let count = 0;
    for (const ws of members) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      try {
        ws.send(message);
        count++;
      } catch (err) {
        const sub = this.clients.get(ws);
        logger.warn("failed to send room event", {
          connectionId: sub?.connectionId,
          roomId,
          err,
        });
      }
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  private init() {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      // Auth via query param: ?token=<API_KEY>
      const url = new URL(req.url ?? "/", "http://localhost");
      const token = url.searchParams.get("token");
      const apiKey = process.env["API_KEY"];

      if (apiKey && token !== apiKey) {
        ws.close(4401, "Unauthorized");
        logger.warn("rejected unauthenticated websocket connection");
        return;
      }

      const connectionId = randomUUID();
      logger.info("client connected", { connectionId });

      (ws as any).isAlive = true;
      this.clients.set(ws, { connectionId, rooms: new Set() });

      ws.on("pong", () => {
        (ws as any).isAlive = true;
      });

      ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === "subscribe") {
            this.handleSubscription(ws, message, connectionId);
          } else if (message.type === "join") {
            const roomId: string = message.room;
            if (roomId) {
              this.joinRoom(connectionId, roomId);
              ws.send(JSON.stringify({ type: "joined", room: roomId }));
            }
          } else if (message.type === "leave") {
            const roomId: string = message.room;
            if (roomId) {
              this.leaveRoom(connectionId, roomId);
              ws.send(JSON.stringify({ type: "left", room: roomId }));
            }
          }
        } catch (error) {
          logger.error("failed to parse client message", {
            connectionId,
            error,
          });
        }
      });

      ws.on("close", () => {
        this.cleanupConnection(ws, connectionId);
      });

      ws.on("error", (error: Error) => {
        logger.error("websocket error", { connectionId, error });
        this.cleanupConnection(ws, connectionId);
      });
    });

    // Heartbeat: terminate connections that did not respond to the last ping
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: any) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on("close", () => {
      clearInterval(interval);
    });
  }

  private cleanupConnection(ws: WebSocket, connectionId: string): void {
    const sub = this.clients.get(ws);
    if (!sub) return;

    // Remove from all rooms
    for (const roomId of sub.rooms) {
      this.rooms.get(roomId)?.delete(ws);
      if (this.rooms.get(roomId)?.size === 0) this.rooms.delete(roomId);
    }

    this.clients.delete(ws);
    logger.info("client disconnected", {
      connectionId: sub.connectionId ?? connectionId,
    });
  }

  private handleSubscription(
    ws: WebSocket,
    message: any,
    connectionId: string,
  ) {
    const topics: string[] | undefined = Array.isArray(message.topics)
      ? message.topics
      : Array.isArray(message.payload?.eventTypes)
        ? message.payload.eventTypes
        : undefined;

    const proposalId: string | undefined =
      message.proposalId ?? message.payload?.proposalId;

    const sub: ClientSubscription = {
      connectionId,
      eventTypes: topics,
      proposalId,
      rooms: this.clients.get(ws)?.rooms ?? new Set(),
    };

    logger.info("client subscribed", { connectionId, topics, proposalId });
    this.clients.set(ws, sub);
    ws.send(JSON.stringify({ type: "subscribed", topics, proposalId }));
  }

  private findWs(connectionId: string): WebSocket | undefined {
    for (const [ws, sub] of this.clients) {
      if (sub.connectionId === connectionId) return ws;
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Legacy broadcast (contract events)
  // ---------------------------------------------------------------------------

  public broadcastEvent(event: ContractEvent) {
    const eventType = event.topic[0];
    const proposalId =
      event.topic[1] || (event.value && (event.value as any).proposal_id);

    let message: string;
    try {
      message = JSON.stringify({ type: "contract_event", payload: event });
    } catch (error) {
      logger.warn("failed to serialize event for broadcast", {
        eventId: event.id,
        error,
      });
      return;
    }

    let broadcastCount = 0;
    this.clients.forEach((sub, ws) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const matchesEventType =
        !sub.eventTypes || sub.eventTypes.includes(eventType);
      const matchesProposalId =
        !sub.proposalId || sub.proposalId === proposalId;

      if (matchesEventType && matchesProposalId) {
        try {
          ws.send(message);
          broadcastCount++;
        } catch (error) {
          logger.warn("failed to send event to client", {
            connectionId: sub.connectionId,
            eventId: event.id,
            error,
          });
        }
      }
    });

    if (broadcastCount > 0) {
      logger.info(`broadcasted event ${event.id} to ${broadcastCount} clients`);
    }
  }

  public stop() {
    this.wss.close();
  }

  public getActiveConnectionCount(): number {
    return this.clients.size;
  }
}
