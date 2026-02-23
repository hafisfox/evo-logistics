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
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading workspaces...</p>
          ) : (
            <Select value={workspaceId} onValueChange={switchWorkspace}>
              <SelectTrigger className="max-w-sm">
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
            <p className="mt-2 text-xs text-muted-foreground">
              Your role: {activeWorkspace.role}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite Member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="teammate@company.com"
            />
          </div>
          <div className="max-w-xs space-y-2">
            <Label>Role</Label>
            <Select
              value={inviteRole}
              onValueChange={(value) => setInviteRole(value as "admin" | "member")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={sendInvite}>Send Invite</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded border p-3"
              >
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{member.user_id}</p>
                  <p className="text-xs text-muted-foreground">{member.status}</p>
                </div>
                <Select
                  value={member.role}
                  onValueChange={(value) =>
                    updateRole(member.id, value as "owner" | "admin" | "member")
                  }
                >
                  <SelectTrigger className="w-32">
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

      <Card>
        <CardHeader>
          <CardTitle>Invites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites sent yet.</p>
          ) : (
            invites.map((invite) => (
              <div key={invite.id} className="rounded border p-3 text-sm">
                <p>{invite.email}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.role} • {invite.status} • expires{" "}
                  {new Date(invite.expires_at).toLocaleDateString()}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  /signup?invite={invite.invite_token}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

