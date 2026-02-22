import { redirect } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LoginHashSessionHandler } from "./hash-session-handler";

const getURL = () => {
    let url =
        process?.env?.NEXT_PUBLIC_SITE_URL ??
        process?.env?.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
        process?.env?.NEXT_PUBLIC_VERCEL_URL ??
        process?.env?.VERCEL_PROJECT_PRODUCTION_URL ??
        process?.env?.VERCEL_URL ??
        'http://localhost:3000/';
    url = url.includes('http') ? url : `https://${url}`;
    url = url.endsWith('/') ? url : `${url}/`;
    return url;
};

export default async function LoginPage(props: {
    searchParams: Promise<{
        callbackUrl?: string;
        error?: string;
        code?: string;
        message?: string;
        invite?: string;
    }>;
}) {
    const searchParams = await props.searchParams;
    const callbackTarget = searchParams.callbackUrl || "/";
    const inviteToken = typeof searchParams.invite === "string" ? searchParams.invite.trim() : "";
    const encodedInvite = inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : "";

    // If Supabase falls back to the Site URL, middleware redirects /?code=... to /login?code=...
    // We catch the code here and forward it to the proper callback route.
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
    let session = null;
    try {
        const {
            data: { session: activeSession },
            error,
        } = await supabase.auth.getSession();
        if (error) {
            console.error("Supabase session error:", error.message);
        }
        session = activeSession;
    } catch (error) {
        console.error("Supabase session exception:", error);
    }

    // If already authenticated, redirect to callbackUrl or home
    if (session) {
        redirect(callbackTarget);
    }

    // Server Action to handle Email Sign In (Magic Link)
    const handleEmailSignIn = async (formData: FormData) => {
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
            redirect(`/login?error=${encodeURIComponent(error.message)}`);
        } else {
            redirect(`/login?message=Check your email for the magic link`);
        }
    };

    // Server Action to handle Google Sign In
    const handleGoogleSignIn = async () => {
        "use server";
        const supabaseServer = await createClient();

        const redirectTo = `${getURL()}auth/callback?next=${encodeURIComponent(callbackTarget)}${encodedInvite}`;

        const { data, error } = await supabaseServer.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo,
            },
        });

        if (error) {
            redirect(`/login?error=${encodeURIComponent(error.message)}`);
        }

        if (data.url) {
            redirect(data.url);
        }

        redirect("/login?error=Google%20sign%20in%20failed");
    };

    return (
        <div className="flex min-h-[100dvh] w-full items-center justify-center p-4">
            <LoginHashSessionHandler callbackUrl={callbackTarget} />

            <div className="w-full max-w-[400px] rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] flex flex-col justify-center space-y-6 animate-in fade-in zoom-in-95 duration-700">
                <div className="flex flex-col space-y-2 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner border border-primary/10">
                            <Shield className="h-7 w-7 text-primary drop-shadow-sm" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Evo Logistics Sign In
                    </h1>
                    <p className="text-sm font-medium text-muted-foreground/80">
                        Sign in to your workspace dashboard
                    </p>
                </div>

                <div className="grid gap-6">
                    {searchParams.error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm text-center font-medium">
                            {searchParams.error}
                        </div>
                    )}
                    {searchParams.message && (
                        <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl text-primary text-sm text-center font-medium">
                            {searchParams.message}
                        </div>
                    )}
                    <form action={handleEmailSignIn}>
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
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    autoCorrect="off"
                                    required
                                    className="h-12 rounded-2xl bg-white/5 dark:bg-black/5 border-white/10 dark:border-white/5 text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-primary/50 shadow-inner px-4"
                                />
                            </div>
                            <Button type="submit" className="h-12 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                                Send Magic Link
                            </Button>
                        </div>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase font-medium">
                            <span className="bg-transparent px-2 text-muted-foreground/70">
                                Or continue with
                            </span>
                        </div>
                    </div>

                    <form action={handleGoogleSignIn}>
                        <Button variant="outline" type="submit" className="w-full h-12 rounded-2xl bg-white/5 dark:bg-black/5 border-white/10 dark:border-white/5 text-foreground hover:bg-white/20 dark:hover:bg-white/10 hover:text-foreground shadow-sm hover:shadow-md transition-all duration-300">
                            <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                            </svg>
                            Google
                        </Button>
                    </form>
                </div>

                <p className="px-8 text-center text-sm font-medium text-muted-foreground">
                    New here?{" "}
                    <Link
                        href={inviteToken ? `/signup?invite=${encodeURIComponent(inviteToken)}` : "/signup"}
                        className="text-primary hover:text-primary/80 transition-colors"
                    >
                        Create an account
                    </Link>
                </p>
            </div>
        </div>
    );
}
