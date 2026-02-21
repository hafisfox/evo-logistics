import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const getURL = () => {
    let url =
        process?.env?.NEXT_PUBLIC_SITE_URL ??
        process?.env?.NEXT_PUBLIC_VERCEL_URL ??
        'http://localhost:3000/';
    url = url.includes('http') ? url : `https://${url}`;
    url = url.endsWith('/') ? url : `${url}/`;
    return url;
};

export default async function LoginPage(props: {
    searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
    const searchParams = await props.searchParams;
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    // If already authenticated, redirect to callbackUrl or home
    if (session) {
        redirect(searchParams.callbackUrl || "/");
    }

    // Server Action to handle Email Sign In (Magic Link)
    const handleEmailSignIn = async (formData: FormData) => {
        "use server";
        const email = formData.get("email") as string;
        const supabaseServer = await createClient();

        const redirectTo = `${getURL()}auth/confirm?callbackUrl=${searchParams.callbackUrl || "/"}`;

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

        const redirectTo = `${getURL()}auth/callback?next=${searchParams.callbackUrl || "/"}`;

        const { data, error } = await supabaseServer.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo,
            },
        });

        if (data.url) {
            redirect(data.url);
        }
    };

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-black">


            <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                <div className="flex flex-col space-y-2 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 rounded-full bg-cyan-500/10 flex items-center justify-center ring-1 ring-cyan-500/30">
                            <Shield className="h-6 w-6 text-cyan-400" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tighter text-white">
                        Evo Logistics Auth
                    </h1>
                    <p className="text-sm text-slate-400">
                        Enter your email to receive a magic link
                    </p>
                </div>

                <div className="grid gap-6">
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
                                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/50"
                                />
                            </div>
                            <Button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold">
                                Send Magic Link
                            </Button>
                        </div>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-black px-2 text-slate-400">
                                Or continue with
                            </span>
                        </div>
                    </div>

                    <form action={handleGoogleSignIn}>
                        <Button variant="outline" type="submit" className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white">
                            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                            </svg>
                            Google
                        </Button>
                    </form>
                </div>

                <p className="px-8 text-center text-sm text-slate-500">
                    By clicking continue, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
