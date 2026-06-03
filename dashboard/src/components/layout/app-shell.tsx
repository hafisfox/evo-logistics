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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out fill-mode-both h-full w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
