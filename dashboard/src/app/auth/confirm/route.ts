import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserWorkspaceBootstrap } from "@/lib/workspaces";
import { acceptWorkspaceInviteForUser } from "@/lib/workspace-invites";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null
    const next = searchParams.get('next') ?? searchParams.get("callbackUrl") ?? '/'
    const inviteToken = searchParams.get("invite");

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

    if (token_hash && type) {
        const supabase = await createClient()

        const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        })

        if (!error) {
            // redirect user to specified redirect URL or root of app
            const {
                data: { user },
            } = await supabase.auth.getUser();
            let workspaceId = user ? await ensureUserWorkspaceBootstrap(user) : null;
            if (user && inviteToken) {
                const inviteResult = await acceptWorkspaceInviteForUser(
                    supabase,
                    user,
                    inviteToken
                );
                if (inviteResult.workspaceId) {
                    workspaceId = inviteResult.workspaceId;
                } else if (inviteResult.error) {
                    console.error("Invite acceptance failed during auth confirm:", inviteResult.error);
                }
            }

            const response = NextResponse.redirect(`${getURL()}${next.replace(/^\//, '')}`)
            if (workspaceId) {
                response.cookies.set("workspace_id", workspaceId, {
                    httpOnly: true,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    path: "/",
                    maxAge: 60 * 60 * 24 * 30,
                });
            }
            return response
        }

        console.error("Auth confirm error:", error.message);
        return NextResponse.redirect(`${getURL()}login?error=${encodeURIComponent(error.message)}`)
    }

    // redirect the user to an error page with some instructions
    return NextResponse.redirect(`${getURL()}login?error=Invalid%20magic%20link`)
}
