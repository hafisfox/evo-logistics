import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserWorkspaceBootstrap } from "@/lib/workspaces";
import { acceptWorkspaceInviteForUser } from "@/lib/workspace-invites";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'
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

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
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
                    console.error("Invite acceptance failed during auth callback:", inviteResult.error);
                }
            }
            const response = NextResponse.redirect(`${getURL()}${next.replace(/^\//, '')}`);
            if (workspaceId) {
                response.cookies.set("workspace_id", workspaceId, {
                    httpOnly: true,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    path: "/",
                    maxAge: 60 * 60 * 24 * 30,
                });
            }
            return response;
        }

        console.error("Auth callback error:", error.message);
        return NextResponse.redirect(`${getURL()}login?error=${encodeURIComponent(error.message)}`)
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${getURL()}login?error=Authentication%20failed`)
}
