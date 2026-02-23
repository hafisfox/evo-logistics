"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutGrid,
  ClipboardList,
  Users,
  DollarSign,
  Settings,
  LogOut,
  Ship,
} from "lucide-react";

const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/rfqs", label: "RFQ Pipeline", icon: ClipboardList },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/pricing", label: "Pricing Tables", icon: DollarSign },
];

const accountItems = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/logout", label: "Log out", icon: LogOut, action: "logout" },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const NavItem = ({ item }: { item: { href: string; label: string; icon: React.ElementType; action?: string } }) => {
    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

    if (item.action === "logout") {
      return (
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </button>
      );
    }

    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <item.icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "")} />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex flex-col w-[260px] bg-card border-r border-border h-screen overflow-hidden z-40 shrink-0">
      <div className="flex h-24 items-center gap-3 px-8 mt-2">
        <Ship className="h-7 w-7 text-black dark:text-white" />
        <span className="text-xl font-bold tracking-tight text-black dark:text-white">Evo Logistics</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-2 pb-24 space-y-8 scrollbar-hide">
        {/* Menu Section */}
        <div className="space-y-2">
          <h3 className="px-4 text-xs font-semibold tracking-wider text-muted-foreground/50 uppercase mb-4">Menu</h3>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
          </nav>
        </div>

        {/* Account Section */}
        <div className="space-y-2">
          <h3 className="px-4 text-xs font-semibold tracking-wider text-muted-foreground/50 uppercase mb-4">Account</h3>
          <nav className="space-y-1">
            {accountItems.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
          </nav>
        </div>
      </div>

      <div className="p-6 mt-auto">
        <div className="bg-[#E5E7EB]/50 dark:bg-white/5 rounded-full p-1 inline-flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
