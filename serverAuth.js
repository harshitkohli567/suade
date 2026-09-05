/**
 * Google sign-in + session handling for the Suade web workspace.
 *
 * Flow (Google Identity Services, no server-side OAuth redirect):
 *   1. Browser renders the Google button, gets an ID token (a JWT).
 *   2. POST /api/auth/google { credential } -> we verify the ID token
 *      against Google's public keys with google-auth-library, then issue
 *      our own signed, HTTP-only session cookie (a short JWT of our own).
 *   3. Subsequent requests carry the cookie; requireAuth() verifies it.
 *
 * "Anyone with a Google account" is allowed (per product decision). To add
 * an allowlist later, gate on payload.email inside verifyGoogleCredential.
 *
 * Env:
 *   GOOGLE_CLIENT_ID  - the OAuth 2.0 Web client ID (also used as audience).
 *   SESSION_SECRET    - HMAC secret for our session cookie (falls back to a
 *                       random per-boot secret in dev, which logs everyone
 *                       out on restart -- set it in production).
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const SESSION_COOKIE = "suade_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (() => {
    if (IS_PRODUCTION) {
      console.warn(
        "Suade auth: SESSION_SECRET is not set in production -- sessions won't survive a restart. Set it."
      );
    }
    return crypto.randomBytes(32).toString("hex");
  })();

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/** Verify a Google ID token; returns a compact user profile or throws. */
async function verifyGoogleCredential(credential) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured on the server.");
  }
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error("Google token had no subject.");
  }
  if (payload.email && payload.email_verified === false) {
    throw new Error("This Google account's email is not verified.");
  }
  return {
    sub: payload.sub,
    email: payload.email || null,
    name: payload.name || null,
    picture: payload.picture || null,
  };
}

function issueSession(user) {
  return jwt.sign(
    { sub: user.sub, email: user.email, name: user.name, picture: user.picture },
    SESSION_SECRET,
    { expiresIn: SESSION_TTL_SECONDS }
  );
}

/** Minimal cookie parser -- avoids adding cookie-parser just for one cookie. */
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

function setSessionCookie(res, token) {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (IS_PRODUCTION) attrs.push("Secure");
  res.append("Set-Cookie", attrs.join("; "));
}

function clearSessionCookie(res) {
  const attrs = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (IS_PRODUCTION) attrs.push("Secure");
  res.append("Set-Cookie", attrs.join("; "));
}

/** Returns the session user if the request carries a valid cookie, else null. */
function getSessionUser(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET);
  } catch {
    return null;
  }
}

/** Express middleware: 401 unless a valid session cookie is present. */
function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Not signed in." });
  }
  req.user = user;
  next();
}

/**
 * Registers the auth routes on the Express app.
 *   GET  /api/auth/config  - public: the client needs the Google client ID.
 *   POST /api/auth/google  - exchange a Google credential for a session.
 *   GET  /api/auth/me      - current session user (or 401).
 *   POST /api/auth/logout  - clear the session cookie.
 */
function registerAuthRoutes(app) {
  app.get("/api/auth/config", (req, res) => {
    res.json({ googleClientId: GOOGLE_CLIENT_ID, configured: Boolean(GOOGLE_CLIENT_ID) });
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      const { credential } = req.body || {};
      if (!credential) {
        return res.status(400).json({ error: "Missing Google credential." });
      }
      const user = await verifyGoogleCredential(credential);
      setSessionCookie(res, issueSession(user));
      res.json({ user: { email: user.email, name: user.name, picture: user.picture } });
    } catch (err) {
      console.error("Suade auth error:", err.message);
      res.status(401).json({ error: "Google sign-in failed. Please try again." });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Not signed in." });
    res.json({ user: { email: user.email, name: user.name, picture: user.picture } });
  });

  app.post("/api/auth/logout", (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });
}

module.exports = {
  GOOGLE_CLIENT_ID,
  registerAuthRoutes,
  requireAuth,
  getSessionUser,
};
