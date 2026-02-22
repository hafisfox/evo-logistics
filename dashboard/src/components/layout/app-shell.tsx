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
    switch (pathname) {
      case "/": return "Dashboard Overview";
      case "/statistics": return "Statistics";
      case "/shipments": return "Shipments";
      case "/reports": return "Reports";
      default: return "Dashboard Overview";
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#EAE8E3] dark:bg-[#111111] overflow-hidden p-4 md:p-6 lg:p-8">
      <div className="flex w-full max-w-[1600px] mx-auto bg-[#F4F2EE] dark:bg-[#1A1A1A] rounded-[32px] overflow-hidden shadow-2xl border border-white/50 dark:border-white/5">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden w-full relative">
          <Header title={getTitle()} />
          <div className="flex-1 overflow-y-auto p-8 pt-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
