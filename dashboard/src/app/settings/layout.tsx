"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsNavItems = [
    { href: "/settings/workspace", label: "Workspace Settings" },
    { href: "/settings/members", label: "Members & Invites" },
    { href: "/settings/account", label: "Account Details" },
];

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col space-y-8 p-6 max-w-5xl mx-auto">
            <div className="flex flex-col space-y-4">
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your workspace, members, and personal account settings.
                </p>
            </div>

            <div className="flex space-x-1 border-b border-black/5 dark:border-white/5 pb-2">
                {settingsNavItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 whitespace-nowrap",
                                isActive
                                    ? "bg-foreground text-background shadow-md shadow-black/10 hover:shadow-lg hover:-translate-y-0.5"
                                    : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
                            )}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>

            <div className="flex-1">
                {children}
            </div>
        </div>
    );
}
