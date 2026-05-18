import cors, { CorsOptions } from "cors";

const parseList = (s?: string): string[] =>
  (s || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

const DEV_DEFAULTS = ["http://localhost:5173", "http://localhost:3000"];

// Origins allowed to call authenticated endpoints (the embedded dashboard).
// Configure via CORS_ALLOWED_ORIGINS as a comma-separated list, e.g.:
//   CORS_ALLOWED_ORIGINS=https://front.leovenezia.dev,http://localhost:5173
// Supported patterns per entry:
//   *                         → wildcard (allow any origin — escape hatch)
//   https://example.com       → exact match
//   https://*.example.com     → any subdomain
// Falls back to local dev origins if not set, so `yarn start` keeps working.
const configured = parseList(process.env.CORS_ALLOWED_ORIGINS);
const allowedOrigins = configured.length > 0 ? configured : DEV_DEFAULTS;
const allowAll = allowedOrigins.includes("*");

// Pre-compile subdomain wildcards (`https://*.foo.com`) into regexes.
const subdomainMatchers = allowedOrigins
  .filter((o) => o.includes("*") && o !== "*")
  .map((pattern) => {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+");
    return new RegExp("^" + escaped + "$");
  });
const exactMatches = new Set(allowedOrigins.filter((o) => !o.includes("*")));

console.log(`[CORS] Authenticated-endpoint whitelist: ${allowedOrigins.join(", ")}${allowAll ? " (WILDCARD — allowing any origin)" : ""}`);

const appCorsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Same-origin requests, server-to-server calls and curl send no Origin
    // header. Browsers always send one on cross-origin requests.
    if (!origin) return callback(null, true);
    if (allowAll) return callback(null, true);
    if (exactMatches.has(origin)) return callback(null, true);
    if (subdomainMatchers.some((re) => re.test(origin))) return callback(null, true);
    console.warn(`[CORS] Rejected origin: ${origin}. Allowed: ${allowedOrigins.join(", ")}`);
    // Don't throw — let the browser block the response naturally. Throwing
    // produces a 500 that hides the real issue.
    return callback(null, false);
  },
  // Frontend sends JWT in the Authorization header, not cookies. No
  // credentials needed — keeping this false avoids the stricter
  // wildcard-disallowed rules of credentialed CORS.
  credentials: false,
};

// Public storefront endpoints (tracking ingest, script-tag config). Each
// merchant store has its own subdomain, so the set of legitimate origins is
// unbounded — reflect any origin.
const storefrontCorsOptions: CorsOptions = {
  origin: true,
  credentials: false,
};

export const appCors = cors(appCorsOptions);
export const storefrontCors = cors(storefrontCorsOptions);

// Paths that are public storefront endpoints (open CORS).
const storefrontPathPatterns: RegExp[] = [
  /^\/api\/track$/,
  /^\/script-tag\/storefront\.js$/,
  /^\/script-tag\/config\/[^/]+$/,
  /^\/script-tag\/config\/[^/]+\/log-view$/,
];

// Paths that need no CORS at all (server-to-server or browser navigation).
const noCorsPathPatterns: RegExp[] = [
  /^\/webhooks\//,
  /^\/auth\/install$/,
];

import { NextFunction, Request, Response } from "express";

/**
 * Express middleware that picks the right CORS policy based on the request
 * path. Mounted globally so it also handles OPTIONS preflight, which
 * per-route handlers miss (Express auto-responds to OPTIONS otherwise).
 */
export const smartCors = (req: Request, res: Response, next: NextFunction): void => {
  const path = req.path;
  if (noCorsPathPatterns.some((re) => re.test(path))) return next();
  if (storefrontPathPatterns.some((re) => re.test(path))) return storefrontCors(req, res, next);
  return appCors(req, res, next);
};
