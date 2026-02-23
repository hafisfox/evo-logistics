"use client";

import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import Link from "next/link";
import { Settings } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      toast.error("Failed to sign out");
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="flex h-20 shrink-0 items-center justify-between px-6 md:px-8 border-b border-white/10 dark:border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
      {/* Left: mobile nav + page title */}
      <div className="flex items-center gap-3">
        <MobileNav />
        <div>
          <h1 className="text-xl font-bold tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {/* Right: theme toggle + user menu */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 p-1.5 pr-3 transition-colors outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/50">
              <Avatar className="h-8 w-8 ring-1 ring-black/10 dark:ring-white/10 ring-offset-background ring-offset-2">
                <AvatarImage src="https://i.pravatar.cc/150?u=evo" />
                <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">EL</AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm font-medium">Account</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-xl border-black/5 dark:border-white/10 backdrop-blur-xl bg-background/95">
            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
              <Link href="/settings/account" className="flex items-center gap-3 py-2 px-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Settings className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Settings</span>
                  <span className="text-xs text-muted-foreground">Manage preferences</span>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-2 opacity-50" />
            <DropdownMenuItem onClick={handleLogout} className="rounded-xl cursor-pointer py-2.5 px-3 text-destructive focus:bg-destructive/10 focus:text-destructive">
              Sign out of application
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
