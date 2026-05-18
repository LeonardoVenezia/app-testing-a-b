import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { StatusCode } from "@utils";

const SIGNATURE_HEADER = "x-linkedstore-hmac-sha256";

// Mode: "enforce" (default — reject invalid/missing), "log" (accept all, log
// mismatches), "disabled" (skip entirely). Configure via WEBHOOK_SIGNATURE_MODE.
type Mode = "enforce" | "log" | "disabled";
function getMode(): Mode {
  const raw = (process.env.WEBHOOK_SIGNATURE_MODE || "enforce").toLowerCase();
  if (raw === "log" || raw === "disabled") return raw;
  return "enforce";
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function verify(secret: string, body: Buffer, headerValue: string): boolean {
  const signed = headerValue.trim();
  // Tiendanube/Nuvemshop sends base64; some legacy integrations use hex.
  // Accept both to be resilient.
  const b64 = crypto.createHmac("sha256", secret).update(body).digest("base64");
  const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (safeEqual(Buffer.from(signed), Buffer.from(b64))) return true;
  if (safeEqual(Buffer.from(signed.toLowerCase()), Buffer.from(hex))) return true;
  return false;
}

export const verifyWebhookSignatureMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const mode = getMode();
  if (mode === "disabled") {
    return next();
  }

  const secret = process.env.CLIENT_SECRET;
  if (!secret) {
    console.error("[Webhook] CLIENT_SECRET is not configured; rejecting webhook.");
    res.status(StatusCode.INTERNAL_SERVER_ERROR).send("Server misconfigured");
    return;
  }

  const rawHeader = req.headers[SIGNATURE_HEADER];
  const signature = typeof rawHeader === "string" ? rawHeader : "";
  const body = req.rawBody;

  if (!signature || !body || body.length === 0) {
    if (mode === "log") {
      console.warn(
        `[Webhook] Missing signature or body (mode=log) — accepting. headerPresent=${!!signature} bodyLen=${body?.length ?? 0}`
      );
      return next();
    }
    res.status(StatusCode.UNAUTHORIZED).send("Missing webhook signature or body");
    return;
  }

  const ok = verify(secret, body, signature);
  if (!ok) {
    if (mode === "log") {
      console.warn("[Webhook] Signature mismatch (mode=log) — accepting anyway.");
      return next();
    }
    console.warn("[Webhook] Signature mismatch — rejecting. Configure WEBHOOK_SIGNATURE_MODE=log to debug.");
    res.status(StatusCode.UNAUTHORIZED).send("Invalid webhook signature");
    return;
  }

  next();
};
