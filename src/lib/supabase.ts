// Supabase Auth client for the browser. Only the auth module is loaded
// (not the full supabase-js SDK): all data reads and writes go through the
// MarketMind API (see api.ts), never directly to the database.
import { AuthClient } from "@supabase/auth-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Placeholder values keep imports safe when unconfigured; the app shows a
// setup message instead of calling the client.
export const auth = new AuthClient({
  url: `${(url || "http://localhost:54321").replace(/\/$/, "")}/auth/v1`,
  headers: { apikey: anonKey || "missing-anon-key", Authorization: `Bearer ${anonKey || "missing-anon-key"}` },
  storageKey: "marketmind-auth",
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
});
