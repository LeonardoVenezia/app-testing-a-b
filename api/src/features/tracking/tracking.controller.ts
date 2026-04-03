import { Request, Response } from "express";
import prisma from "../../config/prisma";
import trackingRepository from "./tracking.repository";

const VALID_EVENT_TYPES = [
  "PAGE_VIEW",
  "TIME_ON_PAGE",
  "IMAGE_CLICK",
  "DESCRIPTION_INTERACTION",
  "ADD_TO_CART",
  "CHECKOUT_STARTED",
] as const;

class TrackingController {
  // POST /api/track
  async ingest(req: Request, res: Response) {
    let body: any;
    try {
      // Handle text/plain from sendBeacon or JSON from fetch
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch (parseErr) {
      console.error("[Tracking] Failed to parse body:", typeof req.body, req.headers["content-type"], req.body);
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    if (!body || typeof body !== "object") {
      console.error("[Tracking] Empty or invalid body:", typeof req.body, req.headers["content-type"]);
      return res.status(400).json({ error: "Empty body" });
    }

    const { store_id, test_id, variant, event_type, session_id, payload } = body;

    // Validate required fields
    if (!store_id || !test_id || !variant || !event_type || !session_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["A", "B"].includes(variant)) {
      return res.status(400).json({ error: "Invalid variant" });
    }

    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return res.status(400).json({ error: "Invalid event_type" });
    }

    // Verify the test exists and belongs to the store
    const test = await prisma.abTest.findFirst({
      where: { id: test_id, store_id: Number(store_id), status: "ACTIVE" },
      select: { id: true },
    });

    if (!test) {
      return res.status(404).json({ error: "Test not found or inactive" });
    }

    try {
      await trackingRepository.recordEvent({
        test_id,
        variant,
        event_type,
        session_id,
        payload: payload || undefined,
      });

      // Also increment legacy counters for backward compat
      if (event_type === "PAGE_VIEW") {
        const field = variant === "A" ? "original_views" : "variant_views";
        await prisma.abTest.update({
          where: { id: test_id },
          data: { [field]: { increment: 1 } },
        });
      }

      res.status(200).json({ ok: true });
    } catch (e) {
      console.error("[Tracking] Error recording event:", e);
      res.status(500).json({ error: "Internal error" });
    }
  }

  // GET /api/track/metrics/:testId (authenticated)
  async getMetrics(req: Request, res: Response) {
    const { testId } = req.params;
    try {
      const metrics = await trackingRepository.getAggregatedMetrics(testId);
      res.json(metrics);
    } catch (e) {
      console.error("[Tracking] Error fetching metrics:", e);
      res.status(500).json({ error: "Internal error" });
    }
  }
}

export default new TrackingController();
