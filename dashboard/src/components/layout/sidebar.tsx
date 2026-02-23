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
          "group flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 relative overflow-hidden",
          isActive
            ? "text-primary dark:text-white bg-primary/5 dark:bg-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
            : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:translate-x-1"
        )}
      >
        {isActive ? (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
        ) : null}
        {isActive ? (
          <div className="absolute inset-0 bg-primary/10 dark:bg-primary/20 opacity-50" />
        ) : null}
        <item.icon className={cn("h-5 w-5 relative z-10 transition-colors", isActive ? "text-primary dark:text-white" : "group-hover:text-foreground")} />
        <span className="relative z-10">{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex flex-col w-[260px] bg-card border-r border-black/5 dark:border-white/5 h-screen overflow-hidden z-40 shrink-0">
      <div className="flex h-24 items-center gap-3 px-8 mt-2">
        <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Ship className="h-6 w-6 text-primary" />
        </div>
        <span className="text-xl font-bold tracking-tight text-foreground">Evo Logistics</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 pb-24 space-y-8 scrollbar-hide">
        {/* Menu Section */}
        <div className="space-y-1">
          <h3 className="px-4 text-[11px] font-bold tracking-[0.15em] text-muted-foreground/60 uppercase mb-3">Menu</h3>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
          </nav>
        </div>

        {/* Account Section */}
        <div className="space-y-1">
          <h3 className="px-4 text-[11px] font-bold tracking-[0.15em] text-muted-foreground/60 uppercase mb-3">Account</h3>
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
