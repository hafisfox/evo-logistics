import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

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
            return NextResponse.redirect(`${getURL()}${next.replace(/^\//, '')}`)
        }

        console.error("Auth callback error:", error.message);
        return NextResponse.redirect(`${getURL()}login?error=${encodeURIComponent(error.message)}`)
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${getURL()}login?error=Authentication%20failed`)
}
