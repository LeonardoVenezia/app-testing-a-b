import prisma from "../../config/prisma";

type EventType = "PAGE_VIEW" | "TIME_ON_PAGE" | "IMAGE_CLICK" | "DESCRIPTION_INTERACTION" | "ADD_TO_CART" | "CHECKOUT_STARTED" | "ORDER_COMPLETED" | "ORDER_PAID";

const UNIQUE_PER_SESSION: EventType[] = [
  "PAGE_VIEW",
  "ADD_TO_CART",
  "CHECKOUT_STARTED",
];

class TrackingRepository {
  async recordEvent(data: {
    test_id: string;
    variant: string;
    event_type: EventType;
    session_id: string;
    payload?: any;
  }) {
    // Deduplicate unique-per-session events
    if (UNIQUE_PER_SESSION.includes(data.event_type)) {
      const existing = await prisma.trackingEvent.findFirst({
        where: {
          test_id: data.test_id,
          session_id: data.session_id,
          event_type: data.event_type,
          variant: data.variant,
        },
      });
      if (existing) return existing;
    }

    return prisma.trackingEvent.create({ data });
  }

  async getEventsByTest(test_id: string) {
    return prisma.trackingEvent.findMany({
      where: { test_id },
      orderBy: { created_at: "desc" },
    });
  }

  async getAggregatedMetrics(test_id: string) {
    const events = await prisma.trackingEvent.findMany({
      where: { test_id },
    });

    const metrics = { A: this.emptyMetrics(), B: this.emptyMetrics() };

    // Track max time_on_page per session to handle periodic updates
    const timeBySession: Record<string, { variant: string; max: number }> = {};
    // Track which event types each session has (for bounce rate)
    const sessionEvents: Record<string, Set<string>> = {};

    for (const e of events) {
      const m = e.variant === "A" ? metrics.A : metrics.B;
      const payload = (e.payload as any) || {};
      const sessionKey = e.session_id + "_" + e.variant;

      // Track event types per session
      if (!sessionEvents[sessionKey]) sessionEvents[sessionKey] = new Set();
      sessionEvents[sessionKey].add(e.event_type);

      switch (e.event_type) {
        case "PAGE_VIEW":
          m.unique_views++;
          break;
        case "TIME_ON_PAGE": {
          const dur = payload.duration_seconds || 0;
          if (!timeBySession[sessionKey] || dur > timeBySession[sessionKey].max) {
            timeBySession[sessionKey] = { variant: e.variant, max: dur };
          }
          break;
        }
        case "IMAGE_CLICK":
          m.image_clicks++;
          break;
        case "DESCRIPTION_INTERACTION":
          m.description_interactions++;
          break;
        case "ADD_TO_CART":
          m.add_to_cart++;
          break;
        case "CHECKOUT_STARTED":
          m.checkout_started++;
          break;
        case "ORDER_COMPLETED":
          m.orders_completed++;
          m.revenue += payload.revenue || 0;
          break;
        case "ORDER_PAID":
          m.orders_paid++;
          m.paid_revenue += payload.revenue || 0;
          break;
      }
    }

    // Aggregate time_on_page using max per session
    for (const key of Object.keys(timeBySession)) {
      const entry = timeBySession[key];
      const m = entry.variant === "A" ? metrics.A : metrics.B;
      m.total_time_on_page += entry.max;
      m.time_on_page_count++;
    }

    // Bounce rate: sessions with PAGE_VIEW but no interaction events
    const interactionTypes = new Set(["IMAGE_CLICK", "DESCRIPTION_INTERACTION", "ADD_TO_CART", "CHECKOUT_STARTED", "ORDER_COMPLETED"]);
    const bounces = { A: 0, B: 0 };
    for (const [sessionKey, eventTypes] of Object.entries(sessionEvents)) {
      if (!eventTypes.has("PAGE_VIEW")) continue;
      const variant = sessionKey.endsWith("_A") ? "A" : "B";
      const hasInteraction = [...eventTypes].some(t => interactionTypes.has(t));
      if (!hasInteraction) bounces[variant]++;
    }

    // Derived metrics
    for (const key of ["A", "B"] as const) {
      const m = metrics[key];
      m.avg_time_on_page =
        m.time_on_page_count > 0
          ? m.total_time_on_page / m.time_on_page_count
          : 0;
      m.conversion_rate =
        m.unique_views > 0 ? (m.orders_completed / m.unique_views) * 100 : 0;
      m.aov = m.orders_completed > 0 ? m.revenue / m.orders_completed : 0;
      m.rpv = m.unique_views > 0 ? m.revenue / m.unique_views : 0;
      m.bounce_rate =
        m.unique_views > 0 ? (bounces[key] / m.unique_views) * 100 : 0;
      m.add_to_cart_rate =
        m.unique_views > 0 ? (m.add_to_cart / m.unique_views) * 100 : 0;
      m.checkout_rate =
        m.add_to_cart > 0 ? (m.checkout_started / m.add_to_cart) * 100 : 0;
      m.purchase_rate =
        m.checkout_started > 0
          ? (m.orders_completed / m.checkout_started) * 100
          : 0;
    }

    // Statistical significance (two-proportion Z-test on conversion rate)
    const statistical_significance = this.calculateSignificance(metrics.A, metrics.B);

    return { A: metrics.A, B: metrics.B, statistical_significance };
  }

