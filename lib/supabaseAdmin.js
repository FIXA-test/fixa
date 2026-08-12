import { createClient } from "@supabase/supabase-js";

// Server-only klient. Använder service-role-nyckeln, som kringgår RLS helt.
// Får ALDRIG importeras från kod som körs i webbläsaren ("use client"-filer)
// - bara från route-handlers under app/api/**.
export const supabaseAdmin = createClient(
  "https://lwnwoeftisepokhgcudq.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Lösenordet jämförs här, på servern - aldrig i webbläsaren.
export function isAdminRequest(req) {
  const provided = req.headers.get("x-admin-password");
  return !!provided && provided === process.env.ADMIN_PASSWORD;
}
