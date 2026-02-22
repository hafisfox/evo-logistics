import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MasterRFQ, AgentQuote } from "@/types/rfq";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import type { ApiErrorPayload } from "@/lib/validation";

export const dynamic = "force-dynamic";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }
  const workspaceId = scope.context.workspaceId;

  try {
    const { rfqId } = await params;
    const supabase = await createClient();

    // Splitting queries to avoid Promise.all never inference issues with .single()
    const [rfqRes, quotesRes] = await Promise.all([
      supabase
        .from('master_rfqs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('rfq_id', rfqId)
        .is('deleted_at', null)
        .single(),
      supabase
        .from('agent_outbound_log')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('rfq_id', rfqId)
    ]);

    if (rfqRes.error && rfqRes.error.code !== 'PGRST116') {
      throw rfqRes.error;
    }

    if (quotesRes.error) throw quotesRes.error;

    const rfqData = rfqRes.data as unknown as MasterRFQ;

    if (!rfqData) {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    return NextResponse.json({
      rfq: rfqData as MasterRFQ,
      quotes: (quotesRes.data || []) as AgentQuote[]
    });
  } catch (error) {
    console.error("Failed to fetch RFQ detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch RFQ detail" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  try {
    const { rfqId } = await params;
    const deletedAt = new Date().toISOString();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("master_rfqs")
      .update({ deleted_at: deletedAt })
      .eq("workspace_id", scope.context.workspaceId)
      .eq("rfq_id", rfqId)
      .is("deleted_at", null)
      .select("rfq_id, deleted_at")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return jsonError({ error: "RFQ not found" }, 404);
      }
      throw error;
    }

    if (!data) {
      return jsonError({ error: "RFQ not found" }, 404);
    }

    return NextResponse.json({
      success: true,
      rfq_id: (data as { rfq_id: string }).rfq_id,
      deleted_at: (data as { deleted_at: string }).deleted_at,
    });
  } catch (error) {
    console.error("Failed to delete RFQ:", error);
    return jsonError({ error: "Failed to delete RFQ" }, 500);
  }
}
