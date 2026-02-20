const MODAL_WEBHOOK_SECRET = process.env.MODAL_WEBHOOK_SECRET || "";

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (MODAL_WEBHOOK_SECRET) {
    headers["Authorization"] = `Bearer ${MODAL_WEBHOOK_SECRET}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Modal webhook failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function selectAgent(payload: {
  rfq_id: string;
  selected_agent: string;
  selected_carrier: string;
  shipment_number: string;
  selected_by: string;
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
