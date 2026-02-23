import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, mfa_enabled, deleted_at")
    .eq("id", user.id)
    .maybeSingle();

  const saveProfile = async (formData: FormData) => {
    "use server";
    const supabaseServer = await createClient();
    const {
      data: { user: activeUser },
    } = await supabaseServer.auth.getUser();

    if (!activeUser) redirect("/login");

    const fullName = String(formData.get("full_name") || "").trim();
    await supabaseServer.from("user_profiles").upsert(
      {
        id: activeUser.id,
        full_name: fullName || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    redirect("/settings/account");
  };

  const updateMfa = async (formData: FormData) => {
    "use server";
    const supabaseServer = await createClient();
    const {
      data: { user: activeUser },
    } = await supabaseServer.auth.getUser();
    if (!activeUser) redirect("/login");

    const enabled = formData.get("enabled") === "true";
    await supabaseServer.from("user_profiles").upsert(
      {
        id: activeUser.id,
        mfa_enabled: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    redirect("/settings/account");
  };

  const revokeSessions = async () => {
    "use server";
    const supabaseServer = await createClient();
    await supabaseServer.auth.signOut({ scope: "global" });
    redirect("/login?message=All sessions revoked. Please sign in again.");
  };

  const softDelete = async () => {
    "use server";
    const supabaseServer = await createClient();
    const {
      data: { user: activeUser },
    } = await supabaseServer.auth.getUser();
    if (!activeUser) redirect("/login");

    await supabaseServer.from("user_profiles").upsert(
      {
        id: activeUser.id,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    await supabaseServer.auth.signOut();
    redirect("/login?message=Account scheduled for deletion");
  };

  return (
    <div className="max-w-2xl space-y-6 md:space-y-8 p-4 md:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-700">
      <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-lg font-bold tracking-tight">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6">
          <form action={saveProfile} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">Email</Label>
              <Input id="email" value={user.email ?? ""} readOnly className="rounded-xl bg-black/5 dark:bg-white/5 border-transparent focus-visible:ring-1 focus-visible:ring-primary/50 cursor-not-allowed" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-sm font-medium text-muted-foreground">Full name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile?.full_name ?? ""}
                placeholder="Your full name"
                className="rounded-xl border-black/10 dark:border-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
              />
            </div>
            <div className="pt-2">
              <Button type="submit" className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">Save Profile</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-lg font-bold tracking-tight">Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-6">
          <p className="text-sm text-muted-foreground font-medium">
            MFA status: {profile?.mfa_enabled ? "Enabled" : "Optional (not enabled)"}
          </p>
          <div className="flex flex-wrap gap-3">
            <form action={updateMfa}>
              <input
                type="hidden"
                name="enabled"
                value={profile?.mfa_enabled ? "false" : "true"}
              />
              <Button type="submit" variant="outline" className="h-11 rounded-xl border-black/10 dark:border-white/10 bg-transparent text-foreground hover:bg-black/5 dark:hover:bg-white/5 shadow-sm transition-all">
                {profile?.mfa_enabled ? "Disable MFA" : "Enable MFA"}
              </Button>
            </form>
            <form action={revokeSessions}>
              <Button type="submit" variant="outline" className="h-11 rounded-xl border-black/10 dark:border-white/10 bg-transparent text-foreground hover:bg-black/5 dark:hover:bg-white/5 shadow-sm transition-all">
                Revoke All Sessions
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-destructive/20 bg-destructive/5 backdrop-blur-2xl shadow-sm overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-lg font-bold tracking-tight text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-6">
          <p className="text-sm font-medium text-destructive/80">
            Soft delete starts a 30-day recovery window for your account data.
          </p>
          <form action={softDelete}>
            <Button type="submit" variant="destructive" className="h-11 rounded-xl font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              Request Account Deletion
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

