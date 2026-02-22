import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const scope = await requireWorkspaceApiContext({ allowNoWorkspace: true });
  if (scope.response?.status === 401) {
    redirect("/login");
  }

  const workspaceId = scope.context?.workspaceId ?? null;
  let mailboxStatus = "disconnected";
  let mailboxEmail: string | null = null;
  let mailboxError: string | null = null;

  if (workspaceId) {
    const supabase = await createClient();
    const { data: mailbox } = await supabase
      .from("workspace_mailboxes")
      .select("status, email, last_error")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    mailboxStatus = mailbox?.status ?? "disconnected";
    mailboxEmail = mailbox?.email ?? null;
    mailboxError = mailbox?.last_error ?? null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Workspace Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your account is ready. Continue with these setup steps before enabling full
            automation.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Create or join a workspace.</li>
            <li>Connect a workspace mailbox for automations.</li>
            <li>Verify workspace settings, pricing tables, and agents.</li>
          </ol>
          <div className="rounded border bg-background p-3 text-sm">
            <p className="font-medium">Mailbox status: {mailboxStatus}</p>
            {mailboxEmail && <p className="text-muted-foreground">{mailboxEmail}</p>}
            {mailboxError && <p className="text-destructive">{mailboxError}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <Button asChild>
              <Link href="/">Open Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/workspace">Workspace Settings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
