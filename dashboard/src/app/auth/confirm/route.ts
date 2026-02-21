import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null
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

    if (token_hash && type) {
        const supabase = await createClient()

        const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        })

        if (!error) {
            // redirect user to specified redirect URL or root of app
            return NextResponse.redirect(`${getURL()}${next.replace(/^\//, '')}`)
        }

        console.error("Auth confirm error:", error.message);
        return NextResponse.redirect(`${getURL()}login?error=${encodeURIComponent(error.message)}`)
    }

    // redirect the user to an error page with some instructions
    return NextResponse.redirect(`${getURL()}login?error=Invalid%20magic%20link`)
}
