import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;
  // Try window injected config first (set by chat /supabase connect): { url, key }
  if (typeof window !== 'undefined' && (window as any).__SUPABASE__) {
    const cfg = (window as any).__SUPABASE__;
    if (cfg.url && cfg.key) {
      client = createClient(cfg.url, cfg.key, { auth: { persistSession: false } });
      return client;
    }
  }

  // Try environment variables (Vite)
  // Log env vars in development to help debugging (do not leak in prod).
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('VITE_SUPABASE_URL=', import.meta.env.VITE_SUPABASE_URL);
    // eslint-disable-next-line no-console
    console.log('VITE_SUPABASE_ANON_KEY=', import.meta.env.VITE_SUPABASE_ANON_KEY);
  }
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) {
    client = createClient(url, key, { auth: { persistSession: false } });
    return client;
  }

  return null;
}

export function setSupabaseClient(url: string, key: string) {
  client = createClient(url, key, { auth: { persistSession: false } });
  // Also expose minimally to window for other modules if needed (kept in memory only)
  try {
    if (typeof window !== 'undefined') (window as any).__SUPABASE__ = { url, key };
  } catch (_) {}
  return client;
}
