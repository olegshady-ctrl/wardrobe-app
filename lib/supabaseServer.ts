// lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Создаёт серверный Supabase-клиент.
 * Без persistSession/autoRefresh (браузерных фич).
 */
export function supabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
