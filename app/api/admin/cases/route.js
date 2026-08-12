import { supabaseAdmin, isAdminRequest } from "@/lib/supabaseAdmin";

// GET /api/admin/cases - listar alla ärenden. Ersätter det tidigare
// direkta anropet från webbläsaren (sf.from("cases").select("*")...).
export async function GET(req) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: "Fel lösenord" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
