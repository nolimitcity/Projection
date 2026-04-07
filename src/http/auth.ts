import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { ProjectionStore } from "../domain/store.js";
import { AccessLevel, Role, UserAccount } from "../domain/types.js";
import { AppError, badRequest, forbidden, unauthorized } from "../domain/errors.js";

export interface RequestActor {
  userId: string;
  roles: Role[];
  accessLevel: AccessLevel;
}

interface SessionRecord {
  id: string;
  userId: string;
  csrfToken: string;
  expiresAtMs: number;
}

export interface AuthedRequest extends Request {
  actor: RequestActor;
  authType?: "session" | "bearer";
  sessionId?: string;
  csrfToken?: string;
}

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? "nolimitcity.com").trim().toLowerCase();
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const DEV_BYPASS_EMAIL = (process.env.DEV_BYPASS_EMAIL ?? "").trim().toLowerCase();
const DEV_BYPASS_ENABLED = Boolean(DEV_BYPASS_EMAIL) && process.env.NODE_ENV !== "production";

const PUBLIC_PATHS = new Set([
  "/health",
  "/api/v1/auth/google/config",
  "/api/v1/auth/google/session",
  "/api/v1/auth/session",
  "/api/v1/auth/dev-bypass",
  "/favicon.ico"
]);
const SESSION_COOKIE_NAME = "projection_session";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS ?? 12 * 60 * 60 * 1000);
const sessionStore = new Map<string, SessionRecord>();

const DEFAULT_VIEWER_ACCESS: AccessLevel = "VOYEUR";
const ADMIN_EMAILS = new Set(["bjarne@nolimitcity.com"]);

const nowMs = () => Date.now();

const capitalizeNickname = (email: string): string => {
  const local = email.split("@")[0]?.trim() || "user";
  if (!local) {
    return "User";
  }
  return local.charAt(0).toUpperCase() + local.slice(1);
};

const accessLevelToRoles = (accessLevel: AccessLevel): Role[] => {
  if (accessLevel === "ADMIN") {
    return ["SYSTEM_ADMIN", "PROJECT_OWNER"];
  }
  if (accessLevel === "DESTROYER") {
    return ["PROJECT_OWNER"];
  }
  return ["STAKEHOLDER"];
};

const ensureUserAccount = (store: ProjectionStore, email: string): UserAccount => {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = store.users.find((entry) => entry.email.toLowerCase() === normalizedEmail);

  if (existing) {
    if (ADMIN_EMAILS.has(normalizedEmail) && existing.accessLevel !== "ADMIN") {
      existing.accessLevel = "ADMIN";
      existing.destroyerAccessRequested = false;
      existing.updatedAt = new Date().toISOString();
      store.save();
    }
    return existing;
  }

  const timestamp = new Date().toISOString();
  const created: UserAccount = {
    email: normalizedEmail,
    nickname: capitalizeNickname(normalizedEmail),
    accessLevel: ADMIN_EMAILS.has(normalizedEmail) ? "ADMIN" : DEFAULT_VIEWER_ACCESS,
    destroyerAccessRequested: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.users.push(created);
  store.save();
  return created;
};

const parseCookieHeader = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  const entries = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("=");
      if (separator < 0) {
        return [entry, ""] as const;
      }
      const key = entry.slice(0, separator).trim();
      const value = entry.slice(separator + 1).trim();
      return [key, decodeURIComponent(value)] as const;
    });

  return Object.fromEntries(entries);
};

const cleanupExpiredSessions = () => {
  const current = nowMs();
  for (const [id, session] of sessionStore.entries()) {
    if (session.expiresAtMs <= current) {
      sessionStore.delete(id);
    }
  }
};

const getSessionFromRequest = (req: Request): SessionRecord | null => {
  cleanupExpiredSessions();
  const cookies = parseCookieHeader(req.header("cookie"));
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    return null;
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    return null;
  }

  if (session.expiresAtMs <= nowMs()) {
    sessionStore.delete(sessionId);
    return null;
  }

  return session;
};

const setSessionCookie = (res: Response, sessionId: string) => {
  const secure = process.env.NODE_ENV === "production";
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];

  if (secure) {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
};

