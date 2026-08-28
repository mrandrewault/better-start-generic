import {createClient} from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// New Supabase projects expose a publishable key; older projects may still
// use the legacy public anon-key name. Both are browser-safe public keys.
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key, {
  auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}
}) : null;

export const supabaseConfigured = Boolean(url && key);