  /**
   * Two-proportion Z-test comparing conversion rates.
   * Returns p-value, confidence level, whether it's significant at 95%,
   * and the winning variant (if any).
   */
  private calculateSignificance(
    a: ReturnType<typeof this.emptyMetrics>,
    b: ReturnType<typeof this.emptyMetrics>
  ) {
    const nA = a.unique_views;
    const nB = b.unique_views;
    const xA = a.orders_completed;
    const xB = b.orders_completed;

    // Need minimum sample size for meaningful results
    if (nA < 30 || nB < 30) {
      return {
        p_value: null,
        confidence_level: null,
        is_significant: false,
        winner: null,
        message: `Datos insuficientes (A: ${nA}, B: ${nB} vistas — mín. 30 por variante)`,
      };
    }

    const pA = xA / nA;
    const pB = xB / nB;

    // If both are zero, no winner
    if (pA === 0 && pB === 0) {
      return {
        p_value: null,
        confidence_level: null,
        is_significant: false,
        winner: null,
        message: "Sin conversiones aún",
      };
    }

    // Pooled proportion
    const pPool = (xA + xB) / (nA + nB);
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));

    if (se === 0) {
      return {
        p_value: 1,
        confidence_level: 0,
        is_significant: false,
        winner: null,
        message: "Varianza cero — tasas idénticas",
      };
    }

    const z = Math.abs(pA - pB) / se;
    const pValue = 2 * (1 - this.normalCDF(z)); // two-tailed
    const confidenceLevel = (1 - pValue) * 100;
    const isSignificant = pValue < 0.05;
    const winner = isSignificant ? (pA > pB ? "A" : "B") : null;

    let message: string;
    if (isSignificant) {
      message = `Diferencia estadísticamente significativa (${confidenceLevel.toFixed(1)}% de confianza).`;
    } else if (confidenceLevel > 80) {
      message = `Tendencia visible (${confidenceLevel.toFixed(1)}% de confianza). Seguí recopilando datos.`;
    } else {
      message = `Sin diferencia significativa aún (${confidenceLevel.toFixed(1)}% de confianza).`;
    }

    return { p_value: pValue, confidence_level: confidenceLevel, is_significant: isSignificant, winner, message };
  }

  /** Approximation of the standard normal CDF using Abramowitz & Stegun formula. */
  private normalCDF(x: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.SQRT2;
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
  }

  async findSessionVariant(
    session_id: string,
    store_id: number
  ): Promise<{ test_id: string; variant: string } | null> {
    const event = await prisma.trackingEvent.findFirst({
      where: {
        session_id,
        ab_test: { store_id },
      },
      select: { test_id: true, variant: true },
      orderBy: { created_at: "desc" },
    });
    return event;
  }

  private emptyMetrics() {
    return {
      unique_views: 0,
      total_time_on_page: 0,
      time_on_page_count: 0,
      avg_time_on_page: 0,
      image_clicks: 0,
      description_interactions: 0,
      add_to_cart: 0,
      checkout_started: 0,
      orders_completed: 0,
      orders_paid: 0,
      revenue: 0,
      paid_revenue: 0,
      conversion_rate: 0,
      aov: 0,
      rpv: 0,
      bounce_rate: 0,
      add_to_cart_rate: 0,
      checkout_rate: 0,
      purchase_rate: 0,
    };
  }
}

export default new TrackingRepository();
