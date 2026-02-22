import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isApiPath(pathname: string) {
    return pathname.startsWith('/api')
}

function isPublicPath(pathname: string) {
    return pathname === '/login' || pathname.startsWith('/auth')
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

    if (user && pathname === '/login') {
        const destination = sanitizeCallbackUrl(request.nextUrl.searchParams.get('callbackUrl'))
        return NextResponse.redirect(new URL(destination, request.url))
    }

    return supabaseResponse
}
