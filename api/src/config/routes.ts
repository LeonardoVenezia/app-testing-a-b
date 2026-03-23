import { Router } from "express";
import passport from "passport";

import { AuthenticationController } from "@features/auth";
import { ProductController } from "@features/product";
import { BillingController } from "@features/billing";
import { AbTestController } from "@features/ab-test";

const routes = Router();
routes.get("/auth/install", AuthenticationController.install);

// --- WEBHOOKS ---
import { WebhookController } from "@features/webhook";
import { ScriptTagController } from "@features/script-tag";

// Server the script itself
routes.get("/script-tag/storefront.js", ScriptTagController.serveScript as any);
// Serve the configuration for a specific store
routes.get("/script-tag/config/:storeId", ScriptTagController.getConfig as any);
// Log user view interactions
routes.post("/script-tag/config/:storeId/log-view", ScriptTagController.logView as any);
// DEBUG: list all scripts registered with Tiendanube for a store
routes.get("/script-tag/debug/:storeId", ScriptTagController.debugListScripts as any);

routes.post(
  "/webhooks/order-created",
  WebhookController.handleOrderCreated as any
);

routes.post(
  "/webhooks/order-cancelled",
  WebhookController.handleOrderCancelled as any
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
// Depending on auth strategy for admin actions, we might want custom auth or JWT.
// Since plans are app-wide, we'll secure them using JWT for now assuming an admin is authenticated.
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
// Subscriptions relate to the authenticated store.
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
