/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = "https://evo-logistics.vercel.app";
const LOGIN_EMAIL = "yunapink05@gmail.com";

function parseDotEnv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function restRequest(url, serviceKey, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    throw new Error(`REST ${method} ${url} failed (${response.status}): ${text}`);
  }

  return parsed;
}

async function generateAdminMagicLink(supabaseUrl, serviceKey, email) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${BASE_URL}/auth/confirm?next=%2F`,
      },
    }),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    throw new Error(`Failed to generate admin magic link (${response.status}): ${text}`);
  }

  const actionLink = parsed?.action_link;
  if (!actionLink) {
    throw new Error("Admin magic link response missing action_link");
  }

  const parsedActionLink = new URL(actionLink);
  const tokenHash = parsed?.hashed_token ?? parsedActionLink.searchParams.get("token_hash");
  const type = parsedActionLink.searchParams.get("type") ?? "magiclink";

  if (!tokenHash) {
    return actionLink;
  }

  return `${BASE_URL}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&next=%2F`;
}

async function evaluateWithNavigationRetry(page, browserFn, arg) {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await page.evaluate(browserFn, arg);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        message.includes("Execution context was destroyed") ||
        message.includes("Cannot find context with specified id");
      if (!retryable || attempt === 3) {
        throw error;
      }
      lastError = error;
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(800);
    }
  }
  throw lastError ?? new Error("evaluateWithNavigationRetry failed");
}

async function waitForRowRemoval(page, text, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await page.locator("tr", { hasText: text }).count()) === 0) {
      return true;
    }
    await page.waitForTimeout(400);
  }
  return false;
}

async function main() {
  const repoRoot = "/Users/hafisfox/Documents/evo_logistics";
  const env = parseDotEnv(path.join(repoRoot, "dashboard/.env.local"));
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in dashboard/.env.local");
  }

  const stamp = Date.now().toString().slice(-10);
  const agentName = `Smoke Agent ${stamp}`;
  const agentEmail = `smoke.agent.${stamp}@example.com`;
  const agentEmailUpdated = `smoke.agent.updated.${stamp}@example.com`;

  const doCarrier = `SMOKE-CARRIER-${stamp}`;
  const destType = `Smoke Dest ${stamp}`;
  const transportPlace = `Smoke Place ${stamp}`;

  const rfqId = `RFQ-SMOKE-${stamp}`;
  const rfqThreadId = `smoke-thread-${stamp}`;
  let workspaceId = "";

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });

    const adminMagicLink = await generateAdminMagicLink(supabaseUrl, serviceKey, LOGIN_EMAIL);
    console.log("[smoke] generated admin magic-link for authenticated smoke");
    await page.goto(adminMagicLink, { waitUntil: "domcontentloaded" });

    const authDeadline = Date.now() + 45_000;
    let authProbe = null;
    while (Date.now() < authDeadline) {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      authProbe = await evaluateWithNavigationRetry(page, async () => {
        const response = await fetch("/api/workspaces/current");
        let data = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }
        return { ok: response.ok, status: response.status, data };
      });
      if (authProbe.ok) {
        break;
      }
      await page.waitForTimeout(1_000);
    }

    if (!authProbe?.ok) {
      throw new Error(
        `Authentication did not complete. Last probe: ${JSON.stringify(authProbe)} | URL: ${page.url()}`
      );
    }

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1200);

    const workspacesResult = await evaluateWithNavigationRetry(page, async () => {
      const response = await fetch("/api/workspaces");
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      return { ok: response.ok, status: response.status, data };
    });
    if (!workspacesResult.ok) {
      throw new Error(
        `Failed to fetch workspaces (${workspacesResult.status}): ${JSON.stringify(workspacesResult.data)}`
      );
    }

    const manageableWorkspace = (workspacesResult.data?.workspaces || []).find(
      (row) => row.role === "owner" || row.role === "admin"
    );
    if (!manageableWorkspace?.workspace_id) {
      throw new Error(`No owner/admin workspace found for ${LOGIN_EMAIL}`);
    }
    workspaceId = manageableWorkspace.workspace_id;

    const workspaceSwitch = await evaluateWithNavigationRetry(page, async (targetWorkspaceId) => {
      const response = await fetch("/api/workspaces/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: targetWorkspaceId }),
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      return { ok: response.ok, status: response.status, data };
    }, workspaceId);
    if (!workspaceSwitch.ok) {
      throw new Error(
        `Failed to set current workspace (${workspaceSwitch.status}): ${JSON.stringify(workspaceSwitch.data)}`
      );
    }

    const workspaceContext = await evaluateWithNavigationRetry(page, async () => {
      const response = await fetch("/api/workspaces/current");
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      return { ok: response.ok, status: response.status, data };
    });
    if (!workspaceContext.ok) {
      throw new Error(
        `Failed to fetch current workspace context (${workspaceContext.status}): ${JSON.stringify(workspaceContext.data)}`
      );
    }
    if (!["owner", "admin"].includes(workspaceContext.data?.role)) {
      throw new Error(
        `Authenticated user is not owner/admin in selected workspace. Role: ${workspaceContext.data?.role}`
      );
    }

    await restRequest(
      `${supabaseUrl}/rest/v1/master_rfqs`,
      serviceKey,
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: {
          workspace_id: workspaceId,
          rfq_id: rfqId,
          thread_id: rfqThreadId,
          customer_email: "smoke@example.com",
          status: "Processing",
          pol: "SHENZHEN",
          pod: "JEBEL ALI",
          container_type: "40HQ",
          qty: "1",
          ready_date: "2026-03-25",
          service_type: "port-to-port",
          received_at: new Date().toISOString(),
        },
      }
    );

    await page.goto(`${BASE_URL}/agents`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("Agent name").fill(agentName);
    await page.getByPlaceholder("Agent email").fill(agentEmail);
    await page.getByRole("button", { name: /add agent/i }).click();
    await page.locator("tr", { hasText: agentName }).waitFor({ timeout: 15_000 });

    await page.getByRole("button", { name: `Edit ${agentName}` }).click();
    const agentEditRow = page
      .locator("tr")
      .filter({ has: page.getByRole("button", { name: "Save" }) })
      .first();
    await agentEditRow.locator("input").nth(1).fill(agentEmailUpdated);
    await agentEditRow.getByRole("button", { name: "Save" }).click();
    await page.locator("tr", { hasText: agentEmailUpdated }).waitFor({ timeout: 15_000 });

    await page.getByRole("button", { name: `Delete ${agentName}` }).click();
    if (!(await waitForRowRemoval(page, agentEmailUpdated))) {
      throw new Error("Agent row was not deleted");
    }

    await page.goto(`${BASE_URL}/pricing`, { waitUntil: "domcontentloaded" });

    await page.getByPlaceholder("Carrier").fill(doCarrier);
    await page.getByPlaceholder("Document").fill("111");
    await page.getByPlaceholder("20FT").first().fill("210");
    await page.getByPlaceholder("40FT").first().fill("320");
    await page.getByPlaceholder("40HQ").fill("340");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await page.locator("tr", { hasText: doCarrier }).waitFor({ timeout: 15_000 });

    await page.getByRole("button", { name: `Edit DO ${doCarrier}` }).click();
    const doEditRow = page
      .locator("tr")
      .filter({ has: page.getByRole("button", { name: "Save" }) })
      .first();
    await doEditRow.locator("input").nth(1).fill("222");
    await doEditRow.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(1_000);
    await page.getByRole("button", { name: `Delete DO ${doCarrier}` }).click();
    if (!(await waitForRowRemoval(page, doCarrier))) {
      throw new Error("DO charge row was not deleted");
    }

    await page.getByRole("tab", { name: /destination charges/i }).click();
    await page.getByPlaceholder("Charge Type").fill(destType);
    await page.getByPlaceholder("Basis").fill("per container");
    await page.getByPlaceholder("20FT").first().fill("50");
    await page.getByPlaceholder("40FT").first().fill("80");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await page.locator("tr", { hasText: destType }).waitFor({ timeout: 15_000 });

    await page.getByRole("button", { name: `Edit destination ${destType}` }).click();
    const destEditRow = page
      .locator("tr")
      .filter({ has: page.getByRole("button", { name: "Save" }) })
      .first();
    await destEditRow.locator("input").nth(1).fill("flat basis");
    await destEditRow.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(1_000);
    await page.getByRole("button", { name: `Delete destination ${destType}` }).click();
    if (!(await waitForRowRemoval(page, destType))) {
      throw new Error("Destination charge row was not deleted");
    }

    await page.getByRole("tab", { name: /transportation/i }).click();
    await page.getByPlaceholder("Place").fill(transportPlace);
    await page.getByPlaceholder("Price").fill("600");
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await page.locator("tr", { hasText: transportPlace }).waitFor({ timeout: 15_000 });

    await page.getByRole("button", { name: `Edit transport ${transportPlace}` }).click();
    const transportEditRow = page
      .locator("tr")
      .filter({ has: page.getByRole("button", { name: "Save" }) })
      .first();
    await transportEditRow.locator("input").nth(1).fill("777");
    await transportEditRow.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(1_000);
    await page.getByRole("button", { name: `Delete transport ${transportPlace}` }).click();
    if (!(await waitForRowRemoval(page, transportPlace))) {
      throw new Error("Transport charge row was not deleted");
    }

    await page.goto(`${BASE_URL}/rfqs`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("Search RFQ ID, customer email, route...").fill(rfqId);
    await page.getByRole("button", { name: `Delete RFQ ${rfqId}` }).click();
    await page.waitForTimeout(2_000);

    const deletedRows = await restRequest(
      `${supabaseUrl}/rest/v1/master_rfqs?select=rfq_id,deleted_at&workspace_id=eq.${workspaceId}&rfq_id=eq.${rfqId}`,
      serviceKey
    );

    if (!deletedRows?.[0]?.deleted_at) {
      throw new Error(`RFQ ${rfqId} was not soft-deleted`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          login_email: LOGIN_EMAIL,
          workspace_id: workspaceId,
          smoke_entities: {
            agent_name: agentName,
            do_carrier: doCarrier,
            destination_type: destType,
            transport_place: transportPlace,
            rfq_id: rfqId,
          },
          rfq_deleted_at: deletedRows[0].deleted_at,
        },
        null,
        2
      )
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
