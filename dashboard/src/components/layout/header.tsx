"use client";

import { useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileNav } from "./mobile-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

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
    <header className="flex h-24 shrink-0 items-center justify-between px-8 bg-transparent">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div className="pl-1 text-left hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-white leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Search Bar */}
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-4 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search"
            className="h-11 w-64 rounded-full bg-white dark:bg-black/20 pl-11 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10"
          />
        </div>

        {/* Notifications */}
        <button className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-black/20 hover:bg-gray-50 dark:hover:bg-black/40 transition-colors">
          <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-[#1A1A1A]" />
          <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-full hover:bg-black/5 dark:hover:bg-white/5 p-1 pr-3 transition-colors outline-none cursor-pointer">
              <Avatar className="h-10 w-10 border-2 border-white dark:border-[#1A1A1A] shadow-sm">
                <AvatarImage src="https://i.pravatar.cc/150?u=ethan" />
                <AvatarFallback>EM</AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Ethan Moore</p>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Logist</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
