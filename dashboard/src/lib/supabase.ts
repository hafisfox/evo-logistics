import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase"; // We'll generate this later

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    // Gracefull fallback to prevent crashing during build or if not configured yet
    console.warn("Supabase URL or Anon Key is missing. Check your environment variables.");
}

// Client for public/anon access (respects RLS)
export const supabase = createClient<Database>(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-key",
    {
        auth: {
            persistSession: false, // We aren't using Supabase Auth, we use NextAuth
        },
    }
);

// Client for backend admin access (bypasses RLS)
export function getServiceRoleClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
    }

    return createClient<Database>(
        supabaseUrl || "https://placeholder.supabase.co",
        serviceRoleKey,
        {
            auth: {
                persistSession: false,
            },
        }
    );
}
