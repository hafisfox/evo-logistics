import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";

type MailboxStatus = "connected" | "disconnected";

interface MailboxPayload {
  email: string;
  status?: MailboxStatus;
}

function sanitizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseMailboxPayload(body: unknown): { data?: MailboxPayload; error?: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid mailbox payload" };
  }

  const email =
    "email" in body && typeof body.email === "string" ? sanitizeEmail(body.email) : "";
  const status =
    "status" in body && typeof body.status === "string" ? body.status : "connected";

  if (!email || !isValidEmail(email)) {
    return { error: "Invalid mailbox payload" };
  }

  if (status !== "connected" && status !== "disconnected") {
    return { error: "Invalid mailbox payload" };
  }

  return { data: { email, status } };
}

export async function GET() {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_mailboxes")
    .select("email, status, watch_expiration, last_error, updated_at")
    .eq("workspace_id", scope.context.workspaceId)
    .maybeSingle();

  if (error) {
    console.error("Failed to read workspace mailbox:", error);
    return NextResponse.json({ error: "Failed to load mailbox settings" }, { status: 500 });
  }

  return NextResponse.json({ mailbox: data ?? null });
}

export async function POST(request: Request) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid mailbox payload" }, { status: 400 });
  }

  const parsed = parseMailboxPayload(body);
  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error || "Invalid mailbox payload" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_mailboxes")
    .upsert(
      {
        workspace_id: scope.context.workspaceId,
        email: parsed.data.email,
        status: parsed.data.status,
        last_error: parsed.data.status === "connected" ? null : undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" }
    )
    .select("email, status, watch_expiration, last_error, updated_at")
    .single();

  if (error) {
    console.error("Failed to update workspace mailbox:", error);
    return NextResponse.json({ error: "Failed to update mailbox settings" }, { status: 500 });
  }

  return NextResponse.json({ success: true, mailbox: data });
}
