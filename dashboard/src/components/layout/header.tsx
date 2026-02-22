"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MobileNav } from "./mobile-nav";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface HeaderProps {
  title: string;
  description?: string;
}

type Workspace = {
  workspace_id: string;
  role: string;
  name: string;
};

export function Header({ title, description }: HeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as {
      workspaces: Workspace[];
      currentWorkspaceId: string | null;
    };

    setWorkspaces(data.workspaces || []);
    setCurrentWorkspaceId(
      data.currentWorkspaceId || data.workspaces?.[0]?.workspace_id || ""
    );
  }, []);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.workspace_id === currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  );

  const handleWorkspaceChange = async (workspaceId: string) => {
    const response = await fetch("/api/workspaces/current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    if (!response.ok) {
      toast.error("Failed to switch workspace");
      return;
    }
    setCurrentWorkspaceId(workspaceId);
    queryClient.clear();
    router.refresh();
  };

  const handleLogout = async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      toast.error("Failed to sign out");
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  const handleCreateWorkspace = async () => {
    const name = workspaceName.trim();
    if (!name) {
      toast.error("Workspace name is required");
      return;
    }

    setCreatingWorkspace(true);
    try {
      const createResponse = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!createResponse.ok) {
        toast.error("Failed to create workspace");
        return;
      }

      const payload = (await createResponse.json()) as {
        workspace?: Workspace;
      };

      const nextWorkspaceId = payload.workspace?.workspace_id;
      if (!nextWorkspaceId) {
        toast.error("Workspace created but response was incomplete");
        return;
      }

      const selectResponse = await fetch("/api/workspaces/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: nextWorkspaceId }),
      });

      if (!selectResponse.ok) {
        toast.error("Workspace created but could not switch context");
        return;
      }

      await loadWorkspaces();
      setWorkspaceName("");
      setCreateOpen(false);
      queryClient.clear();
      router.refresh();
      toast.success("Workspace created");
    } catch (error) {
      console.error("Failed to create workspace:", error);
      toast.error("Failed to create workspace");
    } finally {
      setCreatingWorkspace(false);
    }
  };

  return (
    <header className="sticky top-4 z-50 mx-4 md:mx-6 flex h-16 items-center justify-between px-6 bg-card/60 dark:bg-card/40 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] rounded-3xl transition-all duration-500">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div className="pl-1">
          <h1 className="text-base md:text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{title}</h1>
          {description && (
            <p className="text-xs md:text-sm text-muted-foreground/80 font-medium hidden sm:block">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {workspaces.length > 0 && (
          <Select value={currentWorkspaceId} onValueChange={handleWorkspaceChange}>
            <SelectTrigger className="hidden h-8 w-[220px] md:flex">
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Open notifications"
          title="Open notifications"
        >
          <Bell className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open account menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">PM</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {currentWorkspace?.name || "Workspace"}
            </DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/workspace">Workspace Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/account">Account Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/members">Members & Invites</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <UserCircle2 className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace for your team and switch into it immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Workspace name"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creatingWorkspace}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateWorkspace} disabled={creatingWorkspace}>
              {creatingWorkspace ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
