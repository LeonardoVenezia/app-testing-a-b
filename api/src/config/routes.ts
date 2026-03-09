import { Router } from "express";
import passport from "passport";

import { AuthenticationController } from "@features/auth";
import { ProductController } from "@features/product";
import { BillingController } from "@features/billing";

const routes = Router();
routes.get("/auth/install", AuthenticationController.install);
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
