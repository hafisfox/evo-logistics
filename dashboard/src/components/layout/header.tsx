"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MobileNav } from "./mobile-nav";
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) return;
      const data = (await res.json()) as {
        workspaces: Workspace[];
        currentWorkspaceId: string | null;
      };

      setWorkspaces(data.workspaces || []);
      setCurrentWorkspaceId(
        data.currentWorkspaceId || data.workspaces?.[0]?.workspace_id || ""
      );
    })();
  }, []);

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.workspace_id === currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  );

  const handleWorkspaceChange = async (workspaceId: string) => {
    await fetch("/api/workspaces/current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    setCurrentWorkspaceId(workspaceId);
    router.refresh();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="flex items-center">
        <MobileNav />
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground hidden sm:block">{description}</p>
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
    </header>
  );
}
