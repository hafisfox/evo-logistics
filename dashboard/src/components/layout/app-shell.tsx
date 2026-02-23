"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Do not render the sidebar or main layout shell on auth/onboarding pages
  if (pathname === "/login" || pathname === "/signup" || pathname === "/onboarding") {
    return <>{children}</>;
  }

  // Determine title based on pathname
  const getTitle = () => {
    if (pathname === "/") return "Dashboard";
    if (pathname.startsWith("/rfqs")) return "RFQ Pipeline";
    if (pathname.startsWith("/agents")) return "Agents";
    if (pathname.startsWith("/pricing")) return "Pricing Tables";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Dashboard";
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
        <Header title={getTitle()} />
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
