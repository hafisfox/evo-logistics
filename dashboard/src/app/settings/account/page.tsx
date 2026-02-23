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
    <div className="max-w-2xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveProfile} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email ?? ""} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile?.full_name ?? ""}
                placeholder="Your full name"
              />
            </div>
            <Button type="submit">Save Profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            MFA status: {profile?.mfa_enabled ? "Enabled" : "Optional (not enabled)"}
          </p>
          <form action={updateMfa}>
            <input
              type="hidden"
              name="enabled"
              value={profile?.mfa_enabled ? "false" : "true"}
            />
            <Button type="submit" variant="outline">
              {profile?.mfa_enabled ? "Disable MFA" : "Enable MFA"}
            </Button>
          </form>
          <form action={revokeSessions}>
            <Button type="submit" variant="outline">
              Revoke All Sessions
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deletion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Soft delete starts a 30-day recovery window for your account data.
          </p>
          <form action={softDelete}>
            <Button type="submit" variant="destructive">
              Request Account Deletion
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

