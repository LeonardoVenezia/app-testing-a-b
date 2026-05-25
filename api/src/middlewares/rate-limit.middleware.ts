import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";

// In-memory store (default). Counters reset on server restart. Suitable
// while there is one backend instance. If you scale horizontally, swap the
// `store:` option for a Redis-backed store.

// Tracking ingest: called from every storefront page-view / interaction.
// 120 req/min per IP is generous for legitimate users (typical session
// generates ~5-10 events) while still blocking floods.
export const trackingRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many tracking events, slow down." },
});

// Script-tag config: called once on every storefront page load. 60 req/min
// per IP covers normal browsing. We key by IP + store_id so abuse against one
// store doesn't lock out others. `ipKeyGenerator` is the IPv6-safe helper
// required by express-rate-limit v8 — it normalizes IPv6 addresses to a /64
// prefix so an attacker can't bypass the limit by rotating the low bits.
export const scriptConfigRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ipKey = ipKeyGenerator(req.ip || "");
    const storeId = req.params?.storeId || "anon";
    return `${ipKey}:${storeId}`;
  },
  message: { error: "Too many config requests, slow down." },
});
