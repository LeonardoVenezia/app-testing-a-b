import express from "express";
import morgan from "morgan";
// @ts-ignore
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(".env"),
});

import { AppRoutes, smartCors } from "@config";
import {
  beforeCheckClientMiddleware,
  errorHandlingMiddleware,
} from "@middlewares";
import { startWebhookDlqWorker } from "@features/webhook";
import "./utils/passaport-strategy";

const port = process.env.PORT || 7200;
const app = express();

// We sit behind a tunnel / reverse proxy (Cloudflare, ngrok, etc.) which
// rewrites the client IP into X-Forwarded-For. Trust exactly one hop so:
//   - rate-limit keys by the real client IP, not the proxy.
//   - we don't blindly trust arbitrary X-Forwarded-For headers from clients
//     (which would let attackers bypass per-IP limits).
// If you ever chain more proxies, bump TRUSTED_PROXY_HOPS in .env to the
// correct count.
const trustedHops = Number(process.env.TRUSTED_PROXY_HOPS || 1);
app.set("trust proxy", trustedHops);

app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms")
);
// CORS must be registered globally (not per-route) so it also catches the
// preflight OPTIONS that Express auto-handles otherwise. smartCors picks the
// right policy per path (open for storefronts, whitelist for the dashboard,
// none for webhooks / OAuth).
app.use(smartCors);
app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  })
);
app.use(express.text({ type: "text/plain", limit: "1mb" }));
app.use(beforeCheckClientMiddleware);
app.use(AppRoutes);
app.use(errorHandlingMiddleware);
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
  startWebhookDlqWorker();
});
