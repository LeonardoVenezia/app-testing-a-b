import { Router } from "express";
import passport from "passport";

import { AuthenticationController } from "@features/auth";
import { ProductController } from "@features/product";
import { BillingController } from "@features/billing";
import { AbTestController } from "@features/ab-test";
import { TrackingController } from "@features/tracking";
import { verifyWebhookSignatureMiddleware } from "@middlewares";

// CORS is applied globally in index.ts via smartCors (handles preflight too).

const routes = Router();

// OAuth install redirect — full browser navigation.
routes.get("/auth/install", AuthenticationController.install);

import { WebhookController } from "@features/webhook";
import { ScriptTagController } from "@features/script-tag";

// --- SCRIPT TAG ---
routes.get("/script-tag/storefront.js", ScriptTagController.serveScript as any);
routes.get("/script-tag/config/:storeId", ScriptTagController.getConfig as any);
routes.post("/script-tag/config/:storeId/log-view", ScriptTagController.logView as any);
routes.get("/script-tag/debug/:storeId", ScriptTagController.debugListScripts as any);
routes.post("/script-tag/register/:storeId", ScriptTagController.registerScript as any);

// --- WEBHOOKS (server-to-server from Tiendanube) ---
routes.post(
  "/webhooks/order-created",
  verifyWebhookSignatureMiddleware,
  WebhookController.handleOrderCreated as any
);

routes.post(
  "/webhooks/order-paid",
  verifyWebhookSignatureMiddleware,
  WebhookController.handleOrderPaid as any
);

routes.post(
  "/webhooks/order-cancelled",
  verifyWebhookSignatureMiddleware,
  WebhookController.handleOrderCancelled as any
);

// --- TRACKING (public, no auth - called from storefront) ---
routes.post("/api/track", TrackingController.ingest as any);
// --- TRACKING (authenticated - dashboard metrics) ---
routes.get(
  "/api/track/metrics/:testId",
  passport.authenticate("jwt", { session: false }),
  TrackingController.getMetrics as any
);

// --- A/B TESTS ---
routes.post(
  "/ab-tests",
  passport.authenticate("jwt", { session: false }),
  AbTestController.create as any
);
routes.get(
  "/ab-tests",
  passport.authenticate("jwt", { session: false }),
  AbTestController.getAll as any
);
routes.get(
  "/ab-tests/deleted",
  passport.authenticate("jwt", { session: false }),
  AbTestController.getDeleted as any
);
routes.get(
  "/ab-tests/:id",
  passport.authenticate("jwt", { session: false }),
  AbTestController.getOne as any
);
routes.patch(
  "/ab-tests/:id",
  passport.authenticate("jwt", { session: false }),
  AbTestController.updateStatus as any
);
routes.delete(
  "/ab-tests/:id",
  passport.authenticate("jwt", { session: false }),
  AbTestController.delete as any
);

routes.post(
  "/products",
  passport.authenticate("jwt", { session: false }),
  ProductController.create
);

routes.get(
  "/products/total",
  passport.authenticate("jwt", { session: false }),
  ProductController.getTotal
);
routes.get(
  "/products",
  passport.authenticate("jwt", { session: false }),
  ProductController.getAll
);
routes.delete(
  "/products/:id",
  passport.authenticate("jwt", { session: false }),
  ProductController.delete
);

// --- BILLING (Plans) ---
routes.post(
  "/billing/plans",
  passport.authenticate("jwt", { session: false }),
  BillingController.createPlan
);
routes.patch(
  "/billing/plans/:id",
  passport.authenticate("jwt", { session: false }),
  BillingController.updatePlan
);
routes.delete(
  "/billing/plans/:id",
  passport.authenticate("jwt", { session: false }),
  BillingController.deletePlan
);

// --- BILLING (Subscriptions) ---
routes.get(
  "/billing/subscription",
  passport.authenticate("jwt", { session: false }),
  BillingController.getSubscription
);
routes.patch(
  "/billing/subscription",
  passport.authenticate("jwt", { session: false }),
  BillingController.updateSubscription
);

export default routes;
