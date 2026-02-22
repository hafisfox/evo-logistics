"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  DollarSign,
  Settings,
  Ship,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rfqs", label: "RFQ Pipeline", icon: ClipboardList },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/pricing", label: "Pricing Tables", icon: DollarSign },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 m-4 mr-0 rounded-3xl bg-card/60 dark:bg-card/40 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] h-[calc(100vh-2rem)] overflow-hidden transition-all duration-500 z-40">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border/50 px-6 bg-transparent">
        <Ship className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">Evo Logistics</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm hover:scale-[1.02]"
                  : "text-sidebar-foreground hover:bg-white/40 dark:hover:bg-sidebar-accent/50 hover:scale-[1.01]"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4 text-xs text-muted-foreground flex items-center justify-between">
        <span>FCL Pricing Engine v1.0</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
