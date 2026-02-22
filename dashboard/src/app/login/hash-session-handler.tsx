"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

function sanitizeCallbackUrl(callbackUrl: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/";
  }
  return callbackUrl;
}

interface LoginHashSessionHandlerProps {
  callbackUrl: string;
}

export function LoginHashSessionHandler({ callbackUrl }: LoginHashSessionHandlerProps) {
  const router = useRouter();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) return;

    const supabase = createClient();
    const next = sanitizeCallbackUrl(callbackUrl);

    void (async () => {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error("Failed to set session from hash tokens:", error.message);
        return;
      }

      // Remove sensitive tokens from URL fragment before redirecting.
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      router.replace(next);
      router.refresh();
    })();
  }, [callbackUrl, router]);

  return null;
}

