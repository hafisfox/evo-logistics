"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Workspace = {
  workspace_id: string;
  role: "owner" | "admin" | "member" | string;
  name: string;
  slug: string;
  kind: string;
};

type Member = {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  status: string;
  created_at: string;
};

type Invite = {
  id: string;
  email: string;
  role: "admin" | "member";
  status: string;
  invite_token: string;
  expires_at: string;
};

export default function MembersSettingsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [loading, setLoading] = useState(true);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.workspace_id === workspaceId) ?? null,
    [workspaces, workspaceId]
  );

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        workspaces: Workspace[];
        currentWorkspaceId: string | null;
      };
      setWorkspaces(data.workspaces || []);
      const selected = data.currentWorkspaceId || data.workspaces?.[0]?.workspace_id || "";
      setWorkspaceId(selected);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;

    void (async () => {
      const [membersRes, invitesRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`),
        fetch(`/api/workspaces/${workspaceId}/invites`),
      ]);

      if (membersRes.ok) {
        const data = (await membersRes.json()) as { members: Member[] };
        setMembers(data.members || []);
      }

      if (invitesRes.ok) {
        const data = (await invitesRes.json()) as { invites: Invite[] };
        setInvites(data.invites || []);
      }
    })();
  }, [workspaceId]);

  const switchWorkspace = async (nextWorkspaceId: string) => {
    await fetch("/api/workspaces/current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: nextWorkspaceId }),
    });
    setWorkspaceId(nextWorkspaceId);
  };

  const sendInvite = async () => {
    if (!workspaceId || !inviteEmail.trim()) return;

    const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail.trim(),
        role: inviteRole,
      }),
    });

    if (!res.ok) return;

    const data = (await res.json()) as { invite: Invite };
    setInvites((current) => [data.invite, ...current]);
    setInviteEmail("");
  };

  const updateRole = async (memberId: string, role: "owner" | "admin" | "member") => {
    if (!workspaceId) return;

    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: memberId,
        role,
      }),
    });

    if (!res.ok) return;

    setMembers((rows) => rows.map((row) => (row.id === memberId ? { ...row, role } : row)));
  };

  return (
    <div className="max-w-2xl space-y-6 md:space-y-8 p-4 md:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-700">
      <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-lg font-bold tracking-tight">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading workspaces...
            </div>
          ) : (
            <Select value={workspaceId} onValueChange={switchWorkspace}>
              <SelectTrigger className="max-w-sm h-11 rounded-xl bg-black/5 dark:bg-white/5 border-transparent focus:ring-1 focus:ring-primary/50">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.workspace_id} value={workspace.workspace_id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {activeWorkspace && (
            <div className="inline-flex items-center rounded-full border border-black/10 dark:border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              Role: <span className="ml-1 text-foreground">{activeWorkspace.role}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-lg font-bold tracking-tight">Invite Member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-email" className="text-sm font-medium text-muted-foreground">Email</Label>
              <Input
                id="invite-email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@company.com"
                className="h-11 rounded-xl border-black/10 dark:border-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
              />
            </div>
            <div className="w-full sm:w-[140px] space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as "admin" | "member")}
              >
                <SelectTrigger className="h-11 rounded-xl border-black/10 dark:border-white/10 focus:ring-1 focus:ring-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={sendInvite} className="mt-2 h-11 w-full sm:w-auto rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            Send Invite
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-6 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold tracking-tight">Members</CardTitle>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-xs font-medium text-muted-foreground">
            {members.length}
          </span>
        </CardHeader>
        <CardContent className="space-y-3 px-6 pb-6">
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl border border-dashed border-black/10 dark:border-white/10">
              <p className="text-sm font-medium">No members found.</p>
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-black/5 dark:border-white/5 bg-background/50 p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <p className="font-mono text-xs font-semibold text-foreground">{member.user_id}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <p className="text-xs font-medium text-muted-foreground capitalize">{member.status}</p>
                  </div>
                </div>
                <Select
                  value={member.role}
                  onValueChange={(value) =>
                    updateRole(member.id, value as "owner" | "admin" | "member")
                  }
                >
                  <SelectTrigger className="w-full sm:w-32 h-9 rounded-xl border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-6 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold tracking-tight">Invites</CardTitle>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 dark:border-white/5 text-xs font-medium text-muted-foreground">
            {invites.length}
          </span>
        </CardHeader>
        <CardContent className="space-y-3 px-6 pb-6">
          {invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl border border-dashed border-black/10 dark:border-white/10">
              <p className="text-sm font-medium">No invites sent yet.</p>
            </div>
          ) : (
            invites.map((invite) => (
              <div key={invite.id} className="group rounded-2xl border border-black/5 dark:border-white/5 bg-background/50 p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20" />
                <p className="font-semibold text-sm text-foreground">{invite.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="bg-black/5 dark:bg-white/5 px-2 rounded-md py-0.5">{invite.role}</span>
                  <span>•</span>
                  <span className="text-amber-500">{invite.status}</span>
                  <span>•</span>
                  <span>Expires {new Date(invite.expires_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-3 bg-black/5 dark:bg-white/5 p-2 rounded-xl flex items-center justify-between gap-4">
                  <p className="font-mono text-[10px] text-muted-foreground truncate">
                    /signup?invite={invite.invite_token}
                  </p>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground">Copy linking</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

