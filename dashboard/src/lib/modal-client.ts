const MODAL_WEBHOOK_SECRET = process.env.MODAL_WEBHOOK_SECRET;
const MODAL_WEBHOOK_TIMEOUT_MS = Number(
  process.env.MODAL_WEBHOOK_TIMEOUT_MS || "15000"
);

interface WebhookOptions {
  url: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}

export async function callModalWebhook<T = unknown>({
  url,
  method = "POST",
  body,
}: WebhookOptions): Promise<T> {
  if (!MODAL_WEBHOOK_SECRET) {
    throw new Error("MODAL_WEBHOOK_SECRET environment variable is required");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${MODAL_WEBHOOK_SECRET}`,
  };

  const controller = new AbortController();
  const timeout = Number.isFinite(MODAL_WEBHOOK_TIMEOUT_MS)
    ? MODAL_WEBHOOK_TIMEOUT_MS
    : 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Modal webhook timed out after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Modal webhook failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function selectAgent(payload: {
  rfq_id: string;
  workspace_id: string;
  selected_by_user_id: string;
  selected_agent: string;
  selected_match: string;
  selected_carrier: string;
  shipment_number: string;
  selected_by: string;
  margin: number;
  quote_threshold: number;
}) {
  const webhookUrl = process.env.MODAL_WEBHOOK_SELECT_AGENT || "";
  if (!webhookUrl) {
    throw new Error("MODAL_WEBHOOK_SELECT_AGENT environment variable is not configured");
  }
  return callModalWebhook({
    url: webhookUrl,
    body: payload,
  });
}

export interface MarketRatesResponse {
  success: boolean;
  mode?: string;
  count?: number;
  persisted?: number;
  rates?: unknown[];
  error?: string;
}

// Phase 4 — trigger the land-freight market-rates aggregation endpoint
// (automations/phase_4_market_rates.py). The Modal worker fetches + persists
// the rate snapshot for the lane (workspace-scoped) and returns it.
export async function fetchMarketRates(payload: {
  workspace_id: string;
  origin: string;
  destination: string;
  freight_mode?: string;
  equipment_type?: string | null;
  load_type?: string | null;
  weight_lbs?: number | null;
  nmfc_class?: string | null;
  rfq_id?: string | null;
}) {
  const webhookUrl = process.env.MODAL_WEBHOOK_MARKET_RATES || "";
  if (!webhookUrl) {
    throw new Error("MODAL_WEBHOOK_MARKET_RATES environment variable is not configured");
  }
  return callModalWebhook<MarketRatesResponse>({
    url: webhookUrl,
    body: payload,
  });
}
