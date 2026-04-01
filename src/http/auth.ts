import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import { ProjectionStore } from "../domain/store.js";
import { AccessLevel, Role, UserAccount } from "../domain/types.js";
import { AppError, badRequest, forbidden, unauthorized } from "../domain/errors.js";

export interface RequestActor {
  userId: string;
  roles: Role[];
  accessLevel: AccessLevel;
}

export interface AuthedRequest extends Request {
  actor: RequestActor;
}

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? "439629661369-b6g9fmiegn4fb5fprrdvnto088aghug7.apps.googleusercontent.com").trim();
const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? "nolimitcity.com").trim().toLowerCase();
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const PUBLIC_PATHS = new Set(["/health", "/api/v1/auth/google/config", "/favicon.ico"]);

const DEFAULT_VIEWER_ACCESS: AccessLevel = "VOYEUR";
const ADMIN_EMAILS = new Set(["bjarne@nolimitcity.com"]);

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

export const attachActor = (store: ProjectionStore) => (req: Request, _res: Response, next: NextFunction) => {
  if (PUBLIC_PATHS.has(req.path)) {
    return next();
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
        (req as AuthedRequest).actor = actor;
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
  allowedEmailDomain: ALLOWED_EMAIL_DOMAIN
});
