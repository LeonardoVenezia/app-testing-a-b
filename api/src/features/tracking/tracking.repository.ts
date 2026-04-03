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

    for (const e of events) {
      const m = e.variant === "A" ? metrics.A : metrics.B;
      const payload = (e.payload as any) || {};

      switch (e.event_type) {
        case "PAGE_VIEW":
          m.unique_views++;
          break;
        case "TIME_ON_PAGE": {
          const dur = payload.duration_seconds || 0;
          const key = e.session_id + "_" + e.variant;
          if (!timeBySession[key] || dur > timeBySession[key].max) {
            timeBySession[key] = { variant: e.variant, max: dur };
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
      m.add_to_cart_rate =
        m.unique_views > 0 ? (m.add_to_cart / m.unique_views) * 100 : 0;
      m.checkout_rate =
        m.add_to_cart > 0 ? (m.checkout_started / m.add_to_cart) * 100 : 0;
      m.purchase_rate =
        m.checkout_started > 0
          ? (m.orders_completed / m.checkout_started) * 100
          : 0;
    }

    return metrics;
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
      add_to_cart_rate: 0,
      checkout_rate: 0,
      purchase_rate: 0,
    };
  }
}

export default new TrackingRepository();
