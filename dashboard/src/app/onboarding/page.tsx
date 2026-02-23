import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/server";
import { ensureUserWorkspaceBootstrap } from "@/lib/workspaces";

interface OnboardingPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const scope = await requireWorkspaceApiContext({ allowNoWorkspace: true });
  if (scope.response?.status === 401) {
    redirect("/login");
  }

  const workspaceId = scope.context?.workspaceId ?? null;
  let mailboxStatus = "disconnected";
  let mailboxEmail: string | null = null;
  let mailboxError: string | null = null;

  const createWorkspaceAction = async () => {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      redirect("/login");
    }

    const createdWorkspaceId = await ensureUserWorkspaceBootstrap(user);
    if (!createdWorkspaceId) {
      redirect("/onboarding?error=workspace_bootstrap_failed");
    }

    (await cookies()).set("workspace_id", createdWorkspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    redirect("/");
  };

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
    <div className="flex min-h-[100dvh] w-full items-center justify-center p-4">
      <Card className="w-full max-w-xl rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-xl p-4 md:p-8 shadow-[0_8px_24px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_24px_rgba(255,255,255,0.03)] overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold tracking-tight text-center md:text-left">Workspace Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {params.error && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive">
              We could not create your workspace yet. Click <strong>Create Workspace</strong>{" "}
              again after applying the latest database migration.
            </div>
          )}
          <p className="text-[15px] font-medium text-muted-foreground/90">
            Your account is ready. Continue with these setup steps before enabling full
            automation.
          </p>
          <ol className="space-y-3 pl-2 text-sm counter-reset-step">
            <li className="flex items-start gap-4 before:content-[counter(step)] before:counter-increment-[step] before:flex before:h-6 before:w-6 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-primary/10 before:text-primary before:text-xs before:font-bold">
              <span className="leading-6 font-medium">Create or join a workspace.</span>
            </li>
            <li className="flex items-start gap-4 before:content-[counter(step)] before:counter-increment-[step] before:flex before:h-6 before:w-6 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-primary/10 before:text-primary before:text-xs before:font-bold">
              <span className="leading-6 font-medium">Connect a workspace mailbox via Google OAuth in Workspace Settings.</span>
            </li>
            <li className="flex items-start gap-4 before:content-[counter(step)] before:counter-increment-[step] before:flex before:h-6 before:w-6 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-primary/10 before:text-primary before:text-xs before:font-bold">
              <span className="leading-6 font-medium">Verify workspace settings, pricing tables, and agents.</span>
            </li>
          </ol>
          <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/5 p-5 text-sm shadow-inner mt-4">
            <p className="font-semibold tracking-tight">Mailbox status: <span className="opacity-90 font-medium">{mailboxStatus}</span></p>
            {mailboxEmail && <p className="text-muted-foreground mt-1">{mailboxEmail}</p>}
            {mailboxError && <p className="text-destructive mt-1">{mailboxError}</p>}
          </div>
          {workspaceId ? (
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button asChild className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                <Link href="/">Open Dashboard</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/5 text-foreground hover:bg-white/20 dark:hover:bg-white/10 shadow-sm transition-all duration-300">
                <Link href="/settings/workspace">Workspace Settings</Link>
              </Button>
            </div>
          ) : (
            <div className="pt-4">
              <form action={createWorkspaceAction}>
                <Button type="submit" className="w-full sm:w-auto h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">Create Workspace</Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