export const clearSessionCookie = (res: Response) => {
  const secure = process.env.NODE_ENV === "production";
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (secure) {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
};

export const destroySessionFromRequest = (req: Request) => {
  const cookies = parseCookieHeader(req.header("cookie"));
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (sessionId) {
    sessionStore.delete(sessionId);
  }
};

const verifyGoogleActor = async (store: ProjectionStore, idToken: string): Promise<RequestActor> => {
  if (!googleClient || !GOOGLE_CLIENT_ID) {
    throw badRequest("Google login is not configured on this server. Missing GOOGLE_CLIENT_ID.");
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    const email = (payload?.email ?? "").trim().toLowerCase();
    if (!payload?.email_verified || !email) {
      throw forbidden("Google account must have a verified email.");
    }

    if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
      throw forbidden(`Only @${ALLOWED_EMAIL_DOMAIN} accounts are allowed.`);
    }

    const user = ensureUserAccount(store, email);
    return {
      userId: email,
      roles: accessLevelToRoles(user.accessLevel),
      accessLevel: user.accessLevel
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw unauthorized("Google session expired or is invalid. Please sign in again.");
  }
};

export const createSessionFromGoogleToken = async (
  store: ProjectionStore,
  idToken: string
): Promise<{ actor: RequestActor; sessionId: string; csrfToken: string }> => {
  const actor = await verifyGoogleActor(store, idToken);
  const sessionId = randomUUID();
  const csrfToken = randomUUID();
  sessionStore.set(sessionId, {
    id: sessionId,
    userId: actor.userId,
    csrfToken,
    expiresAtMs: nowMs() + SESSION_TTL_MS
  });

  return { actor, sessionId, csrfToken };
};

export const createDevBypassSession = (
  store: ProjectionStore
): { actor: RequestActor; sessionId: string; csrfToken: string } => {
  if (!DEV_BYPASS_ENABLED) {
    throw forbidden("Dev bypass login is not available in this environment.");
  }

  const user = ensureUserAccount(store, DEV_BYPASS_EMAIL);
  const actor: RequestActor = {
    userId: user.email,
    roles: accessLevelToRoles(user.accessLevel),
    accessLevel: user.accessLevel
  };

  const sessionId = randomUUID();
  const csrfToken = randomUUID();
  sessionStore.set(sessionId, {
    id: sessionId,
    userId: actor.userId,
    csrfToken,
    expiresAtMs: nowMs() + SESSION_TTL_MS
  });

  return { actor, sessionId, csrfToken };
};

export const establishSession = (res: Response, sessionId: string) => {
  setSessionCookie(res, sessionId);
};

export const getCsrfTokenForRequest = (req: Request): string | null => {
  const session = getSessionFromRequest(req);
  return session?.csrfToken ?? null;
};

export const resolveSessionActorFromCookie = (
  store: ProjectionStore,
  cookieHeader: string | undefined
): RequestActor | null => {
  cleanupExpiredSessions();
  const cookies = parseCookieHeader(cookieHeader);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    return null;
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    return null;
  }

  if (session.expiresAtMs <= nowMs()) {
    sessionStore.delete(sessionId);
    return null;
  }

  const user = ensureUserAccount(store, session.userId);
  return {
    userId: user.email,
    roles: accessLevelToRoles(user.accessLevel),
    accessLevel: user.accessLevel
  };
};

export const hasValidCsrfToken = (req: Request): boolean => {
  const authed = req as AuthedRequest;
  if (authed.authType !== "session") {
    return true;
  }

  const expected = authed.csrfToken;
  if (!expected) {
    return false;
  }

  const headerToken = (req.header("x-csrf-token") ?? "").trim();
  return Boolean(headerToken) && headerToken === expected;
};

export const attachActor = (store: ProjectionStore) => (req: Request, _res: Response, next: NextFunction) => {
  if (PUBLIC_PATHS.has(req.path)) {
    return next();
  }

  const session = getSessionFromRequest(req);
  if (session) {
    const user = ensureUserAccount(store, session.userId);
    const actor: RequestActor = {
      userId: user.email,
      roles: accessLevelToRoles(user.accessLevel),
      accessLevel: user.accessLevel
    };

    const authedReq = req as AuthedRequest;
    authedReq.actor = actor;
    authedReq.authType = "session";
    authedReq.sessionId = session.id;
    authedReq.csrfToken = session.csrfToken;
    next();
    return;
  }

  const authHeader = req.header("authorization") ?? req.header("Authorization") ?? "";
  const bearerPrefix = "Bearer ";

  if (authHeader.startsWith(bearerPrefix)) {
    const token = authHeader.slice(bearerPrefix.length).trim();
    if (!token) {
      return next(badRequest("Authorization bearer token is empty."));
    }

    verifyGoogleActor(store, token)
      .then((actor) => {
        const authedReq = req as AuthedRequest;
        authedReq.actor = actor;
        authedReq.authType = "bearer";
        next();
      })
      .catch((error) => next(error));
    return;
  }

  return next(unauthorized("Login required. Please sign in with Google."));
};

export const getGoogleAuthConfig = () => ({
  enabled: Boolean(GOOGLE_CLIENT_ID),
  clientId: GOOGLE_CLIENT_ID,
  allowedEmailDomain: ALLOWED_EMAIL_DOMAIN,
  devBypassEnabled: DEV_BYPASS_ENABLED
});
