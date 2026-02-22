"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  PieChart,
  Truck,
  BarChart2,
  HelpCircle,
  Settings,
  LogOut,
  LayoutGrid,
} from "lucide-react";

const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/statistics", label: "Statistics", icon: PieChart },
  { href: "/shipments", label: "Shipments", icon: Truck },
  { href: "/reports", label: "Reports", icon: BarChart2 },
];

const accountItems = [
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/settings/account", label: "Settings", icon: Settings },
  { href: "/logout", label: "Log out", icon: LogOut, action: "logout" },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const NavItem = ({ item }: { item: any }) => {
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
            ? "bg-[#2A2B2F] text-white shadow-md dark:bg-white dark:text-black"
            : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
        )}
      >
        <item.icon className={cn("h-5 w-5", isActive ? "text-white dark:text-black" : "")} />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex flex-col w-[260px] bg-transparent border-r border-[#E5E7EB] dark:border-white/10 h-screen overflow-hidden z-40">
      <div className="flex h-24 items-center gap-3 px-8 mt-2">
        <Truck className="h-7 w-7 text-black dark:text-white fill-current" />
        <span className="text-xl font-bold tracking-tight text-black dark:text-white">Atlas</span>
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
