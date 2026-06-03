import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isApiPath(pathname: string) {
    return pathname.startsWith('/api')
}

function isPublicPath(pathname: string) {
    return pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth')
}

function isOnboardingPath(pathname: string) {
    return pathname === '/onboarding'
}

function sanitizeCallbackUrl(callbackUrl: string | null) {
    if (!callbackUrl) return '/'
    if (!callbackUrl.startsWith('/')) return '/'
    if (callbackUrl.startsWith('//')) return '/'
    return callbackUrl
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const pathname = request.nextUrl.pathname
    const apiRequest = isApiPath(pathname)
    const publicPath = isPublicPath(pathname)

    let user = null
    try {
        const {
            data: { user: resolvedUser },
            error,
        } = await supabase.auth.getUser()
        if (error) {
            console.error('Supabase auth getUser error:', error.message)
        }
        user = resolvedUser
    } catch (error) {
        console.error('Supabase auth getUser exception:', error)
    }

    if (!user && !publicPath) {
        if (apiRequest) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`)
        return NextResponse.redirect(url)
    }

    if (user && (pathname === '/login' || pathname === '/signup')) {
        const destination = sanitizeCallbackUrl(request.nextUrl.searchParams.get('callbackUrl'))
        return NextResponse.redirect(new URL(destination, request.url))
    }

    if (user && !apiRequest && !publicPath) {
        // The onboarding gate runs on every page navigation. To avoid a DB
        // round-trip each time, cache the positive ("is a member") result in a
        // short-lived HTTP-only cookie. Only the positive case is cached so a
        // user who just completed onboarding is recognized immediately. This
        // cookie is non-authoritative — it only gates the onboarding redirect;
        // all data access remains protected by RLS + requireWorkspaceApiContext.
        let isMember = request.cookies.get('ws_member')?.value === '1'

        if (!isMember) {
            const { count, error } = await supabase
                .from("workspace_members")
                .select("workspace_id", { count: "exact", head: true })
                .eq("user_id", user.id)
                .eq("status", "active");

            if (error) {
                // Preserve prior behavior: on query error, skip the redirect logic.
                return supabaseResponse;
            }

            isMember = (count ?? 0) > 0;
            if (isMember) {
                supabaseResponse.cookies.set('ws_member', '1', {
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 60,
                    path: '/',
                })
            }
        }

        if (!isMember && !isOnboardingPath(pathname)) {
            const onboardingUrl = request.nextUrl.clone();
            onboardingUrl.pathname = "/onboarding";
            return NextResponse.redirect(onboardingUrl);
        }

        if (isMember && isOnboardingPath(pathname)) {
            const appUrl = request.nextUrl.clone();
            appUrl.pathname = "/";
            return NextResponse.redirect(appUrl);
        }
    }

    return supabaseResponse
}
