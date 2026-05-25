import WebhookService from "./webhook.service";
import webhookDlqRepository from "./webhook-dlq.repository";

const POLL_INTERVAL_MS = 30_000;

let timer: NodeJS.Timeout | null = null;
let isRunning = false;

async function tick() {
  if (isRunning) return; // Skip overlapping invocations
  isRunning = true;
  try {
    const due = await webhookDlqRepository.fetchDue();
    if (due.length === 0) return;
    console.log(`[Webhook DLQ] Reprocessing ${due.length} parked event(s)`);
    for (const entry of due) {
      try {
        await WebhookService.dispatch(entry.event_type, entry.store_id, entry.payload);
        await webhookDlqRepository.markResolved(entry.id);
        console.log(`[Webhook DLQ] ✓ Resolved ${entry.event_type} (id=${entry.id})`);
      } catch (e: any) {
        const msg = e?.message || String(e);
        await webhookDlqRepository.markFailed(entry.id, msg, entry.attempts);
        const nextAttempts = entry.attempts + 1;
        if (nextAttempts >= webhookDlqRepository.maxAttempts) {
          console.error(`[Webhook DLQ] ☠ DEAD after ${nextAttempts} attempts: ${entry.event_type} (id=${entry.id}) — manual intervention required.`);
        } else {
          console.warn(`[Webhook DLQ] ✗ Retry ${nextAttempts}/${webhookDlqRepository.maxAttempts} failed for ${entry.event_type} (id=${entry.id}): ${msg}`);
        }
      }
    }
  } catch (e: any) {
    console.error("[Webhook DLQ] Worker tick failed:", e?.message || e);
  } finally {
    isRunning = false;
  }
}

export function startWebhookDlqWorker() {
  if (process.env.WEBHOOK_DLQ_WORKER === "disabled") {
    console.log("[Webhook DLQ] Worker disabled via WEBHOOK_DLQ_WORKER=disabled");
    return;
  }
  if (timer) return;
  console.log(`[Webhook DLQ] Worker started — polling every ${POLL_INTERVAL_MS / 1000}s`);
  // Don't block process exit on this timer.
  timer = setInterval(tick, POLL_INTERVAL_MS);
  timer.unref?.();
}

export function stopWebhookDlqWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
