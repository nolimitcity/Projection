import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { createRouter } from "./http/routes.js";
import { attachActor, hasValidCsrfToken, resolveSessionActorFromCookie } from "./http/auth.js";
import { errorHandler } from "./http/problem-details.js";
import { SqliteStore } from "./domain/store.js";
import { forbidden } from "./domain/errors.js";
import { listLiveEdits, subscribeLiveEditEvents, sweepExpiredLiveEdits } from "./http/live-edit-hub.js";

const port = Number(process.env.PORT ?? 3000);
const app = express();
const store = new SqliteStore();

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const MAX_REQUESTS_PER_WINDOW = Number(process.env.RATE_LIMIT_MAX ?? 240);
const MAX_WRITES_PER_WINDOW = Number(process.env.RATE_LIMIT_WRITES_MAX ?? 120);
const requestBuckets = new Map<string, { windowStart: number; total: number; writes: number }>();

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  // Google Sign-In uses origin context for client-origin validation.
  // Keep paths private while still sending origin on cross-origin requests.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  // sha256 hash covers the inline theme-detection script shared by index.html and login.html.
  // If that script ever changes, regenerate: openssl dgst -sha256 -binary <<< 'script-content' | base64
  const inlineScriptHash = "'sha256-wuItlV/EguTdq42e9aZJikIwJZnR80ZoyRpPj8v8Dk4='";
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https://accounts.google.com",
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com`,
      `font-src 'self' https://fonts.gstatic.com`,
      `script-src 'self' ${inlineScriptHash} https://accounts.google.com https://apis.google.com`,
      "frame-src https://accounts.google.com",
      "connect-src 'self' ws: wss: https://oauth2.googleapis.com https://www.googleapis.com https://accounts.google.com"
    ].join("; ")
  );
  next();
});

app.use((req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const isWrite = req.method === "POST" || req.method === "PATCH" || req.method === "DELETE" || req.method === "PUT";
  const bucket = requestBuckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    requestBuckets.set(key, {
      windowStart: now,
      total: 1,
      writes: isWrite ? 1 : 0
    });
    next();
    return;
  }

  bucket.total += 1;
  if (isWrite) {
    bucket.writes += 1;
  }

  if (bucket.total > MAX_REQUESTS_PER_WINDOW || bucket.writes > MAX_WRITES_PER_WINDOW) {
    res.status(429).json({
      title: "Too Many Requests",
      status: 429,
      detail: "Rate limit exceeded. Please wait and retry."
    });
    return;
  }

  next();
});

app.use(express.json());
app.use(express.static("public"));
app.use(attachActor(store));
app.use((req, _res, next) => {
  const isApiMutation = req.path.startsWith("/api/") && ["POST", "PATCH", "PUT", "DELETE"].includes(req.method);
  const csrfExcludedPath = req.path === "/api/v1/auth/google/session";
  if (!isApiMutation || csrfExcludedPath) {
    next();
    return;
  }

  if (!hasValidCsrfToken(req)) {
    next(forbidden("Invalid or missing CSRF token."));
    return;
  }

  next();
});
app.use((req, res, next) => {
  res.on("finish", () => {
    const isApiMutation = req.path.startsWith("/api/") && ["POST", "PATCH", "PUT", "DELETE"].includes(req.method);
    if (!isApiMutation) {
      return;
    }

    const actor = (req as { actor?: { userId?: string } }).actor?.userId || "anonymous";
    store.logAuditEvent({
      actor,
      method: req.method,
      path: req.path,
      status: res.statusCode
    });
  });
  next();
});
app.use(createRouter(store));
app.use(errorHandler);

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

const broadcastLiveEditSnapshot = () => {
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }

    const actorId = String((client as { actorId?: string }).actorId || "");
    if (!actorId) {
      return;
    }

    client.send(
      JSON.stringify({
        type: "live-edit:update",
        entries: listLiveEdits(actorId)
      })
    );
  });
};

const unsubscribeLiveEdit = subscribeLiveEditEvents(() => {
  broadcastLiveEditSnapshot();
});

wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
  const actor = resolveSessionActorFromCookie(store, req.headers.cookie);
  if (!actor) {
    socket.close(1008, "Unauthorized");
    return;
  }

  (socket as { actorId?: string }).actorId = actor.userId;
  socket.send(
    JSON.stringify({
      type: "live-edit:init",
      entries: listLiveEdits(actor.userId)
    })
  );
});

setInterval(() => {
  sweepExpiredLiveEdits();
}, 2_000);

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Projection MVP API listening on port ${port}`);
});

const gracefulShutdown = (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down…`);
  httpServer.close(() => {
    unsubscribeLiveEdit();
    store.close();
    process.exit(0);
  });
  // Force exit if shutdown takes too long (e.g. hung keep-alive connections)
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
