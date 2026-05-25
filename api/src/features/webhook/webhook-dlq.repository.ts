import prisma from "../../config/prisma";

const MAX_ATTEMPTS = 5;

class WebhookDlqRepository {
  /**
   * Park a failed webhook so the worker can retry it. First retry happens in
   * ~1 minute; subsequent retries follow exponential backoff (2^n min, capped
   * at 1h).
   */
  async enqueue(
    eventType: string,
    storeId: number,
    payload: any,
    error: string
  ) {
    return prisma.webhookDlq.create({
      data: {
        event_type: eventType,
        store_id: storeId,
        payload: payload ?? {},
        attempts: 0,
        last_error: error.slice(0, 1000),
        next_retry_at: new Date(Date.now() + 60_000),
      },
    });
  }

  /** Returns up to `limit` un-resolved entries whose retry time has come. */
  async fetchDue(limit = 20) {
    return prisma.webhookDlq.findMany({
      where: {
        resolved: false,
        next_retry_at: { lte: new Date() },
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: { next_retry_at: "asc" },
      take: limit,
    });
  }

  async markResolved(id: string) {
    return prisma.webhookDlq.update({
      where: { id },
      data: { resolved: true, resolved_at: new Date(), last_error: null },
    });
  }

  async markFailed(id: string, error: string, attempts: number) {
    const nextAttempts = attempts + 1;
    // Exponential backoff: 2, 4, 8, 16, 32 minutes — capped at 60.
    const backoffMs = Math.min(2 ** nextAttempts * 60_000, 60 * 60_000);
    return prisma.webhookDlq.update({
      where: { id },
      data: {
        attempts: nextAttempts,
        last_error: error.slice(0, 1000),
        next_retry_at: new Date(Date.now() + backoffMs),
      },
    });
  }

  get maxAttempts() {
    return MAX_ATTEMPTS;
  }
}

export default new WebhookDlqRepository();
