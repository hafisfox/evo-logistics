import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginHashSessionHandler } from "../login/hash-session-handler";

const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ??
    process?.env?.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
    process?.env?.NEXT_PUBLIC_VERCEL_URL ??
    process?.env?.VERCEL_PROJECT_PRODUCTION_URL ??
    process?.env?.VERCEL_URL ??
    "http://localhost:3000/";
  url = url.includes("http") ? url : `https://${url}`;
  url = url.endsWith("/") ? url : `${url}/`;
  return url;
};

export default async function SignupPage(props: {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    message?: string;
    invite?: string;
    code?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const callbackTarget = searchParams.callbackUrl || "/";
  const inviteToken = typeof searchParams.invite === "string" ? searchParams.invite.trim() : "";
  const encodedInvite = inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : "";

  if (searchParams.code) {
    const callbackParams = new URLSearchParams({
      code: searchParams.code,
      next: callbackTarget,
    });
    if (inviteToken) {
      callbackParams.set("invite", inviteToken);
    }
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect(searchParams.callbackUrl || "/");
  }

  const handleEmailSignup = async (formData: FormData) => {
    "use server";
    const email = formData.get("email") as string;
    const supabaseServer = await createClient();
    const redirectTo = `${getURL()}auth/confirm?next=${encodeURIComponent(callbackTarget)}${encodedInvite}`;

    const { error } = await supabaseServer.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      redirect(`/signup?error=${encodeURIComponent(error.message)}`);
    }
    redirect("/signup?message=Check your email to complete signup");
  };

  const handleGoogleSignup = async () => {
    "use server";
    const supabaseServer = await createClient();
    const redirectTo = `${getURL()}auth/callback?next=${encodeURIComponent(callbackTarget)}${encodedInvite}`;
    const { data, error } = await supabaseServer.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      redirect(`/signup?error=${encodeURIComponent(error.message)}`);
    }

    if (data.url) {
      redirect(data.url);
    }

    redirect("/signup?error=Google%20signup%20failed");
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black">
      <LoginHashSessionHandler callbackUrl={callbackTarget} />
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[370px]">
        <div className="flex flex-col space-y-2 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 ring-1 ring-cyan-500/30">
              <Shield className="h-6 w-6 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tighter text-white">
            Create your workspace account
          </h1>
          <p className="text-sm text-slate-400">
            Sign up with email magic link or Google
          </p>
        </div>

        <div className="grid gap-6">
          {searchParams.error && (
            <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-center text-sm text-red-400">
              {searchParams.error}
            </div>
          )}
          {searchParams.message && (
            <div className="rounded-md border border-cyan-500/50 bg-cyan-500/10 p-3 text-center text-sm text-cyan-400">
              {searchParams.message}
            </div>
          )}
          <form action={handleEmailSignup}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label className="sr-only" htmlFor="email">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  placeholder="name@example.com"
                  type="email"
                  autoComplete="email"
                  required
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/50"
                />
              </div>
              <Button type="submit" className="bg-cyan-500 font-semibold text-black hover:bg-cyan-400">
                Continue with Email
              </Button>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-black px-2 text-slate-400">Or continue with</span>
            </div>
          </div>

          <form action={handleGoogleSignup}>
            <Button
              variant="outline"
              type="submit"
              className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              Google
            </Button>
          </form>
        </div>

        <p className="px-8 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
