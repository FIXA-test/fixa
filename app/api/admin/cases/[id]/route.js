import { supabaseAdmin, isAdminRequest } from "@/lib/supabaseAdmin";

// Vitlista över fält adminpanelen får ändra. Utöka vid behov, men undvik
// att tillåta helt fria uppdateringar av vilken kolumn som helst.
const ALLOWED_FIELDS = ["status", "loest_forsta_besoket", "resolved_remotely"];

// PATCH /api/admin/cases/<id> - body: { status?, loest_forsta_besoket? }
// Ersätter de tidigare direkta anropen från webbläsaren
// (sf.from("cases").update({...}).eq("id", id)).
export async function PATCH(req, { params }) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: "Fel lösenord" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const update = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) {
    return Response.json({ error: "Inget att uppdatera" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("cases").update(update).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
